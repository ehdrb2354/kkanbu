export type MannerTag = {
  key: string;
  label: string;
  icon: string;
  positive: boolean;
};

// manner_ratings.tags(text[])에 저장되는 값과 맞춰주세요.
export const MANNER_TAGS: MannerTag[] = [
  { key: "punctual", label: "시간 약속을 철저히 지켜요!", icon: "⏱️", positive: true },
  { key: "kind", label: "매너가 좋고 친절하게 대화를 이끌어줘요", icon: "✨", positive: true },
  { key: "fun", label: "분위기를 밝고 즐겁게 만들어줘요", icon: "💖", positive: true },
  { key: "active", label: "모임 활동에 매우 적극적이고 성실해요", icon: "👏", positive: true },
  { key: "best", label: "다음에 또 만나고 싶은 최고의 깐부예요!", icon: "🤝", positive: true },
  { key: "late", label: "약속 시간에 늦거나 연락이 지연되었어요", icon: "🏃", positive: false },
  { key: "awkward", label: "대화 중에 아쉬운 태도가 있었어요", icon: "💬", positive: false },
  { key: "passive", label: "모임 분위기에 잘 어울리지 못하고 소극적이었어요", icon: "💧", positive: false },
  { key: "noshow", label: "일방적인 연락 끊김(노쇼 등)이 있었어요", icon: "🚫", positive: false },
];

export function getMannerTagsByPositive(positive: boolean) {
  return MANNER_TAGS.filter((t) => t.positive === positive);
}
