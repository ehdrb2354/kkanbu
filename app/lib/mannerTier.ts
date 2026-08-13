export type MannerTier = {
  key: string;
  label: string;
  icon: string;
  color: string;
};

// compute_tier()(docs/schema.sql)와 항상 같은 구간을 유지하세요.
// 번개 참여 횟수(SCORE_THRESHOLDS)와 매너 점수(COUNT_THRESHOLDS) 둘 다 충족해야 다음 티어로 올라갑니다.
// 아이콘은 이미지 파일 없이 TierIcon 컴포넌트가 이 이모지+색상으로 뱃지를 그립니다.
// 탐색자 → 깐부 → 번개대장 → 불꽃마스터 → 친화력 대장(최고 티어, 매너1000+·참여50+)
export const MANNER_TIERS: MannerTier[] = [
  { key: "explorer", label: "탐색자", icon: "🔍", color: "#84a827" },
  { key: "kkanbu", label: "깐부", icon: "📍", color: "#ca8a04" },
  { key: "leader", label: "번개대장", icon: "⚡", color: "#ea580c" },
  { key: "flamemaster", label: "불꽃마스터", icon: "🔥", color: "#dc2626" },
  { key: "socialleader", label: "친화력 대장", icon: "🤝", color: "#9333ea" },
];

export const SCORE_THRESHOLDS = [0, 200, 400, 600, 1000];
export const COUNT_THRESHOLDS = [0, 3, 10, 25, 50];

export const DEFAULT_MANNER_SCORE = 250;
export const GOOD_MANNER_DELTA = 10;
export const BAD_MANNER_DELTA = -15;

function tierIndexFor(value: number, thresholds: number[]): number {
  let idx = 0;
  thresholds.forEach((t, i) => {
    if (value >= t) idx = i;
  });
  return idx;
}

export function getMannerTierIndex(score: number, meetupsJoined: number): number {
  const scoreIdx = tierIndexFor(score, SCORE_THRESHOLDS);
  const countIdx = tierIndexFor(meetupsJoined, COUNT_THRESHOLDS);
  return Math.min(scoreIdx, countIdx);
}

export function getMannerTier(score: number, meetupsJoined: number): MannerTier {
  return MANNER_TIERS[getMannerTierIndex(score, meetupsJoined)];
}
