import Image from "next/image";

type Props = {
  message?: string;
};

// 매칭/주변 탐색 관련 화면에서만 쓰는 로딩 화면 — 프로필 등 매칭과 무관한 화면에는 쓰지 않아요.
export default function SearchingLoader({ message = "내 주변 깐부 탐색 중..." }: Props) {
  return (
    <div className="loading-screen">
      <div className="pulse">
        <Image src="/icon-192.png?v=2" alt="" width={96} height={96} style={{ borderRadius: "22px" }} />
      </div>
      <p className="loading-text">{message}</p>
      <p className="loading-footer">
        powered by <strong>Kkanbu</strong>
      </p>
    </div>
  );
}
