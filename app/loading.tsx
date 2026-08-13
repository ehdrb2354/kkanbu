import Image from "next/image";

export default function Loading() {
  return (
    <div className="loading-screen">
      <div className="pulse">
        <Image src="/icon-192.png" alt="" width={64} height={64} style={{ borderRadius: "16px" }} />
      </div>
    </div>
  );
}
