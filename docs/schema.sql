-- 깐부(Kkanbu) 데이터베이스 스키마
-- Supabase 프로젝트의 SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
-- (이미 이전 버전을 실행한 적이 있다면 파일 맨 아래 "기존에 실행한 적이 있다면" 섹션을 보세요)

-- ── profiles ──────────────────────────────────────────────
-- 매너 티어는 "번개 참여 횟수"와 "매너 점수" 둘 다 반영합니다 (한쪽만 높다고 오르지 않음).
-- "참여 횟수"는 그냥 만들거나 참가만 해서는 안 오르고, 모임 종료 후 참가자끼리 매너평가를
-- 주고받아야만(= 참가자들의 동의) 인정됩니다 (아래 manner_ratings 섹션의 recompute_participation 참고):
--   탐색자(신규)     : 참여 0~2회
--   깐부(보통)       : 참여 3회+ 그리고 매너점수 200+
--   번개대장(우수)    : 참여 10회+ 그리고 매너점수 400+
--   불꽃마스터(최고)  : 참여 25회+ 그리고 매너점수 600+
--   친화력 대장(왕중왕) : 참여 50회+ 그리고 매너점수 1000+
-- (구간은 여기와 app/lib/mannerTier.ts 두 곳에 있으니 항상 같이 맞춰주세요)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  bio text not null default '',
  avatar text, -- 프로필 사진 URL 또는 서비스 캐릭터 key
  manner_score int not null default 250,
  meetups_joined_count int not null default 0,
  tier text not null default '탐색자',
  terms_agreed_at timestamptz, -- 이용약관 동의 시각 (온보딩에서 채워짐)
  is_admin boolean not null default false, -- 신고 검토/제재 권한이 있는 운영자 계정 표시
  suspended_until timestamptz, -- 이 시각까지는 모임 생성/참가 불가 (관리자 제재로만 설정됨)
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "프로필은 로그인 유저 누구나 조회 가능"
  on public.profiles for select
  to authenticated
  using (true);

create policy "본인 프로필만 수정 가능"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- manner_score + meetups_joined_count → tier 매핑
create function public.compute_tier(score int, meetup_count int)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['탐색자', '깐부', '번개대장', '불꽃마스터', '친화력 대장'])[
    least(
      case when score >= 1000 then 5 when score >= 600 then 4 when score >= 400 then 3 when score >= 200 then 2 else 1 end,
      case when meetup_count >= 50 then 5 when meetup_count >= 25 then 4 when meetup_count >= 10 then 3 when meetup_count >= 3 then 2 else 1 end
    )
  ];
$$;

-- 회원가입 시 auth.users에 자동으로 profiles 행 생성
-- (소셜 로그인의 경우 provider가 넘겨주는 이름/프로필사진을 raw_user_meta_data에서 함께 읽어옴)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, avatar)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Storage: 프로필 아바타 업로드 ──────────────────────────
-- 1) Supabase 대시보드 → Storage → New bucket → 이름 "avatars", Public bucket 켜기 (SQL로는 안 만들고 대시보드에서 만드는 걸 추천)
-- 2) 버킷을 만든 뒤 아래 정책들을 SQL Editor에서 실행하세요.
-- 업로드 경로는 {유저id}/avatar 형태로 고정해서, 재업로드하면 같은 파일을 덮어씁니다 (upsert).
create policy "아바타는 누구나 조회 가능"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "본인 폴더에만 아바타 업로드 가능"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "본인 아바타만 수정 가능"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "본인 아바타만 삭제 가능"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── meetups (레이드 = 매칭) ───────────────────────────────
create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  description text not null default '',
  location_text text not null,
  location_lat double precision not null,
  location_lng double precision not null,
  scheduled_at timestamptz not null,
  capacity int not null default 4,
  host_id uuid not null references public.profiles (id),
  status text not null default 'open', -- 'open' | 'closed'
  created_at timestamptz not null default now()
);

alter table public.meetups enable row level security;

