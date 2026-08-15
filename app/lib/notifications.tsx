"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "./supabase/client";
import { subscribeToPush } from "./push";
import { pairKey } from "./pairKey";
import { usePathname } from "next/navigation";

type UnreadContextValue = {
  unreadMeetupIds: Set<string>;
  unreadDmSenderIds: Set<string>;
};

type PresenceContextValue = {
  onlineUserIds: Set<string>;
};

// 두 컨텍스트로 분리한 이유: onlineUserIds는 누군가 접속/종료할 때마다 앱 전체에서 계속 바뀌는데,
// 하나의 컨텍스트에 묶여있으면 그 값이 바뀔 때마다 Nav처럼 안읽음 배지만 쓰는 컴포넌트까지
// 전부 리렌더링돼서 앱 전체가 느려진다. 온라인 상태를 실제로 쓰는 화면(나의 깐부)만 리렌더링되게 분리.
const UnreadContext = createContext<UnreadContextValue>({
  unreadMeetupIds: new Set(),
  unreadDmSenderIds: new Set(),
});

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set(),
});

export function useUnreadChats() {
  return useContext(UnreadContext);
}

// 지금 접속 중인 깐부들의 user id 집합 (Realtime Presence 기반, 앱을 닫으면 자동으로 빠짐).
export function useOnlinePresence() {
  return useContext(PresenceContext);
}

const CHAT_PATH_RE = /^\/meetup\/([^/]+)\/chat$/;
const DM_PATH_RE = /^\/dm\/([^/]+)$/;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [unreadDm, setUnreadDm] = useState<Set<string>>(new Set());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<string[]>([]);

  useEffect(() => {
    pathnameRef.current = pathname;
    const openId = pathname.match(CHAT_PATH_RE)?.[1];
    if (openId) {
      setUnread((prev) => {
        if (!prev.has(openId)) return prev;
        const next = new Set(prev);
        next.delete(openId);
        return next;
      });
    }
    const openDmId = pathname.match(DM_PATH_RE)?.[1];
    if (openDmId) {
      setUnreadDm((prev) => {
        if (!prev.has(openDmId)) return prev;
        const next = new Set(prev);
        next.delete(openDmId);
        return next;
      });
    }
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

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("global-dm-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const row = payload.new as { sender_id: string; receiver_id: string; content: string };
          if (row.receiver_id !== userId || row.sender_id === userId) return;
          if (pathnameRef.current.match(DM_PATH_RE)?.[1] === row.sender_id) return;

          setUnreadDm((prev) => new Set(prev).add(row.sender_id));

          if (process.env.NODE_ENV === "production") return;
          if (typeof window === "undefined" || typeof Notification === "undefined") return;
          if (Notification.permission !== "granted") return;

          const { data: sender } = await supabase.from("profiles").select("nickname").eq("id", row.sender_id).single();

          const notification = new Notification(`💬 ${sender?.nickname ?? "깐부"}`, {
            body: row.content,
            icon: "/icon-192.png",
            tag: `dm-${row.sender_id}`,
          });
          notification.onclick = () => {
            window.focus();
            window.location.href = `/dm/${row.sender_id}`;
            notification.close();
          };
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // 온라인 상태는 깐부(친구)끼리만 봐야 하므로, 전체가 다 들어올 수 있는 채널 하나가 아니라
  // "친구 두 명만 아는 채널 이름"(pairKey)으로 나눠서 추적한다 — 채널 이름을 모르면 못 들어온다.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const loadFriendIds = async () => {
      const { data } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      setFriendIds((data ?? []).map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)));
    };
    loadFriendIds();

    const channel = supabase
      .channel("presence-friendships-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, loadFriendIds)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || friendIds.length === 0) {
      setOnlineUserIds(new Set());
      return;
    }
    const supabase = createClient();
    const channels = friendIds.map((friendId) =>
      supabase.channel(`presence-${pairKey(userId, friendId)}`, { config: { presence: { key: userId } } })
    );

    const syncOnline = () => {
      const ids = new Set<string>();
      channels.forEach((c) => Object.keys(c.presenceState()).forEach((id) => ids.add(id)));
      setOnlineUserIds(ids);
    };

    channels.forEach((channel) => {
      channel.on("presence", { event: "sync" }, syncOnline).subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId });
        }
      });
    });

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [userId, friendIds]);

  return (
    <UnreadContext.Provider value={{ unreadMeetupIds: unread, unreadDmSenderIds: unreadDm }}>
      <PresenceContext.Provider value={{ onlineUserIds }}>{children}</PresenceContext.Provider>
    </UnreadContext.Provider>
  );
}
