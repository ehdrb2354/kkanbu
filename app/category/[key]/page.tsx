"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getCategory } from "../../lib/categories";

type MeetupRow = {
  id: string;
  title: string;
  location_text: string;
  scheduled_at: string;
  capacity: number;
  host_id: string;
  hostNickname: string;
  participantCount: number;
};

export default function CategoryPage() {
  const params = useParams<{ key: string }>();
  const category = getCategory(params.key);
  const [meetups, setMeetups] = useState<MeetupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meetups")
      .select(
        "id, title, location_text, scheduled_at, capacity, host_id, host:profiles(nickname), meetup_participants(count)"
      )
      .eq("category", params.key)
      .eq("status", "open")
      .order("scheduled_at", { ascending: true });

    if (!error && data) {
      setMeetups(
        data.map((row) => {
          const r = row as unknown as {
            id: string;
            title: string;
            location_text: string;
            scheduled_at: string;
            capacity: number;
            host_id: string;
            host: { nickname: string } | { nickname: string }[] | null;
            meetup_participants: { count: number }[];
          };
          const host = Array.isArray(r.host) ? r.host[0] : r.host;
          return {
            id: r.id,
            title: r.title,
            location_text: r.location_text,
            scheduled_at: r.scheduled_at,
            capacity: r.capacity,
            host_id: r.host_id,
            hostNickname: host?.nickname ?? "알 수 없음",
            participantCount: r.meetup_participants?.[0]?.count ?? 0,
          };
        })
      );
    }
    setLoading(false);
  }, [params.key]);

  useEffect(() => {
    load();

    const supabase = createClient();
    const channel = supabase
      .channel(`category-${params.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetup_participants" }, load)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetups", filter: `category=eq.${params.key}` },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, params.key]);

  if (!category) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        존재하지 않는 카테고리예요.
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800 }}>
          {category.icon} {category.label}
        </h1>
        <Link
          href={`/meetup/new?category=${category.key}`}
          className="btn btn-primary"
          style={{ fontSize: "13px", padding: "10px 16px" }}
        >
          + 새 매칭
        </Link>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>불러오는 중...</p>}

      {!loading && meetups.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          <p>지금 열려있는 {category.label} 매칭이 없어요.</p>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>가장 먼저 매칭을 만들어보세요!</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {meetups.map((m) => {
          const full = m.participantCount >= m.capacity;
          return (
            <Link
              key={m.id}
              href={`/meetup/${m.id}`}
              className="card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: "15px" }}>{m.title}</p>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>📍 {m.location_text}</p>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
                    🕒 {formatDateTime(m.scheduled_at)}
                  </p>
                </div>
                <span
                  className="tag"
                  style={{
                    background: full ? "var(--danger-soft)" : "var(--safe-soft)",
                    color: full ? "var(--danger)" : "var(--safe)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.participantCount}/{m.capacity}명
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "10px" }}>방장: {m.hostNickname}</p>
            </Link>
          );
        })}
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
