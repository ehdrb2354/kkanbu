// 두 유저 id를 정렬해서 조합한 키. friendships.pair_key(DB)와 동일한 규칙 — 두 사람만 알 수 있는 값이라
// 온라인 상태 프레즌스 채널 이름으로 쓰면 그 두 사람 외에는(채널 이름을 몰라서) 들어올 수 없다.
export function pairKey(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
