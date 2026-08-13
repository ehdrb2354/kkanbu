import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "깐부 — 너 내 깐부 해라!",
    short_name: "깐부",
    description: "혼자 하기 애매한 취미를 같이 할 진짜 내 편을 지도에서 바로 찾아주는 매칭 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfce1",
    theme_color: "#8bae1d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
