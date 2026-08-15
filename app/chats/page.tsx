"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { getCategory } from "../lib/categories";
import { getChatDestroyAt, formatCountdown, isChatDestroyed } from "../lib/chatLifecycle";
import { getMannerTier } from "../lib/mannerTier";
import { useUnreadChats } from "../lib/notifications";
import NotificationPermissionBanner from "../components/NotificationPermissionBanner";
import ParticipantAvatar from "../components/ParticipantAvatar";

type ChatRoom = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  scheduled_at: string;
};

type MeetupRelation = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  scheduled_at: string;
  status: string;
};

type DmThread = {
  friendId: string;
  nickname: string;
  avatar: string | null;
  score: number;
  meetupsJoined: number;
  lastContent: string;
  lastAt: string;
};

export default function ChatsPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const { unreadMeetupIds, unreadDmSenderIds } = useUnreadChats();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const [{ data }, { data: dmRows }] = await Promise.all([
      supabase
        .from("meetup_participants")
        .select("meetup:meetups(id, title, category, location_text, scheduled_at, status)")
        .eq("user_id", user.id),
      supabase
        .from("direct_messages")
        .select("sender_id, receiver_id, content, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    if (data) {
      const mapped = data
        .map((row) => {
          const r = row as unknown as { meetup: MeetupRelation | MeetupRelation[] | null };
          const m = Array.isArray(r.meetup) ? r.meetup[0] : r.meetup;
          if (!m) return null;
          if (isChatDestroyed(m.scheduled_at)) return null;
          return {
            id: m.id,
            title: m.title,
            category: m.category,
            location_text: m.location_text,
            scheduled_at: m.scheduled_at,
          };
        })
        .filter((r): r is ChatRoom => r !== null)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      setRooms(mapped);
    }

    if (dmRows && dmRows.length > 0) {
      const seen = new Set<string>();
      const latestByFriend: { friendId: string; lastContent: string; lastAt: string }[] = [];
      dmRows.forEach((row) => {
        const friendId = row.sender_id === user.id ? row.receiver_id : row.sender_id;
        if (seen.has(friendId)) return;
        seen.add(friendId);
        latestByFriend.push({ friendId, lastContent: row.content, lastAt: row.created_at });
      });

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, nickname, avatar, manner_score, meetups_joined_count")
        .in("id", latestByFriend.map((t) => t.friendId));

      const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

      setDmThreads(
        latestByFriend.map((t) => {
          const profile = profileById.get(t.friendId);
          return {
            friendId: t.friendId,
            nickname: profile?.nickname ?? "알 수 없음",
            avatar: profile?.avatar ?? null,
            score: profile?.manner_score ?? 0,
            meetupsJoined: profile?.meetups_joined_count ?? 0,
            lastContent: t.lastContent,
            lastAt: t.lastAt,
          };
        })
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>🤝 내 깐부톡</h1>

      <NotificationPermissionBanner />

      <p style={{ fontWeight: 800, marginBottom: "10px", fontSize: "14px" }}>모임 채팅</p>
      {rooms.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          <p>아직 열려있는 깐부톡이 없어요.</p>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>번개모임에 참가하면 여기서 대화할 수 있어요!</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {rooms.map((r) => {
          const category = getCategory(r.category);
          const countdown = formatCountdown(getChatDestroyAt(r.scheduled_at));
          return (
            <Link
              key={r.id}
              href={`/meetup/${r.id}/chat`}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
            >
              <div>
                <p style={{ fontWeight: 800, fontSize: "15px" }}>
                  {unreadMeetupIds.has(r.id) && <span className="chat-room-dot" />}
                  {category?.icon} {r.title}
                </p>
                <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>📍 {r.location_text}</p>
              </div>
              <span className="tag" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)", whiteSpace: "nowrap" }}>
                ⏳ {countdown}
              </span>
            </Link>
          );
        })}
      </div>

      <p style={{ fontWeight: 800, marginBottom: "10px", marginTop: "24px", fontSize: "14px" }}>친구와의 채팅</p>
      {dmThreads.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          <p>아직 깐부와 나눈 대화가 없어요.</p>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>깐부 목록에서 💬 버튼을 눌러 대화를 시작해보세요!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {dmThreads.map((t) => {
            const tier = getMannerTier(t.score, t.meetupsJoined);
            return (
              <Link
                key={t.friendId}
                href={`/dm/${t.friendId}`}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}
              >
                <ParticipantAvatar avatarUrl={t.avatar} tier={tier} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: "15px" }}>
                    {unreadDmSenderIds.has(t.friendId) && <span className="chat-room-dot" />}
                    {t.nickname}
                  </p>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                      marginTop: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.lastContent}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