create policy "매칭은 로그인 유저 누구나 조회 가능"
  on public.meetups for select
  to authenticated
  using (true);

create policy "본인 명의로만 매칭 생성 가능"
  on public.meetups for insert
  to authenticated
  with check (
    auth.uid() = host_id
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.suspended_until > now()
    )
  );

create policy "방장만 매칭 수정 가능"
  on public.meetups for update
  to authenticated
  using (auth.uid() = host_id);

-- ── meetup_participants ──────────────────────────────────
create table public.meetup_participants (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  unique (meetup_id, user_id)
);

alter table public.meetup_participants enable row level security;

create policy "참가자 목록은 로그인 유저 누구나 조회 가능"
  on public.meetup_participants for select
  to authenticated
  using (true);

create policy "본인 명의로만 참가 가능"
  on public.meetup_participants for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.suspended_until > now()
    )
  );

create policy "본인만 나가기 가능"
  on public.meetup_participants for delete
  to authenticated
  using (auth.uid() = user_id);

-- ⚠️ meetups_joined_count는 더 이상 "참가 신청(insert)" 시점에 올라가지 않습니다.
-- 그냥 모임을 만들거나 참가만 해도 티어가 오르는 문제가 있어서, 아래 manner_ratings 섹션의
-- recompute_participation()으로 옮겼습니다 — 모임이 끝난 뒤 참가자들끼리 매너평가를 주고받아야만
-- (= "참가자들의 동의") 그 모임이 실제 참여로 인정됩니다. 정원 체크는 앱에서 실시간 인원수로 계산하므로
-- meetup_participants insert/delete 자체에는 별도 트리거가 필요 없습니다.

-- 방장이 매칭을 취소하면, 실제로는 열리지 않은 모임이므로 참가자 전원(방장 포함)의
-- 참가 기록을 함께 지워서 meetups_joined_count/tier가 다시 원상복구되게 함
-- (그냥 만들고 취소만 해도 "참여 횟수"가 올라가던 문제 방지). security definer로 방장 검증 후
-- meetup_participants를 삭제하므로, 참가자 개개인의 "본인만 나가기 가능" 정책을 우회할 필요가 없음.
create function public.cancel_meetup(target_meetup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_host boolean;
begin
  select (host_id = auth.uid()) into caller_is_host
  from public.meetups where id = target_meetup_id;

  if not coalesce(caller_is_host, false) then
    raise exception '방장만 매칭을 취소할 수 있어요';
  end if;

  delete from public.meetup_participants where meetup_id = target_meetup_id;
  update public.meetups set status = 'closed' where id = target_meetup_id;
end;
$$;

grant execute on function public.cancel_meetup(uuid) to authenticated;

-- ── manner_ratings (매너 평가) ────────────────────────────
create table public.manner_ratings (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  delta int not null, -- 평가 슬라이더 0~100점을 scoreToDelta()로 환산한 값 (+10 ~ -15)
  tags text[] not null default '{}', -- 예: punctual, kind, fun / noshow, rude (app/lib/mannerTags.ts 참고)
  comment text not null default '', -- 한줄 후기 (선택 입력)
  created_at timestamptz not null default now(),
  unique (meetup_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);

alter table public.manner_ratings enable row level security;

create policy "평가 내역은 로그인 유저 누구나 조회 가능"
  on public.manner_ratings for select
  to authenticated
  using (true);

-- 본인 명의로만 평가 등록 가능 + 모임이 종료됐고 참여인원 3명 이상일 때만 평가 가능
-- (프론트에서도 막지만, API를 직접 호출해도 못 뚫도록 DB 레벨에서 한 번 더 확인)
create policy "본인 명의로만 평가 등록 가능 (3인 이상 종료된 모임만)"
  on public.manner_ratings for insert
  to authenticated
  with check (
    auth.uid() = rater_id
    and exists (
      select 1 from public.meetups m
      where m.id = manner_ratings.meetup_id and m.scheduled_at < now()
    )
    and (
      select count(*) from public.meetup_participants p
      where p.meetup_id = manner_ratings.meetup_id
    ) >= 3
  );

-- "참여 횟수(meetups_joined_count)"를 여기서 다시 계산합니다: 그냥 참가만 해서는 안 오르고,
-- 모임이 끝난 뒤 참가자들끼리 매너평가를 주고받은(= 서로의 참여를 인정한) 모임 수만 셉니다.
-- (평가를 주거나 받은 것 중 하나라도 있으면 그 모임은 "인정된 참여"로 집계)
create function public.recompute_participation(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count int;
  current_score int;
begin
  select count(distinct meetup_id) into new_count
  from (
    select meetup_id from public.manner_ratings where rater_id = target_user_id
    union
    select meetup_id from public.manner_ratings where ratee_id = target_user_id
  ) confirmed;

  select manner_score into current_score from public.profiles where id = target_user_id;

  update public.profiles
  set meetups_joined_count = new_count,
      tier = public.compute_tier(current_score, new_count)
  where id = target_user_id;
end;
$$;

-- 평가가 등록되면 대상자의 manner_score를 반영하고(0 미만으로는 안 내려감),
-- 평가자/대상자 둘 다의 참여 횟수·티어를 다시 계산합니다.
create function public.apply_manner_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_score int;
begin
  select greatest(0, manner_score + new.delta)
  into updated_score
  from public.profiles where id = new.ratee_id;

  update public.profiles
  set manner_score = updated_score
  where id = new.ratee_id;

  perform public.recompute_participation(new.ratee_id);
  perform public.recompute_participation(new.rater_id);

  return new;
end;
$$;

create trigger on_manner_rating_created
  after insert on public.manner_ratings
  for each row execute function public.apply_manner_rating();

-- ── meetup_messages (깐부톡: 매칭당 1개 채팅방) ───────────
create table public.meetup_messages (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.meetup_messages enable row level security;

create policy "참가자만 채팅 조회 가능"
  on public.meetup_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.meetup_participants p
      where p.meetup_id = meetup_messages.meetup_id and p.user_id = auth.uid()
    )
  );

create policy "참가자만 채팅 전송 가능"
  on public.meetup_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.meetup_participants p
      where p.meetup_id = meetup_messages.meetup_id and p.user_id = auth.uid()
    )
  );

