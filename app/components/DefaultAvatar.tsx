type Props = {
  size?: number | string;
  className?: string;
};

// 프로필 사진을 안 올린 유저에게 보여주는 기본 아바타 (사람 실루엣, 웜 옐로우-그린 배경).
export default function DefaultAvatar({ size = "100%", className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true" style={{ display: "block" }}>
      <rect x="0" y="0" width="100" height="100" fill="#D4E157" />
      <circle cx="50" cy="38" r="17" fill="#FDFCE1" />
      <path d="M15 92 C15 68 30 56 50 56 C70 56 85 68 85 92 Z" fill="#FDFCE1" />
    </svg>
  );
}
