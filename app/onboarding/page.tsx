"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import AvatarUploader from "../components/AvatarUploader";

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, bio, avatar, terms_agreed_at")
      .eq("id", user.id)
      .single();

    if (profile?.terms_agreed_at) {
      router.push("/");
      return;
    }

    if (profile) {
      setNickname(profile.nickname ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar ?? null);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (!agreed) {
      setError("이용약관에 동의해주세요.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("로그인이 필요해요.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        nickname: nickname.trim(),
        bio: bio.trim(),
        terms_agreed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      setError("저장에 실패했어요. 다시 시도해주세요.");
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "48px" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Image src="/icon-192.png" alt="깐부" width={72} height={72} style={{ borderRadius: "18px" }} />
        </div>
        <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary-dark)", marginTop: "10px" }}>깐부</div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "6px" }}>
          시작하기 전에 프로필을 설정해주세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {userId && (
          <AvatarUploader userId={userId} avatarUrl={avatarUrl} onChange={setAvatarUrl} />
        )}

        <div>
          <label className="field-label">닉네임</label>
          <input
            className="field-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="깐부들에게 보여질 이름"
            maxLength={20}
            required
          />
        </div>

        <div>
          <label className="field-label">한 줄 소개 (선택)</label>
          <textarea
            className="field-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="예: 주말엔 등산, 평일 저녁엔 러닝 좋아해요"
            maxLength={80}
            rows={2}
            style={{ resize: "none" }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "var(--muted)" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span>[필수] 이용약관 및 개인정보 처리방침에 동의합니다.</span>
        </label>

        {error && <p style={{ color: "var(--danger)", fontSize: "13px" }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "시작하는 중..." : "시작하기"}
        </button>
      </form>
    </main>
  );
}
