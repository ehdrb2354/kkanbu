"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getMannerTierIndex,
  MANNER_TIERS,
  SCORE_THRESHOLDS,
  COUNT_THRESHOLDS,
} from "../../lib/mannerTier";
import { MANNER_TAGS } from "../../lib/mannerTags";
import { createClient } from "../../lib/supabase/client";
import { pairKey } from "../../lib/pairKey";
import TierIcon from "../../components/TierIcon";
import ParticipantAvatar from "../../components/ParticipantAvatar";

const MASTER_SCORE_CAP = SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1];

type EarnedBadge = {
  key: string;
  label: string;
  icon: string;
  count: number;
};

export default function FriendProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [meetupsJoined, setMeetupsJoined] = useState(0);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user;
    if (!me) return;

    if (me.id === params.id) {
      router.replace("/profile");
      return;
    }

    const [{ data: profile }, { data: ratingRows }, { data: friendship }] = await Promise.all([
      supabase
        .from("profiles")
        .select("nickname, bio, avatar, manner_score, meetups_joined_count")
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("manner_ratings").select("tags, delta").eq("ratee_id", params.id),
      supabase
        .from("friendships")
        .select("status")
        .eq("pair_key", pairKey(me.id, params.id))
        .maybeSingle(),
    ]);

    if (!profile) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setNickname(profile.nickname);
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar ?? null);
    setScore(profile.manner_score);
    setMeetupsJoined(profile.meetups_joined_count);
    setIsFriend(friendship?.status === "accepted");

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
  }, [params.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  if (notFound) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <p style={{ textAlign: "center", color: "var(--muted)" }}>존재하지 않는 깐부예요.</p>
      </main>
    );
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

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>👤 프로필</h1>

      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <ParticipantAvatar avatarUrl={avatarUrl} tier={tier} size={88} badgeSize={32} />
        </div>
        <p style={{ fontSize: "20px", fontWeight: 800 }}>{nickname}</p>
        {bio && <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "6px" }}>{bio}</p>}
        <div style={{ marginTop: "10px" }}>
          <span className="lv-chip" style={{ background: tier.color }}>
            Lv.{tierIndex + 1} {tier.icon} {tier.label}
          </span>
        </div>
        {isFriend && (
          <Link href={`/dm/${params.id}`} className="btn btn-primary" style={{ width: "100%", marginTop: "16px" }}>
            💬 채팅하기
          </Link>
        )}
      </div>

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "14px" }}>깐부 현황</p>

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
        <p style={{ fontWeight: 800, marginBottom: "14px" }}>받은 칭찬 배지</p>
        {badges.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>
            아직 받은 칭찬 배지가 없어요.
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
    </main>
  );
}
