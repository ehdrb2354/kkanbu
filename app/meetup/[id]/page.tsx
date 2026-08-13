"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getCategory } from "../../lib/categories";
import { getMannerTier } from "../../lib/mannerTier";
import ParticipantAvatar from "../../components/ParticipantAvatar";
import { getChatDestroyAt, formatCountdown } from "../../lib/chatLifecycle";

type Participant = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  score: number;
  meetupsJoined: number;
};

type MeetupDetail = {
  id: string;
  category: string;
  title: string;
  description: string;
  location_text: string;
  scheduled_at: string;
  capacity: number;
  host_id: string;
  status: string;
};

export default function MeetupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [meetup, setMeetup] = useState<MeetupDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myRatedIds, setMyRatedIds] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id ?? null;
    setUserId(currentUserId);

    const { data: meetupRow } = await supabase.from("meetups").select("*").eq("id", params.id).single();
    setMeetup(meetupRow ?? null);

    const { data: participantRows } = await supabase
      .from("meetup_participants")
      .select("user_id, profiles(nickname, avatar, manner_score, meetups_joined_count)")
      .eq("meetup_id", params.id);

    if (participantRows) {
      setParticipants(
        participantRows.map((row) => {
          const r = row as unknown as {
            user_id: string;
            profiles:
              | { nickname: string; avatar: string | null; manner_score: number; meetups_joined_count: number }
              | { nickname: string; avatar: string | null; manner_score: number; meetups_joined_count: number }[]
              | null;
          };
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          return {
            userId: r.user_id,
            nickname: profile?.nickname ?? "알 수 없음",
            avatarUrl: profile?.avatar ?? null,
            score: profile?.manner_score ?? 0,
            meetupsJoined: profile?.meetups_joined_count ?? 0,
          };
        })
      );
    }

    if (currentUserId) {
      const { data: ratings } = await supabase
        .from("manner_ratings")
        .select("ratee_id")
        .eq("meetup_id", params.id)
        .eq("rater_id", currentUserId);
      setMyRatedIds((ratings ?? []).map((r) => r.ratee_id));
    }

    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`meetup-${params.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetup_participants", filter: `meetup_id=eq.${params.id}` },
        load
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "meetups", filter: `id=eq.${params.id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, params.id]);

  async function handleJoin() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: joinError } = await supabase
      .from("meetup_participants")
      .insert({ meetup_id: params.id, user_id: userId });
    if (joinError) setError("참가에 실패했어요. 이미 가득 찼을 수 있어요.");
    setBusy(false);
    load();
  }

  async function handleLeave() {
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("meetup_participants").delete().eq("meetup_id", params.id).eq("user_id", userId);
    setBusy(false);
    load();
  }

  async function handleCancel() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("meetups").update({ status: "closed" }).eq("id", params.id);
    setBusy(false);
    load();
  }

  async function handleRate(rateeId: string, delta: number) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rateError } = await supabase
      .from("manner_ratings")
      .insert({ meetup_id: params.id, rater_id: userId, ratee_id: rateeId, delta });
    if (rateError) setError("이미 평가했어요.");
    setBusy(false);
    load();
  }

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }
  if (!meetup) {
    return <main className="container" style={{ paddingTop: "40px" }}>매칭을 찾을 수 없어요.</main>;
  }

  const category = getCategory(meetup.category);
  const isHost = userId === meetup.host_id;
  const isParticipant = participants.some((p) => p.userId === userId);
  const isFull = participants.length >= meetup.capacity;
  const isPast = new Date(meetup.scheduled_at).getTime() < Date.now();
  const isOpen = meetup.status === "open";
  const chatDestroyed = Date.now() >= getChatDestroyAt(meetup.scheduled_at);
  const host = participants.find((p) => p.userId === meetup.host_id);
  const hostTier = host ? getMannerTier(host.score, host.meetupsJoined) : null;

  return (
    <main className="container" style={{ paddingTop: "4px" }}>
      <div className="detail-header">
        <button className="detail-header-back" onClick={() => router.back()} aria-label="뒤로가기">
          ‹
        </button>
        <p className="detail-header-title">모임 상세 화면</p>
      </div>

      <div className="meetup-banner">
        <div className="meetup-banner-icon">{category?.icon ?? "📍"}</div>
      </div>

      <div className="card" style={{ marginTop: "-32px", position: "relative", zIndex: 1 }}>
        <span
          className="tag"
          style={{
            background: isOpen && !isPast ? "var(--safe-soft)" : "var(--danger-soft)",
            color: isOpen && !isPast ? "var(--safe)" : "var(--danger)",
          }}
        >
          {!isOpen ? "취소된 매칭" : isPast ? "종료된 매칭" : isFull ? "모집 완료" : "모집 중"}
        </span>
        <h1 style={{ fontSize: "20px", fontWeight: 800, marginTop: "10px" }}>{meetup.title}</h1>

        <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", marginTop: "10px" }}>
          📅 {formatDateTime(meetup.scheduled_at)}
        </p>
        <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", marginTop: "6px" }}>
          📍 {meetup.location_text}
        </p>
        <p style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", marginTop: "6px" }}>
          👥 <strong style={{ color: "var(--primary-dark)" }}>{participants.length}</strong>/{meetup.capacity}명 모집
        </p>

        {meetup.description && (
          <div className="meetup-quote">
            <span>🔊</span>
            <span>&ldquo;{meetup.description}&rdquo;</span>
          </div>
        )}

        {host && hostTier && (
          <div
            className="host-spotlight"
            style={{ background: `${hostTier.color}14`, border: `1px solid ${hostTier.color}33` }}
          >
            <ParticipantAvatar avatarUrl={host.avatarUrl} tier={hostTier} size={52} />
            <div>
              <p className="host-spotlight-label">👑 방장</p>
              <p style={{ fontWeight: 800, fontSize: "15px" }}>
                {host.nickname} <span style={{ color: hostTier.color }}>{hostTier.label}</span>
              </p>
            </div>
          </div>
        )}

        {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "10px" }}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          {!isHost && isOpen && !isPast && !isParticipant && (
            <button className="btn btn-primary" disabled={busy || isFull} onClick={handleJoin} style={{ flex: 1 }}>
              {isFull ? "모집 완료" : "📷 깐부 하기 (참가 신청)"}
            </button>
          )}
          {!isHost && isParticipant && isOpen && !isPast && (
            <button className="btn btn-outline" disabled={busy} onClick={handleLeave} style={{ flex: 1 }}>
              나가기
            </button>
          )}
          {isHost && isOpen && (
            <button className="btn btn-danger" disabled={busy} onClick={handleCancel} style={{ flex: 1 }}>
              매칭 취소
            </button>
          )}
        </div>

        {isParticipant && (
          chatDestroyed ? (
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "10px", textAlign: "center" }}>
              💥 깐부톡은 활동 종료 5시간 후 자동으로 폭파됐어요
            </p>
          ) : (
            <>
              <Link href={`/meetup/${meetup.id}/chat`} className="btn btn-outline" style={{ width: "100%", marginTop: "10px" }}>
                🤝 깐부톡 열기
              </Link>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px", textAlign: "center" }}>
                ⏳ {formatCountdown(getChatDestroyAt(meetup.scheduled_at))} 후 자동폭파
              </p>
            </>
          )
        )}
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "12px" }}>참여 멤버 ({participants.length})</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {participants.map((p) => {
            const tier = getMannerTier(p.score, p.meetupsJoined);
            const alreadyRated = myRatedIds.includes(p.userId);
            const isSelf = p.userId === userId;
            return (
              <div key={p.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <ParticipantAvatar avatarUrl={p.avatarUrl} tier={tier} size={36} />
                  <div>
                    <p style={{ fontWeight: 700 }}>{p.nickname}</p>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: tier.color }}>{tier.label}</p>
                  </div>
                </div>
                {isPast && isParticipant && !isSelf && (
                  alreadyRated ? (
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>평가완료</span>
                  ) : (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn btn-safe"
                        style={{ padding: "6px 10px", fontSize: "12px" }}
                        disabled={busy}
                        onClick={() => handleRate(p.userId, 10)}
                      >
                        👍
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: "6px 10px", fontSize: "12px" }}
                        disabled={busy}
                        onClick={() => handleRate(p.userId, -15)}
                      >
                        👎
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
