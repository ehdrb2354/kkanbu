"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "../lib/supabase/client";

function LoginButtons() {
  const searchParams = useSearchParams();
  const authFailed = searchParams.get("error") === "auth";
  const [loggingIn, setLoggingIn] = useState(false);

  // 카카오 로그인은 Supabase가 개인 개발자는 동의 못 하는 account_email 스코프를 항상
  // 같이 요청해서(KOE205) 지금은 막혀있어요 — 비즈니스 인증 받으면 다시 붙일 수 있어요.
  async function handleGoogleLogin() {
    setLoggingIn(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="container" style={{ paddingTop: "80px" }}>
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Image src="/icon-192.png?v=2" alt="깐부" width={88} height={88} style={{ borderRadius: "22px" }} />
        </div>
        <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--primary-dark)", marginTop: "12px" }}>깐부</div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "8px" }}>
          너 내 깐부 해라! 지금 같이 할 사람 찾기
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          disabled
          className="btn"
          style={{ width: "100%", background: "#fee500", color: "#191600", opacity: 0.55 }}
        >
          💬 카카오 로그인 (준비중)
        </button>
        <button
          onClick={handleGoogleLogin}
          disabled={loggingIn}
          className="btn btn-outline"
          style={{ width: "100%" }}
        >
          {loggingIn ? "이동 중..." : "🔍 Google로 시작하기"}
        </button>
      </div>

      {authFailed && (
        <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "16px", textAlign: "center" }}>
          로그인에 실패했어요. 다시 시도해주세요.
        </p>
      )}

      <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "24px", textAlign: "center", lineHeight: 1.6 }}>
        카카오·네이버 로그인은 준비 중이에요.
        <br />
        처음 로그인하면 바로 가입돼요 — 별도 회원가입이 필요 없어요.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginButtons />
    </Suspense>
  );
}
