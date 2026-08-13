import type { MannerTier } from "../lib/mannerTier";

type Props = {
  tier: MannerTier;
  size?: number;
};

// 이미지 파일 없이 색상+이모지로 완성되는 티어 뱃지.
export default function TierIcon({ tier, size = 20 }: Props) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "999px",
        background: `${tier.color}22`,
        border: `${Math.max(1.5, size * 0.06)}px solid ${tier.color}`,
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
    >
      {tier.icon}
    </span>
  );
}
