let loadPromise: Promise<void> | null = null;

export function loadKakaoMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("서버에서는 지도를 불러올 수 없어요."));
  }

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  if (!appKey) {
    return Promise.reject(new Error("카카오맵 키가 설정되지 않았어요."));
  }

  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("kakao-maps-sdk");
    if (existing) {
      existing.addEventListener("load", () => window.kakao.maps.load(() => resolve()));
      existing.addEventListener("error", () => reject(new Error("지도를 불러오지 못했어요.")));
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-maps-sdk";
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => reject(new Error("지도를 불러오지 못했어요."));
    document.head.appendChild(script);
  });

  return loadPromise;
}