create policy "참가자만 채팅 삭제 가능 (자동폭파용)"
  on public.meetup_messages for delete
  to authenticated
  using (
    exists (
      select 1 from public.meetup_participants p
      where p.meetup_id = meetup_messages.meetup_id and p.user_id = auth.uid()
    )
  );

-- ── profile_stats (완료한 모임 횟수 / 평균 매너 평가) ──────
-- 별도 카운터 컬럼을 두지 않고 뷰로 집계해서 항상 최신 값을 보장합니다.
create view public.profile_stats as
select
  pr.id as user_id,
  count(distinct mp.meetup_id) filter (where m.scheduled_at < now()) as completed_meetups,
  coalesce(avg(mr.delta), 0)::numeric(10, 1) as avg_rating_delta
from public.profiles pr
left join public.meetup_participants mp on mp.user_id = pr.id
left join public.meetups m on m.id = mp.meetup_id
left join public.manner_ratings mr on mr.ratee_id = pr.id
group by pr.id;

-- "받은 평가 태그" 빈도는 뷰 대신 필요할 때 아래처럼 조회하세요 (자주 조회하면 나중에 뷰로 뺄 수 있음):
-- select tag, count(*) from public.manner_ratings, unnest(tags) as tag
-- where ratee_id = '조회할 유저 id' group by tag order by count(*) desc;

-- ── reports (신고) ────────────────────────────────────────
-- target_type/target_id로 유저·모임·채팅메시지를 폭넓게 신고할 수 있게 함 (외래키 대신 앱 코드에서 유효성 보장).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  target_type text not null check (target_type in ('user', 'meetup', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('inappropriate', 'abuse', 'spam', 'other')),
  detail text not null default '',
  status text not null default 'pending', -- 'pending' | 'reviewed' | 'dismissed' | 'actioned' (운영자가 처리하며 갱신)
  created_at timestamptz not null default now(),
  check (target_type <> 'user' or reporter_id <> target_id) -- 본인 신고 방지
);

