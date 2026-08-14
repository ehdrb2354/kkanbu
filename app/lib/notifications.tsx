"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { subscribeToPush } from "./push";
import { usePathname } from "next/navigation";

type NotificationContextValue = {
  unreadMeetupIds: Set<string>;
};

const NotificationContext = createContext<NotificationContextValue>({ unreadMeetupIds: new Set() });

export function useUnreadChats() {
  return useContext(NotificationContext);
}

const CHAT_PATH_RE = /^\/meetup\/([^/]+)\/chat$/;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());

  useEffect(() => {
    pathnameRef.current = pathname;
    const openId = pathname.match(CHAT_PATH_RE)?.[1];
    if (!openId) return;
    setUnread((prev) => {
      if (!prev.has(openId)) return prev;
      const next = new Set(prev);
      next.delete(openId);
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    subscribeToPush(supabase, userId).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("global-chat-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "meetup_messages" },
        async (payload) => {
          const row = payload.new as { meetup_id: string; sender_id: string; content: string };
          if (row.sender_id === userId) return;
          if (pathnameRef.current.match(CHAT_PATH_RE)?.[1] === row.meetup_id) return;

          setUnread((prev) => new Set(prev).add(row.meetup_id));

          // 프로덕션에서는 서비스워커의 push 이벤트가 알림을 띄우므로(백그라운드에서도 동작),
          // 여기서는 서비스워커가 꺼져있는 개발 모드에서만 포그라운드 알림을 대신 띄운다.
          if (process.env.NODE_ENV === "production") return;
          if (typeof window === "undefined" || typeof Notification === "undefined") return;
          if (Notification.permission !== "granted") return;

          const [{ data: meetup }, { data: sender }] = await Promise.all([
            supabase.from("meetups").select("title").eq("id", row.meetup_id).single(),
            supabase.from("profiles").select("nickname").eq("id", row.sender_id).single(),
          ]);

          const notification = new Notification(meetup?.title ? `🤝 ${meetup.title}` : "🤝 깐부톡", {
            body: `${sender?.nickname ?? "깐부"}: ${row.content}`,
            icon: "/icon-192.png",
            tag: `chat-${row.meetup_id}`,
          });
          notification.onclick = () => {
            window.focus();
            window.location.href = `/meetup/${row.meetup_id}/chat`;
            notification.close();
          };
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <NotificationContext.Provider value={{ unreadMeetupIds: unread }}>{children}</NotificationContext.Provider>;
}
