"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { getCategory } from "../lib/categories";

type MeetupItem = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  scheduled_at: string;
  status: string;
  isHost: boolean;
};

type MeetupRelation = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  scheduled_at: string;
  status: string;
  host_id: string;
};

export default function MyMeetupsPage() {
  const [items, setItems] = useState<MeetupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const { data } = await supabase
      .from("meetup_participants")
      .select("meetup:meetups(id, title, category, location_text, scheduled_at, status, host_id)")
      .eq("user_id", user.id);

    if (data) {
      const mapped = data
        .map((row) => {
          const r = row as unknown as { meetup: MeetupRelation | MeetupRelation[] | null };
          const m = Array.isArray(r.meetup) ? r.meetup[0] : r.meetup;
          if (!m) return null;
          return {
            id: m.id,
            title: m.title,
            category: m.category,
            location_text: m.location_text,
            scheduled_at: m.scheduled_at,
            status: m.status,
            isHost: m.host_id === user.id,
          };
        })
        .filter((m): m is MeetupItem => m !== null);
      setItems(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  const now = Date.now();
  const upcoming = items
    .filter((m) => new Date(m.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = items
    .filter((m) => new Date(m.scheduled_at).getTime() < now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>내 매칭</h1>

      <section>
        <p style={{ fontWeight: 700, color: "var(--muted)", fontSize: "13px", marginBottom: "8px" }}>다가오는 매칭</p>
        {upcoming.length === 0 && (
          <p className="card" style={{ color: "var(--muted)", fontSize: "13px" }}>예정된 매칭이 없어요.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {upcoming.map((m) => (
            <MeetupRow key={m.id} m={m} />
          ))}
        </div>
      </section>

      <section style={{ marginTop: "24px" }}>
        <p style={{ fontWeight: 700, color: "var(--muted)", fontSize: "13px", marginBottom: "8px" }}>
          지난 매칭 (매너평가 가능)
        </p>
        {past.length === 0 && (
          <p className="card" style={{ color: "var(--muted)", fontSize: "13px" }}>지난 매칭이 없어요.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {past.map((m) => (
            <MeetupRow key={m.id} m={m} />
          ))}
        </div>
      </section>
    </main>
  );
}

function MeetupRow({ m }: { m: MeetupItem }) {
  const category = getCategory(m.category);
  return (
    <Link
      href={`/meetup/${m.id}`}
      className="card"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
    >
      <div>
        <p style={{ fontWeight: 700, fontSize: "14px" }}>
          {category?.icon} {m.title}
        </p>
        <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>
          {formatDateTime(m.scheduled_at)} · {m.location_text}
        </p>
      </div>
      {m.isHost && (
        <span className="tag" style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}>
          방장
        </span>
      )}
    </Link>
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
