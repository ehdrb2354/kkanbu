"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { getCategory } from "../lib/categories";
import { getChatDestroyAt, formatCountdown, isChatDestroyed } from "../lib/chatLifecycle";

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

export default function ChatsPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const { data } = await supabase
      .from("meetup_participants")
      .select("meetup:meetups(id, title, category, location_text, scheduled_at, status)")
      .eq("user_id", user.id);

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
    </main>
  );
}
