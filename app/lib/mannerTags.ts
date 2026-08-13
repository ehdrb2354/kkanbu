export type MannerTag = {
  key: string;
  label: string;
  positive: boolean;
};

// manner_ratings.tags(text[])에 저장되는 값과 맞춰주세요.
export const MANNER_TAGS: MannerTag[] = [
  { key: "punctual", label: "시간 약속을 잘 지켜요", positive: true },
  { key: "kind", label: "친절하고 매너가 좋아요", positive: true },
  { key: "fun", label: "다시 만나고 싶어요", positive: true },
  { key: "noshow", label: "노쇼했어요", positive: false },
  { key: "rude", label: "불친절해요", positive: false },
];