alter table public.reports enable row level security;

create policy "본인이 신고한 내역만 조회 가능"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "본인 명의로만 신고 등록 가능"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- 운영자(is_admin)는 모든 신고를 조회/상태 변경할 수 있음 (앱의 /admin/reports 화면에서 사용)
create policy "관리자는 모든 신고 조회 가능"
  on public.reports for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "관리자는 신고 상태를 변경할 수 있음"
  on public.reports for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 운영자용: 대상별 신고 누적 현황
-- select * from public.report_summary order by report_count desc;
create view public.report_summary as
select
  target_type,
  target_id,
  count(*) as report_count,
  array_agg(distinct reason) as reasons,
  max(created_at) as last_reported_at
from public.reports
group by target_type, target_id;

-- 관리자가 "제재 적용"을 누르면 실행되는 함수: 신고 대상 유저에게 매너점수 -30점 + 24시간 활동정지,
-- 모임 신고면 해당 모임을 강제 마감. 함수 안에서 is_admin을 직접 검증하므로 관리자가 아니면 실행 자체가 막힘.
create function public.apply_report_sanction(report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
  v_target_type text;
  v_target_id uuid;
  v_new_score int;
  v_meetup_count int;
begin
  select is_admin into caller_is_admin from public.profiles where id = auth.uid();
  if not coalesce(caller_is_admin, false) then
    raise exception '관리자만 제재를 적용할 수 있어요';
  end if;

  select target_type, target_id into v_target_type, v_target_id
  from public.reports where id = report_id;

  if v_target_type = 'user' then
    select greatest(0, manner_score - 30), meetups_joined_count
    into v_new_score, v_meetup_count
    from public.profiles where id = v_target_id;

    update public.profiles
    set manner_score = v_new_score,
        tier = public.compute_tier(v_new_score, v_meetup_count),
        suspended_until = greatest(coalesce(suspended_until, now()), now()) + interval '24 hours'
    where id = v_target_id;
  elsif v_target_type = 'meetup' then
    update public.meetups set status = 'closed' where id = v_target_id;
  end if;

  update public.reports set status = 'actioned' where id = report_id;
end;
$$;

grant execute on function public.apply_report_sanction(uuid) to authenticated;

-- ── push_subscriptions (앱이 꺼져있어도 오는 푸시 알림용 구독 정보) ──
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "본인 구독 정보만 조회 가능"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "본인 명의로만 구독 등록 가능"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "본인 구독 정보만 수정 가능"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "본인 구독 정보만 삭제 가능"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- 실제 발송은 서버(Next.js /api/push/send)가 service_role 키로 이 테이블을 읽어서 처리합니다.
-- (RLS는 우회, 클라이언트는 자기 구독 정보만 CRUD 가능)

-- ── meetup_messages insert마다 푸시 발송 API를 호출하는 트리거 ─────
-- 대시보드에 Database → Webhooks 메뉴가 없는 프로젝트라면, pg_net으로 직접 호출하는
-- 이 트리거가 Webhooks UI와 동일한 역할을 합니다.
-- <YOUR_DEPLOY_URL>과 <YOUR_PUSH_WEBHOOK_SECRET>을 실제 값으로 바꿔서 SQL Editor에서 실행하세요.
-- (실제 값이 들어간 완성본은 커밋하지 말고 그때그때 채워서 SQL Editor에만 붙여넣으세요.)

create extension if not exists pg_net;

create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := '<YOUR_DEPLOY_URL>/api/push/send',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'meetup_messages',
      'record', jsonb_build_object(
        'id', new.id,
        'meetup_id', new.meetup_id,
        'sender_id', new.sender_id,
        'content', new.content
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_PUSH_WEBHOOK_SECRET>'
    )
  );
  return new;
