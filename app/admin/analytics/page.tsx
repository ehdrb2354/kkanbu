"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { CATEGORIES, getCategory } from "../../lib/categories";

type CategoryCount = {
  key: string;
  label: string;
  icon: string;
  count: number;
};

type EtcMeetup = {
  id: string;
  title: string;
  description: string;
  created_at: string;
};

export default function AdminAnalyticsPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<CategoryCount[]>([]);
  const [etcMeetups, setEtcMeetups] = useState<EtcMeetup[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setChecking(false);
      return;
    }

    const { data: myProfile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setIsAdmin(true);

    const { data: meetupRows } = await supabase.from("meetups").select("id, category, title, description, created_at");
    const rows = meetupRows ?? [];
    setTotal(rows.length);

    const freq: Record<string, number> = {};
    rows.forEach((r) => {
      freq[r.category] = (freq[r.category] ?? 0) + 1;
    });

    const list: CategoryCount[] = CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      icon: c.icon,
      count: freq[c.key] ?? 0,
    })).sort((a, b) => b.count - a.count);
    setCounts(list);

    setEtcMeetups(
      rows
        .filter((r) => r.category === "etc")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((r) => ({ id: r.id, title: r.title, description: r.description, created_at: r.created_at }))
    );

    setChecking(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (checking) {
    return <main className="container" style={{ paddingTop: "40px" }}>확인 중...</main>;
  }

  if (!isAdmin) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "32px" }}>🔒</p>
          <p style={{ fontWeight: 800, marginTop: "8px" }}>운영자만 볼 수 있는 화면이에요</p>
        </div>
      </main>
    );
  }

  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>📊 카테고리 통계</h1>
      <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
        지금까지 생성된 모임 총 {total}개 기준 (취소/종료 포함 전체)
      </p>

      <div className="card">
        <p style={{ fontWeight: 800, marginBottom: "12px" }}>인기 카테고리 순위</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {counts.map((c, i) => (
            <div key={c.key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span style={{ fontWeight: 700 }}>
                  {i + 1}. {c.icon} {c.label}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {c.count}개{total > 0 ? ` (${Math.round((c.count / total) * 100)}%)` : ""}
                </span>
              </div>
              <div className="stat-track">
                <div
                  className="stat-fill"
                  style={{ width: `${(c.count / maxCount) * 100}%`, background: "var(--primary-dark)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "4px" }}>
          {getCategory("etc")?.icon} &ldquo;기타&rdquo;로 만들어진 모임 ({etcMeetups.length}개)
        </p>
        <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "12px" }}>
          기존 카테고리에 안 맞아서 기타를 고른 실제 모임들이에요. 반복되는 주제가 보이면 새 카테고리로 분리할 수 있어요.
        </p>
        {etcMeetups.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>아직 없어요.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {etcMeetups.map((m) => (
              <div key={m.id} style={{ background: "var(--bg)", borderRadius: "12px", padding: "10px 12px" }}>
                <p style={{ fontWeight: 700, fontSize: "14px" }}>{m.title}</p>
                {m.description && (
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{m.description}</p>
                )}
                <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  {formatDate(m.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
