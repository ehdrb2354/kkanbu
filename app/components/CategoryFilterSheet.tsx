"use client";

import { CATEGORIES, CATEGORY_GROUPS, getCategoriesByGroup } from "../lib/categories";

type Props = {
  open: boolean;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onClose: () => void;
};

export default function CategoryFilterSheet({ open, selected, onSelect, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="filter-sheet-header">
          <p style={{ fontWeight: 800, fontSize: "16px" }}>카테고리 선택</p>
          <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={onClose}>
            닫기
          </button>
        </div>

        <button
          className="filter-chip"
          data-active={selected === null}
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          style={{ marginBottom: "16px" }}
        >
          🔥 전체 ({CATEGORIES.length})
        </button>

        {CATEGORY_GROUPS.map((group) => (
          <div key={group.key} className="filter-sheet-group">
            <p className="filter-sheet-group-title">{group.label}</p>
            <div className="filter-chip-grid">
              {getCategoriesByGroup(group.key).map((c) => (
                <button
                  key={c.key}
                  className="filter-chip"
                  data-active={selected === c.key}
                  onClick={() => {
                    onSelect(c.key);
                    onClose();
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