end;
$$;

create trigger on_meetup_message_push
  after insert on public.meetup_messages
  for each row execute function public.notify_new_chat_message();

-- ── Realtime: 참가자 수 / 채팅 실시간 반영 ─────────────────
alter publication supabase_realtime add table public.meetups;
alter publication supabase_realtime add table public.meetup_participants;
alter publication supabase_realtime add table public.meetup_messages;

-- ── (선택) 깐부톡 서버단 자동 폭파 — pg_cron ───────────────
-- 앱이 채팅을 열 때마다 "활동 시작 + 5시간이 지난 채팅"을 클라이언트에서도 삭제하지만,
-- 아무도 다시 열어보지 않는 채팅방까지 확실히 정리하려면 아래 pg_cron 스케줄을 추가로 설정하세요.
-- (지금 당장 안 해도 앱은 정상 동작합니다 — 나중에 배포 전에 해도 괜찮아요)
-- Supabase 대시보드 → Database → Extensions 에서 "pg_cron" 을 먼저 켠 다음 아래를 실행하세요.
--
-- create or replace function public.destroy_expired_kkanbu_chats()
-- returns void
-- language sql
-- security definer
-- set search_path = ''
-- as $$
--   delete from public.meetup_messages
--   where meetup_id in (
--     select id from public.meetups where scheduled_at + interval '5 hours' < now()
--   );
-- $$;
--
-- select cron.schedule(
--   'destroy-expired-kkanbu-chats',
--   '*/15 * * * *',
--   $$ select public.destroy_expired_kkanbu_chats(); $$
-- );

