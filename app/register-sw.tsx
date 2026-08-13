"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // 개발 중에는 서비스워커가 옛날 빌드를 캐싱해서 새 코드가 안 보이는 문제가 생길 수 있어서
    // 개발 모드에서는 등록하지 않고, 이미 등록되어 있던 것도 해제합니다.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
