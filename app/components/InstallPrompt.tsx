"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    function handleInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferredEvent && !isIOS) return null;

  async function handleClick() {
    if (deferredEvent) {
      await deferredEvent.prompt();
      const choice = await deferredEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredEvent(null);
      return;
    }
    if (isIOS) setShowIOSHelp(true);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleClick}
        className="btn btn-outline"
        style={{ fontSize: "13px", padding: "10px 18px" }}
      >
        📱 휴대폰에 앱으로 설치하기
      </button>
      {showIOSHelp && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "260px",
            zIndex: 20,
            fontSize: "13px",
            lineHeight: 1.6,
            textAlign: "left",
          }}
        >
          <p style={{ fontWeight: 800, marginBottom: "6px" }}>iPhone에서 설치하는 법</p>
          <p>
            Safari 하단의 <strong>공유 버튼(⬆️)</strong>을 누른 뒤, <strong>"홈 화면에 추가"</strong>를 선택하세요.
          </p>
          <button
            onClick={() => setShowIOSHelp(false)}
            className="btn btn-outline"
            style={{ fontSize: "12px", padding: "6px 12px", marginTop: "10px" }}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
