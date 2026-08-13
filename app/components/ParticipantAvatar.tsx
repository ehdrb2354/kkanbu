import type { MannerTier } from "../lib/mannerTier";
import DefaultAvatar from "./DefaultAvatar";
import TierIcon from "./TierIcon";

type Props = {
  avatarUrl: string | null;
  tier: MannerTier;
  size?: number;
  badgeSize?: number;
};

// 참가자 목록/방장 스포트라이트에서 재사용하는 "아바타 + 티어 뱃지" 조합.
export default function ParticipantAvatar({ avatarUrl, tier, size = 40, badgeSize }: Props) {
  const badge = badgeSize ?? Math.max(16, Math.round(size * 0.5));

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #fff",
          boxShadow: "0 2px 8px rgba(93, 64, 55, 0.18)",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <DefaultAvatar />
        )}
      </div>
      <div style={{ position: "absolute", bottom: -2, right: -2 }}>
        <TierIcon tier={tier} size={badge} />
      </div>
    </div>
  );
}
