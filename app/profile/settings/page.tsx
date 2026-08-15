"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "탈퇴 처리에 실패했어요.");
      setDeleting(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <Link href="/profile" style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "underline" }}>
        ← 마이페이지로
      </Link>

      <h1 style={{ fontSize: "20px", fontWeight: 800, margin: "12px 0 16px" }}>⚙️ 설정</h1>

      <button className="btn btn-outline" style={{ width: "100%" }} onClick={handleLogout}>
        로그아웃
      </button>

      <div className="card" style={{ marginTop: "24px" }}>
        {!confirming ? (
          <button
            className="btn"
            style={{ width: "100%", background: "none", color: "var(--danger)", fontWeight: 700 }}
            onClick={() => setConfirming(true)}
          >
            회원 탈퇴
          </button>
        ) : (
          <div>
            <p style={{ fontWeight: 800, color: "var(--danger)" }}>정말 탈퇴하시겠어요?</p>
            <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, marginTop: "8px" }}>
              프로필, 모임 참여·매너평가 기록, 깐부(친구) 관계, 채팅 내역이 모두 삭제되고 복구할 수 없어요.
            </p>
            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                취소
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? "처리 중..." : "정말 탈퇴하기"}
              </button>
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: "12px", marginTop: "10px" }}>{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
