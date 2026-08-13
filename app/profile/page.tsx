"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getMannerTierIndex,
  MANNER_TIERS,
  SCORE_THRESHOLDS,
  COUNT_THRESHOLDS,
} from "../lib/mannerTier";
import { MANNER_TAGS } from "../lib/mannerTags";
import { createClient } from "../lib/supabase/client";
import TierIcon from "../components/TierIcon";
import AvatarUploader from "../components/AvatarUploader";

const MASTER_SCORE_CAP = SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1];

type EarnedBadge = {
  key: string;
  label: string;
  icon: string;
  count: number;
};

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState("");
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [meetupsJoined, setMeetupsJoined] = useState(0);
  const [buddiesMet, setBuddiesMet] = useState(0);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [positiveRatings, setPositiveRatings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, bio, avatar, manner_score, meetups_joined_count")
      .eq("id", user.id)
      .single();
    if (profile) {
      setNickname(profile.nickname);
      setEditingNickname(profile.nickname);
      setBio(profile.bio ?? "");
      setEditingBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar ?? null);
      setScore(profile.manner_score);
      setMeetupsJoined(profile.meetups_joined_count);
    }

    const { data: myMeetupRows } = await supabase
      .from("meetup_participants")
      .select("meetup_id")
      .eq("user_id", user.id);
    const meetupIds = (myMeetupRows ?? []).map((r) => r.meetup_id);

    if (meetupIds.length > 0) {
      const { data: otherRows } = await supabase
        .from("meetup_participants")
        .select("user_id")
        .in("meetup_id", meetupIds)
        .neq("user_id", user.id);
      setBuddiesMet(new Set((otherRows ?? []).map((r) => r.user_id)).size);
    }

    const { data: ratingRows } = await supabase
      .from("manner_ratings")
      .select("tags, delta")
      .eq("ratee_id", user.id);

    setPositiveRatings((ratingRows ?? []).filter((r) => r.delta > 0).length);

    const freq: Record<string, number> = {};
    (ratingRows ?? []).forEach((r) => {
      (r.tags ?? []).forEach((tag: string) => {
        freq[tag] = (freq[tag] ?? 0) + 1;
      });
    });
    const earned = MANNER_TAGS.filter((t) => t.positive && freq[t.key])
      .map((t) => ({ key: t.key, label: t.label, icon: t.icon, count: freq[t.key] }))
      .sort((a, b) => b.count - a.count);
    setBadges(earned);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!editingNickname.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (user) {
      await supabase
        .from("profiles")
        .update({ nickname: editingNickname.trim(), bio: editingBio.trim() })
        .eq("id", user.id);
      setNickname(editingNickname.trim());
      setBio(editingBio.trim());
    }
    setSaving(false);
    setEditing(false);
  }

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  const tierIndex = getMannerTierIndex(score, meetupsJoined);
  const tier = MANNER_TIERS[tierIndex];
  const nextTier = MANNER_TIERS[tierIndex + 1];

  const scorePct = nextTier
    ? Math.min(100, Math.round(((score - SCORE_THRESHOLDS[tierIndex]) / (SCORE_THRESHOLDS[tierIndex + 1] - SCORE_THRESHOLDS[tierIndex])) * 100))
    : 100;
  const countPct = nextTier
    ? Math.min(100, Math.round(((meetupsJoined - COUNT_THRESHOLDS[tierIndex]) / (COUNT_THRESHOLDS[tierIndex + 1] - COUNT_THRESHOLDS[tierIndex])) * 100))
    : 100;
  const nextTierPct = Math.min(scorePct, countPct);
  const nextScoreNeeded = nextTier ? Math.max(0, SCORE_THRESHOLDS[tierIndex + 1] - score) : 0;
  const nextCountNeeded = nextTier ? Math.max(0, COUNT_THRESHOLDS[tierIndex + 1] - meetupsJoined) : 0;

  const scoreBarPct = Math.min(100, Math.round((score / MASTER_SCORE_CAP) * 100));

  const quests = [
    { label: "번개모임 3회 참여하기", progress: meetupsJoined, goal: 3 },
    { label: "새로운 깐부 2명 만나기", progress: buddiesMet, goal: 2 },
    { label: "다른 깐부에게 좋은 매너 평가 3회 받기", progress: positiveRatings, goal: 3 },
  ];

  return (
    <main className="container" style={{ paddingTop: "4px" }}>
      <div className="mypage-header">
        <p className="mypage-header-title">마이페이지</p>
        <Link href="/profile/settings" className="mypage-settings-link">
          ⚙️ 설정
        </Link>
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        {userId && (
          <div style={{ marginBottom: "16px" }}>
            <AvatarUploader userId={userId} avatarUrl={avatarUrl} onChange={setAvatarUrl} />
          </div>
        )}

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              className="field-input"
              value={editingNickname}
              onChange={(e) => setEditingNickname(e.target.value)}
              maxLength={20}
              placeholder="닉네임"
            />
            <textarea
              className="field-input"
              value={editingBio}
              onChange={(e) => setEditingBio(e.target.value)}
              maxLength={80}
              placeholder="한 줄 소개 (선택)"
              rows={2}
              style={{ resize: "none" }}
            />
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              저장
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>나의 깐부 이름</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "2px" }}>
              <p style={{ fontSize: "20px", fontWeight: 800 }}>{nickname}</p>
              <button
                className="btn btn-outline"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                onClick={() => setEditing(true)}
              >
                수정
              </button>
            </div>
            {bio && <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>{bio}</p>}
            <div style={{ marginTop: "10px" }}>
              <span className="lv-chip" style={{ background: tier.color }}>
                Lv.{tierIndex + 1} {tier.icon} {tier.label}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "14px" }}>나의 깐부 현황</p>

        <div className="stat-row">
          <div className="stat-row-top">
            <span className="stat-row-label">
              {nextTier
                ? `다음 티어까지 ${nextScoreNeeded > 0 ? `매너점수 ${nextScoreNeeded}점` : ""}${
                    nextScoreNeeded > 0 && nextCountNeeded > 0 ? ", " : ""
                  }${nextCountNeeded > 0 ? `번개 참여 ${nextCountNeeded}회` : ""}`
                : "최고 티어 달성!"}
            </span>
            {nextTier && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <TierIcon tier={nextTier} size={20} />
                <span style={{ fontSize: "12px", fontWeight: 800, color: nextTier.color }}>{nextTier.label}</span>
              </span>
            )}
          </div>
          <div className="stat-track">
            <div className="stat-fill" style={{ width: `${nextTierPct}%`, background: tier.color }} />
          </div>
        </div>

        <div className="stat-row">
          <div className="stat-row-top">
            <span className="stat-row-label">매너 점수: {score}점</span>
            <TierIcon tier={tier} size={20} />
          </div>
          <div className="stat-track">
            <div className="stat-fill" style={{ width: `${scoreBarPct}%`, background: "var(--primary-dark)" }} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "14px" }}>최근 받은 칭찬 배지</p>
        {badges.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>
            아직 받은 칭찬 배지가 없어요. 번개모임에 참여하고 좋은 매너 평가를 받아보세요!
          </p>
        ) : (
          <div className="badge-grid">
            {badges.slice(0, 4).map((b) => (
              <div key={b.key} className="badge-item">
                <div className="badge-item-icon">{b.icon}</div>
                <span className="badge-item-label">
                  {b.label}
                  <br />×{b.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "6px" }}>진행 중인 퀘스트</p>
        {quests.map((q) => {
          const done = q.progress >= q.goal;
          return (
            <div key={q.label} className="quest-item">
              <span className={`quest-checkbox ${done ? "done" : ""}`}>{done ? "✓" : ""}</span>
              <span className="quest-label">{q.label}</span>
              <span className="quest-progress">
                {Math.min(q.progress, q.goal)}/{q.goal}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "8px" }}>매너 티어 안내</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {MANNER_TIERS.map((t, i) => (
            <div
              key={t.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
                color: t.key === tier.key ? tier.color : "var(--muted)",
                fontWeight: t.key === tier.key ? 800 : 500,
              }}
            >
              <span>
                {t.icon} {t.label}
              </span>
              <span>
                매너 {SCORE_THRESHOLDS[i]}점+ · 참여 {COUNT_THRESHOLDS[i]}회+
              </span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/my-meetups" className="btn btn-outline" style={{ width: "100%", marginTop: "16px" }}>
        🙋 내가 만든/참여한 모임 이력
      </Link>
    </main>
  );
}
