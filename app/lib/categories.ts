export type CategoryGroup = {
  key: string;
  label: string;
};

export type Category = {
  key: string;
  label: string;
  icon: string;
  group: string;
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: "outdoor", label: "아웃도어 / 스포츠" },
  { key: "indoor", label: "실내 액티비티" },
  { key: "food", label: "미식 / 혼밥타파" },
  { key: "culture", label: "문화 / 기타" },
];

export const CATEGORIES: Category[] = [
  // 아웃도어 / 스포츠
  { key: "hiking", label: "등산", icon: "🥾", group: "outdoor" },
  { key: "running", label: "러닝", icon: "🏃", group: "outdoor" },
  { key: "basketball", label: "농구", icon: "🏀", group: "outdoor" },
  { key: "futsal", label: "풋살", icon: "⚽", group: "outdoor" },
  { key: "soccer", label: "축구", icon: "⚽", group: "outdoor" },
  { key: "baseball", label: "야구", icon: "⚾", group: "outdoor" },
  { key: "jokgu", label: "족구", icon: "🏐", group: "outdoor" },
  { key: "cycling", label: "자전거 라이딩", icon: "🚴", group: "outdoor" },
  { key: "climbing", label: "클라이밍", icon: "🧗", group: "outdoor" },
  { key: "fishing", label: "낚시", icon: "🎣", group: "outdoor" },

  // 실내 액티비티
  { key: "boardgame", label: "보드게임", icon: "🎲", group: "indoor" },
  { key: "karaoke", label: "노래방", icon: "🎤", group: "indoor" },
  { key: "bowling", label: "볼링", icon: "🎳", group: "indoor" },
  { key: "escaperoom", label: "방탈출", icon: "🔐", group: "indoor" },
  { key: "pcroom", label: "PC방 (롤/배그 파티)", icon: "🎮", group: "indoor" },
  { key: "billiards", label: "당구 / 포켓볼", icon: "🎱", group: "indoor" },

  // 미식 / 혼밥타파
  { key: "korean", label: "한식", icon: "🍚", group: "food" },
  { key: "chinese", label: "중식", icon: "🥡", group: "food" },
  { key: "western", label: "양식", icon: "🍝", group: "food" },
  { key: "japanese", label: "일식", icon: "🍣", group: "food" },
  { key: "asian", label: "아시안", icon: "🍜", group: "food" },
  { key: "mexican", label: "멕시칸", icon: "🌮", group: "food" },
  { key: "cafe", label: "카페", icon: "☕", group: "food" },

  // 문화 / 기타
  { key: "exhibition", label: "전시회 관람", icon: "🖼️", group: "culture" },
  { key: "movie", label: "영화", icon: "🎬", group: "culture" },
  { key: "shopping", label: "쇼핑", icon: "🛍️", group: "culture" },
  { key: "study", label: "스터디 · 카공", icon: "📚", group: "culture" },
  { key: "etc", label: "기타", icon: "✨", group: "culture" },
];

export function getCategory(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function getCategoriesByGroup(groupKey: string): Category[] {
  return CATEGORIES.filter((c) => c.group === groupKey);
}
