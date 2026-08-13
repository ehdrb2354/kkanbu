"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();

  async function handleLogout() {
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
    </main>
  );
}
