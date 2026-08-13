-- 깐부(Kkanbu) 데이터베이스 스키마
-- Supabase 프로젝트의 SQL Editor에 이 파일 전체를 붙여넣고 실행하세요.
-- (이미 이전 버전을 실행한 적이 있다면 파일 맨 아래 "기존에 실행한 적이 있다면" 섹션을 보세요)

-- ── profiles ──────────────────────────────────────────────
-- 매너 티어는 "번개 참여 횟수"와 "매너 점수" 둘 다 반영합니다 (한쪽만 높다고 오르지 않음):
--   탐색자(신규)   : 참여 0~2회
--   깐부(보통)     : 참여 3회+ 그리고 매너점수 200+
--   번개대장(우수)  : 참여 10회+ 그리고 매너점수 400+
--   불꽃마스터(최고) : 참여 25회+ 그리고 매너점수 600+
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
  select (array['탐색자', '깐부', '번개대장', '불꽃마스터'])[
    least(
      case when score >= 600 then 4 when score >= 400 then 3 when score >= 200 then 2 else 1 end,
      case when meetup_count >= 25 then 4 when meetup_count >= 10 then 3 when meetup_count >= 3 then 2 else 1 end
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
  with check (auth.uid() = host_id);

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
  with check (auth.uid() = user_id);

create policy "본인만 나가기 가능"
  on public.meetup_participants for delete
  to authenticated
  using (auth.uid() = user_id);

-- 참가/나가기 시 meetups_joined_count와 tier를 함께 갱신
create function public.on_participant_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count int;
  current_score int;
begin
  update public.profiles
  set meetups_joined_count = meetups_joined_count + 1
  where id = new.user_id
  returning meetups_joined_count, manner_score into updated_count, current_score;

  update public.profiles
  set tier = public.compute_tier(current_score, updated_count)
  where id = new.user_id;

  return new;
end;
$$;

create trigger on_meetup_participant_inserted
  after insert on public.meetup_participants
  for each row execute function public.on_participant_joined();

create function public.on_participant_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count int;
  current_score int;
begin
  update public.profiles
  set meetups_joined_count = greatest(0, meetups_joined_count - 1)
  where id = old.user_id
  returning meetups_joined_count, manner_score into updated_count, current_score;

  update public.profiles
  set tier = public.compute_tier(current_score, updated_count)
  where id = old.user_id;

  return old;
end;
$$;

create trigger on_meetup_participant_deleted
  after delete on public.meetup_participants
  for each row execute function public.on_participant_left();

-- ── manner_ratings (매너 평가) ────────────────────────────
create table public.manner_ratings (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  delta int not null, -- +10 굿매너 / -15 비매너
  tags text[] not null default '{}', -- 예: punctual, kind, fun / noshow, rude (app/lib/mannerTags.ts 참고)
  created_at timestamptz not null default now(),
  unique (meetup_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);

alter table public.manner_ratings enable row level security;

create policy "평가 내역은 로그인 유저 누구나 조회 가능"
  on public.manner_ratings for select
  to authenticated
  using (true);

create policy "본인 명의로만 평가 등록 가능"
  on public.manner_ratings for insert
  to authenticated
  with check (auth.uid() = rater_id);

-- 평가가 등록되면 대상자의 manner_score/tier에 자동 반영 (0 미만으로는 안 내려감)
create function public.apply_manner_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_score int;
  current_count int;
begin
  select greatest(0, manner_score + new.delta), meetups_joined_count
  into updated_score, current_count
  from public.profiles where id = new.ratee_id;

  update public.profiles
  set manner_score = updated_score,
      tier = public.compute_tier(updated_score, current_count)
  where id = new.ratee_id;

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

-- 운영자용: 대상별 신고 누적 현황 (지금은 앱 UI 없이 Supabase Table Editor/SQL Editor에서 직접 확인)
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