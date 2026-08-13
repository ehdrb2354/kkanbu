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

  // 실내 액티비티
  { key: "boardgame", label: "보드게임", icon: "🎲", group: "indoor" },
  { key: "karaoke", label: "노래방", icon: "🎤", group: "indoor" },
  { key: "bowling", label: "볼링", icon: "🎳", group: "indoor" },
  { key: "escaperoom", label: "방탈출", icon: "🔐", group: "indoor" },
  { key: "pcroom", label: "PC방 (롤/배그 파티)", icon: "🎮", group: "indoor" },
  { key: "billiards", label: "당구 / 포켓볼", icon: "🎱", group: "indoor" },

  // 미식 / 혼밥타파
  { key: "gopchang", label: "곱창 · 대창 · 막창", icon: "🍖", group: "food" },
  { key: "dakgalbi", label: "닭갈비 · 족발", icon: "🍗", group: "food" },
  { key: "samgyeopsal", label: "삼겹살 · 고기구이", icon: "🥩", group: "food" },
  { key: "izakaya", label: "이자카야 · 한잔", icon: "🍶", group: "food" },
  { key: "buffet", label: "뷔페 · 샤브샤브", icon: "🍲", group: "food" },

  // 문화 / 기타
  { key: "exhibition", label: "전시회 관람", icon: "🖼️", group: "culture" },
  { key: "movie", label: "영화", icon: "🎬", group: "culture" },
  { key: "shopping", label: "쇼핑", icon: "🛍️", group: "culture" },
  { key: "study", label: "스터디 · 카공", icon: "📚", group: "culture" },
];

export function getCategory(key: string): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function getCategoriesByGroup(groupKey: string): Category[] {
  return CATEGORIES.filter((c) => c.group === groupKey);
}
