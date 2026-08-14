"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { subscribeToPush } from "../lib/push";

const DISMISS_KEY = "kkanbu-notif-banner-dismissed";

export default function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    setVisible(false);
    if (permission !== "granted") return;

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) await subscribeToPush(supabase, data.user.id).catch(() => {});
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      className="card"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}
    >
      <p style={{ fontSize: "13px", fontWeight: 700 }}>🔔 새 메시지가 오면 알림을 받아보세요</p>
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button className="btn btn-outline" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={handleDismiss}>
          나중에
        </button>
        <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "12px" }} onClick={handleEnable}>
          알림 받기
        </button>
      </div>
    </div>
  );
}
