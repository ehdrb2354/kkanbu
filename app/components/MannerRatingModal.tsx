"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { getMannerTagsByPositive } from "../lib/mannerTags";
import { scoreToDelta, starsForScore } from "../lib/mannerRating";
import { getMannerTier } from "../lib/mannerTier";
import ParticipantAvatar from "./ParticipantAvatar";

type Ratee = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  score: number;
  meetupsJoined: number;
};

type Props = {
  meetupId: string;
  ratee: Ratee;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function MannerRatingModal({ meetupId, ratee, onClose, onSubmitted }: Props) {
  const [score, setScore] = useState(80);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScore(80);
    setTags([]);
    setComment("");
    setError(null);
  }, [ratee.userId]);

  const isPositive = score >= 50;
  const visibleTags = getMannerTagsByPositive(isPositive);
  const stars = starsForScore(score);
  const tier = getMannerTier(ratee.score, ratee.meetupsJoined);

  function toggleTag(key: string) {
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const raterId = userData.user?.id;
    if (!raterId) {
      setSubmitting(false);
      return;
    }
    const validTags = tags.filter((key) => visibleTags.some((t) => t.key === key));
    const { error: insertError } = await supabase.from("manner_ratings").insert({
      meetup_id: meetupId,
      rater_id: raterId,
      ratee_id: ratee.userId,
      delta: scoreToDelta(score),
      tags: validTags,
      comment: comment.trim(),
    });
    if (insertError) {
      setError("평가에 실패했어요. 이미 평가했을 수 있어요.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSubmitted();
  }

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="filter-sheet-header">
          <p style={{ fontWeight: 800, fontSize: "16px" }}>모임 평가하기</p>
          <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={onClose}>
            닫기
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "14px" }}>
          오늘 &lsquo;{ratee.nickname}&rsquo; 님과 함께한 번개는 어떠셨나요? 솔직한 평가는 서로 더 좋은 깐부를 찾는 데
          큰 도움이 됩니다!
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "10px 12px",
            marginBottom: "18px",
          }}
        >
          <ParticipantAvatar avatarUrl={ratee.avatarUrl} tier={tier} size={44} />
          <div>
            <p style={{ fontWeight: 700 }}>{ratee.nickname}님</p>
            <p style={{ fontSize: "12px", fontWeight: 700, color: tier.color }}>{tier.label}</p>
          </div>
        </div>

        <p className="filter-sheet-group-title">1. 매너 점수를 선택해주세요</p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="rating-slider"
          />
          <span style={{ fontSize: "13px", whiteSpace: "nowrap" }}>
            {"⭐".repeat(stars)}
            {"☆".repeat(5 - stars)}
          </span>
        </div>
        <p style={{ textAlign: "center", fontWeight: 800, marginBottom: "18px" }}>{score}점</p>

        <p className="filter-sheet-group-title">2. 어떤 점이 {isPositive ? "좋았나요" : "아쉬웠나요"}?</p>
        <div style={{ marginBottom: "18px" }}>
          {visibleTags.map((t) => (
            <label key={t.key} className="rating-tag-item">
              <input type="checkbox" checked={tags.includes(t.key)} onChange={() => toggleTag(t.key)} />
              {t.icon} {t.label}
            </label>
          ))}
        </div>

        <p className="filter-sheet-group-title">3. 한줄 후기를 남겨주세요 (선택)</p>
        <textarea
          className="field-input"
          style={{ width: "100%", minHeight: "64px", resize: "vertical" }}
          placeholder="다음에 또 만나요! 너무 즐거웠습니다 :)"
          maxLength={200}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {error && <p style={{ color: "var(--danger)", fontSize: "12px", marginTop: "10px" }}>{error}</p>}

        <button
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "16px" }}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "제출 중..." : "평가 완료"}
        </button>
      </div>
    </div>
  );
}
