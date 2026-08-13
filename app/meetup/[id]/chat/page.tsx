"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { getCategory } from "../../../lib/categories";
import { getMannerTier } from "../../../lib/mannerTier";
import ParticipantAvatar from "../../../components/ParticipantAvatar";
import ReportButton from "../../../components/ReportButton";
import { getChatDestroyAt, formatHMS } from "../../../lib/chatLifecycle";

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type ParticipantInfo = {
  nickname: string;
  avatarUrl: string | null;
  score: number;
  meetupsJoined: number;
};

type MeetupInfo = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  scheduled_at: string;
};

export default function MeetupChatPage() {
  const params = useParams<{ id: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [meetup, setMeetup] = useState<MeetupInfo | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [isParticipant, setIsParticipant] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [destroyed, setDestroyed] = useState(false);
  const [hms, setHms] = useState("00:00:00");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "members">("chat");
  const [menuOpen, setMenuOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const destroyAtRef = useRef<number | null>(null);
  const purgedRef = useRef(false);

  const purgeIfExpired = useCallback(async () => {
    if (purgedRef.current) return;
    if (!destroyAtRef.current || Date.now() < destroyAtRef.current) return;
    purgedRef.current = true;
    const supabase = createClient();
    await supabase.from("meetup_messages").delete().eq("meetup_id", params.id);
    setDestroyed(true);
    setMessages([]);
  }, [params.id]);

  const init = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id ?? null;
    setUserId(currentUserId);

    const { data: meetupRow } = await supabase
      .from("meetups")
      .select("id, title, category, location_text, scheduled_at")
      .eq("id", params.id)
      .single();

    if (!meetupRow) {
      setLoading(false);
      return;
    }
    setMeetup(meetupRow);
    destroyAtRef.current = getChatDestroyAt(meetupRow.scheduled_at);

    const { data: participantRows } = await supabase
      .from("meetup_participants")
      .select("user_id, profiles(nickname, avatar, manner_score, meetups_joined_count)")
      .eq("meetup_id", params.id);

    const map: Record<string, ParticipantInfo> = {};
    (participantRows ?? []).forEach((row) => {
      const r = row as unknown as {
        user_id: string;
        profiles:
          | { nickname: string; avatar: string | null; manner_score: number; meetups_joined_count: number }
          | { nickname: string; avatar: string | null; manner_score: number; meetups_joined_count: number }[]
          | null;
      };
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      map[r.user_id] = {
        nickname: profile?.nickname ?? "알 수 없음",
        avatarUrl: profile?.avatar ?? null,
        score: profile?.manner_score ?? 0,
        meetupsJoined: profile?.meetups_joined_count ?? 0,
      };
    });
    setParticipants(map);

    const participant = currentUserId ? Object.prototype.hasOwnProperty.call(map, currentUserId) : false;
    setIsParticipant(participant);

    if (!participant) {
      setLoading(false);
      return;
    }

    if (Date.now() >= destroyAtRef.current) {
      await purgeIfExpired();
      setLoading(false);
      return;
    }

    const { data: messageRows } = await supabase
      .from("meetup_messages")
      .select("id, sender_id, content, created_at")
      .eq("meetup_id", params.id)
      .order("created_at", { ascending: true });

    setMessages(
      (messageRows ?? []).map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        content: m.content,
        createdAt: m.created_at,
      }))
    );
    setLoading(false);
  }, [params.id, purgeIfExpired]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isParticipant || destroyed) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${params.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "meetup_messages", filter: `meetup_id=eq.${params.id}` },
        (payload) => {
          const row = payload.new as { id: string; sender_id: string; content: string; created_at: string };
          setMessages((prev) => [
            ...prev,
            { id: row.id, senderId: row.sender_id, content: row.content, createdAt: row.created_at },
          ]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isParticipant, destroyed, params.id]);

  useEffect(() => {
    if (!destroyAtRef.current) return;
    const tick = () => {
      if (!destroyAtRef.current) return;
      if (Date.now() >= destroyAtRef.current) {
        purgeIfExpired();
      } else {
        setHms(formatHMS(destroyAtRef.current));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [purgeIfExpired, meetup]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !userId) return;
    setSending(true);
    setError(null);
    const supabase = createClient();
    const { error: sendError } = await supabase
      .from("meetup_messages")
      .insert({ meetup_id: params.id, sender_id: userId, content: input.trim() });
    if (sendError) setError("전송에 실패했어요.");
    else setInput("");
    setSending(false);
  }

  function handleComingSoon() {
    setComingSoon(true);
    setTimeout(() => setComingSoon(false), 1800);
  }

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  if (!meetup) {
    return <main className="container" style={{ paddingTop: "40px" }}>매칭을 찾을 수 없어요.</main>;
  }

  if (!isParticipant) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 800 }}>참가자만 볼 수 있는 깐부톡이에요</p>
          <Link href={`/meetup/${params.id}`} className="btn btn-outline" style={{ marginTop: "16px", width: "100%" }}>
            매칭 상세로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const category = getCategory(meetup.category);

  if (destroyed) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "36px" }}>💥</p>
          <p style={{ fontWeight: 800, marginTop: "8px" }}>깐부톡이 폭파됐어요</p>
          <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.7, marginTop: "10px" }}>
            활동이 종료되어 5시간이 경과함에 따라 프라이버시 보호를 위해 깐부 톡이 안전하게 폭파됩니다. 좋은
            깐부들과 즐거운 시간이 되셨길 바랍니다!
          </p>
          <Link href={`/meetup/${params.id}`} className="btn btn-primary" style={{ marginTop: "16px", width: "100%" }}>
            매너 평가하러 가기
          </Link>
        </div>
      </main>
    );
  }

  const memberList = Object.entries(participants);

  return (
    <main className="chat-page">
      <div className="chat-pinned-card">
        <Link href={`/meetup/${params.id}`} style={{ fontSize: "12px", color: "var(--muted)", textDecoration: "underline" }}>
          ← 매칭 상세
        </Link>
        <p style={{ fontWeight: 800, fontSize: "14px", marginTop: "6px" }}>
          {category?.icon} {meetup.title}
        </p>
        <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
          📍 {meetup.location_text} · 🕒 {formatDateTime(meetup.scheduled_at)}
        </p>
      </div>

      <div className="chat-header-icons">
        <button
          className={`chat-header-icon-btn ${view === "members" ? "active" : ""}`}
          onClick={() => setView("members")}
          aria-label="구성원 보기"
        >
          👥
        </button>
        <button
          className={`chat-header-icon-btn ${view === "chat" ? "active" : ""}`}
          onClick={() => setView("chat")}
          aria-label="다이너마이트 타이머"
        >
          🧨
        </button>
        <button className="chat-header-icon-btn" style={{ opacity: 0.4 }} onClick={handleComingSoon} aria-label="N빵 정산 (준비중)">
          🪙
        </button>
        <div style={{ position: "relative" }}>
          <button className="chat-header-icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="메뉴">
            ☰
          </button>
          {menuOpen && (
            <div className="chat-menu-popover" onClick={() => setMenuOpen(false)}>
              <Link href={`/meetup/${params.id}`} onClick={() => setMenuOpen(false)}>
                📋 매칭 상세보기
              </Link>
              <ReportButton
                targetType="meetup"
                targetId={params.id}
                targetLabel={meetup.title}
                label="🚩 이 모임 신고하기"
                className=""
              />
            </div>
          )}
        </div>
      </div>

      {comingSoon && <div className="chat-toast">🪙 N빵 정산은 준비 중이에요!</div>}

      {view === "members" ? (
        <div className="chat-messages">
          {memberList.map(([uid, p]) => {
            const tier = getMannerTier(p.score, p.meetupsJoined);
            return (
              <div
                key={uid}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "8px 0" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <ParticipantAvatar avatarUrl={p.avatarUrl} tier={tier} size={40} />
                  <div>
                    <p style={{ fontWeight: 700 }}>
                      {p.nickname}
                      {uid === userId ? " (나)" : ""}
                    </p>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: tier.color }}>{tier.label}</p>
                  </div>
                </div>
                {uid !== userId && <ReportButton targetType="user" targetId={uid} targetLabel={p.nickname} compact />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="chat-messages">
          <div className="chat-dynamite">
            <span style={{ fontSize: "36px" }}>🧨</span>
            <p className="chat-dynamite-clock">{hms}</p>
            <p style={{ fontSize: "11px", color: "var(--muted)" }}>뒤에 대화가 자동으로 사라져요</p>
          </div>

          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "13px", marginTop: "12px" }}>
              아직 대화가 없어요. 첫 메시지를 보내보세요!
            </p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === userId;
            const sender = participants[m.senderId];
            return (
              <div key={m.id} className={`chat-row ${mine ? "chat-row-mine" : ""}`}>
                {!mine && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
                    <div className="chat-avatar-small">
                      {sender?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sender.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span>📍</span>
                      )}
                    </div>
                    <div>
                      <span className="chat-sender">{sender?.nickname ?? "알 수 없음"}</span>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
                        <div className="chat-bubble">{m.content}</div>
                        <ReportButton targetType="message" targetId={m.id} targetLabel={`${sender?.nickname ?? "알 수 없음"}의 메시지`} compact />
                      </div>
                    </div>
                  </div>
                )}
                {mine && <div className="chat-bubble chat-bubble-mine">{m.content}</div>}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {view === "chat" && (
        <form onSubmit={handleSend} className="chat-composer">
          <input
            className="field-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요"
            maxLength={500}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
            전송
          </button>
        </form>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: "12px", padding: "0 20px" }}>{error}</p>}
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
