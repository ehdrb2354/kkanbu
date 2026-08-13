// 슬라이더로 고른 0~100점을 매너 점수(profiles.manner_score) 가감치로 변환합니다.
// 50점을 기준(변화 없음)으로, 100점이면 +10, 0점이면 -15까지 움직입니다.
export function scoreToDelta(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 50) return Math.round(((clamped - 50) / 50) * 10);
  return Math.round(((clamped - 50) / 50) * 15);
}

export function starsForScore(score: number): number {
  return Math.max(0, Math.min(5, Math.round(score / 20)));
}