-- ── 참고: 이 파일을 이전에 이미 한 번 실행한 적이 있다면 ────
-- 지금까지 실제 운영 데이터가 쌓인 게 아니라면, 가장 간단하고 확실한 방법은
-- Supabase SQL Editor에서 아래처럼 기존 테이블을 모두 지우고 이 파일을 처음부터 다시 실행하는 것입니다.
--
-- drop table if exists public.meetup_messages cascade;
-- drop table if exists public.manner_ratings cascade;
-- drop table if exists public.meetup_participants cascade;
-- drop table if exists public.meetups cascade;
-- drop view if exists public.profile_stats;
-- drop table if exists public.profiles cascade;
-- drop function if exists public.compute_tier(int);
-- drop function if exists public.compute_tier(int, int);
--
-- (테스트 계정을 지우고 싶다면 Authentication → Users에서 직접 삭제하세요.
--  profiles는 auth.users를 on delete cascade로 참조하므로 유저를 지우면 같이 삭제됩니다.)
--
-- ⚠️ 이제 실제 가입 유저/모임 데이터가 쌓여있을 수 있으니, 위 "전체 삭제 후 재실행"은 더 이상 권장하지 않아요.
-- reports(신고) 기능만 새로 추가하는 경우라면, 위의 "reports" create table ~ "report_summary" 뷰
-- 부분만 골라서 SQL Editor에 추가로 실행하면 기존 데이터에 영향 없이 반영돼요.
--
-- manner_ratings 평가 정책을 "3인 이상 + 종료된 모임만" 조건으로 이미 예전 버전으로 실행해뒀다면,
-- 아래 두 줄만 추가로 실행해서 정책을 최신 버전으로 교체하세요 (데이터는 그대로 유지됩니다):
--
-- drop policy if exists "본인 명의로만 평가 등록 가능" on public.manner_ratings;
-- (위의 "manner_ratings" 섹션에 있는 새 create policy "본인 명의로만 평가 등록 가능 (3인 이상 종료된 모임만)" 을 실행)
--
-- manner_ratings에 한줄 후기(comment) 컬럼이 없다면 아래 한 줄만 추가로 실행하세요:
--
-- alter table public.manner_ratings add column if not exists comment text not null default '';
--
-- 관리자(신고 검토/제재) 기능을 새로 추가하는 경우, 아래를 순서대로 추가로 실행하세요:
--
-- alter table public.profiles add column if not exists is_admin boolean not null default false;
-- alter table public.profiles add column if not exists suspended_until timestamptz;
--
-- drop policy if exists "본인 명의로만 매칭 생성 가능" on public.meetups;
-- (위의 "meetups" 섹션에 있는 새 create policy "본인 명의로만 매칭 생성 가능" 을 실행 — 정지 여부 체크 추가됨)
--
-- drop policy if exists "본인 명의로만 참가 가능" on public.meetup_participants;
-- (위의 "meetup_participants" 섹션에 있는 새 create policy "본인 명의로만 참가 가능" 을 실행 — 정지 여부 체크 추가됨)
--
-- (위의 "reports" 섹션에 있는 "관리자는 모든 신고 조회 가능" / "관리자는 신고 상태를 변경할 수 있음" 정책과
--  apply_report_sanction() 함수, grant execute 줄을 추가로 실행)
--
-- 마지막으로, 운영자로 지정할 계정을 본인 이메일로 지정하세요:
-- update public.profiles set is_admin = true
-- where id = (select id from auth.users where email = '운영자로 쓸 계정의 이메일');
--
-- 매칭 취소 시 참가자 전원의 참가 기록도 함께 지워지도록(만들고 취소만 해도 참여 횟수가 올라가던 문제 수정)
-- 하려면, 위의 "meetup_participants" 트리거들 아래에 있는 cancel_meetup() 함수와 grant execute 줄을 추가로 실행하세요.
--
-- ⚠️ "그냥 참가만 해도(모임을 만들기만 해도) 티어가 오르는" 문제를 고치려면 아래를 순서대로 실행하세요.
-- 이제 참여 횟수는 모임이 끝난 뒤 참가자끼리 매너평가를 주고받아야만("참가자들의 동의") 인정됩니다.
--
-- drop trigger if exists on_meetup_participant_inserted on public.meetup_participants;
-- drop trigger if exists on_meetup_participant_deleted on public.meetup_participants;
-- drop function if exists public.on_participant_joined();
-- drop function if exists public.on_participant_left();
--
-- (위의 "manner_ratings" 섹션에 있는 recompute_participation() 함수와, 새로 바뀐
--  apply_manner_rating() 함수(create function이 아니라 이미 있으므로 "create or replace function"으로
--  실행하세요)를 추가/교체 실행)
--
-- create or replace function public.apply_manner_rating()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- declare
--   updated_score int;
-- begin
--   select greatest(0, manner_score + new.delta)
--   into updated_score
--   from public.profiles where id = new.ratee_id;
--
--   update public.profiles
--   set manner_score = updated_score
--   where id = new.ratee_id;
--
--   perform public.recompute_participation(new.ratee_id);
--   perform public.recompute_participation(new.rater_id);
--
--   return new;
-- end;
-- $$;
--
-- 마지막으로, 기존에 (버그로) 잘못 쌓여있던 참여 횟수를 실제 매너평가 기록 기준으로 한 번 보정하세요:
--
-- update public.profiles pr
-- set meetups_joined_count = coalesce((
--   select count(distinct meetup_id) from (
--     select meetup_id from public.manner_ratings where rater_id = pr.id
--     union
--     select meetup_id from public.manner_ratings where ratee_id = pr.id
--   ) t
-- ), 0);
--
-- update public.profiles
-- set tier = public.compute_tier(manner_score, meetups_joined_count);
--
-- 앱이 꺼져있어도(백그라운드/종료 상태) 채팅 알림이 오는 푸시 알림 기능을 새로 추가하는 경우,
-- 위의 "push_subscriptions" 섹션(create table ~ 정책 4개)만 골라서 SQL Editor에 추가로 실행하세요.
-- 그 다음 Supabase 대시보드 → Database → Webhooks 에서 meetup_messages insert 웹훅을
-- /api/push/send 로 설정해야 실제로 발송됩니다.