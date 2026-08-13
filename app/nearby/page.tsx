"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { getCategory } from "../lib/categories";
import { distanceKm, formatDistance } from "../lib/geo";

type NearbyMeetup = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  location_lat: number;
  location_lng: number;
  scheduled_at: string;
  capacity: number;
  hostNickname: string;
  participantCount: number;
  distanceKm: number | null;
};

const DEFAULT_CENTER = { lat: 35.1796, lng: 129.0756 };

export default function NearbyPage() {
  const [meetups, setMeetups] = useState<NearbyMeetup[]>([]);
  const [loading, setLoading] = useState(true);
  const locationRef = useRef<{ lat: number; lng: number }>(DEFAULT_CENTER);

  const load = useCallback(async (center: { lat: number; lng: number }) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meetups")
      .select(
        "id, title, category, location_text, location_lat, location_lng, scheduled_at, capacity, host:profiles(nickname), meetup_participants(count)"
      )
      .eq("status", "open")
      .gte("scheduled_at", new Date().toISOString());

    if (!error && data) {
      const mapped = data.map((row) => {
        const r = row as unknown as {
          id: string;
          title: string;
          category: string;
          location_text: string;
          location_lat: number;
          location_lng: number;
          scheduled_at: string;
          capacity: number;
          host: { nickname: string } | { nickname: string }[] | null;
          meetup_participants: { count: number }[];
        };
        const host = Array.isArray(r.host) ? r.host[0] : r.host;
        return {
          id: r.id,
          title: r.title,
          category: r.category,
          location_text: r.location_text,
          location_lat: r.location_lat,
          location_lng: r.location_lng,
          scheduled_at: r.scheduled_at,
          capacity: r.capacity,
          hostNickname: host?.nickname ?? "알 수 없음",
          participantCount: r.meetup_participants?.[0]?.count ?? 0,
          distanceKm: distanceKm(center.lat, center.lng, r.location_lat, r.location_lng),
        };
      });
      mapped.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      setMeetups(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    function start(center: { lat: number; lng: number }) {
      locationRef.current = center;
      load(center);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => start({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => start(DEFAULT_CENTER),
        { timeout: 5000 }
      );
    } else {
      start(DEFAULT_CENTER);
    }

    const channel = supabase
      .channel("nearby")
      .on("postgres_changes", { event: "*", schema: "public", table: "meetups" }, () => load(locationRef.current))
      .on("postgres_changes", { event: "*", schema: "public", table: "meetup_participants" }, () =>
        load(locationRef.current)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>📍 내 주변 번개모임</h1>

      {loading && <p style={{ color: "var(--muted)" }}>불러오는 중...</p>}

      {!loading && meetups.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
          <p>주변에 열려있는 번개모임이 없어요.</p>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>홈 화면에서 새 모임을 만들어보세요!</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {meetups.map((m) => {
          const category = getCategory(m.category);
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
                  <p style={{ fontWeight: 800, fontSize: "15px" }}>
                    {category?.icon} {m.title}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
                    📍 {m.location_text}
                    {m.distanceKm !== null && ` · ${formatDistance(m.distanceKm)}`}
                  </p>
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
