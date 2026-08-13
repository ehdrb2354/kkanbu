import Image from "next/image";

export default function Loading() {
  return (
    <div className="loading-screen">
      <div className="pulse">
        <Image src="/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: "18px" }} />
      </div>
      <p className="loading-text">깐부 찾는 중...</p>
    </div>
  );
}
