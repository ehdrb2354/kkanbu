"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getMannerTier } from "../../lib/mannerTier";
import { pairKey } from "../../lib/pairKey";
import ParticipantAvatar from "../../components/ParticipantAvatar";

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type FriendInfo = {
  nickname: string;
  avatarUrl: string | null;
  score: number;
  meetupsJoined: number;
};

export default function DirectMessagePage() {
  const params = useParams<{ friendId: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [friend, setFriend] = useState<FriendInfo | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const init = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setUserId(me);
    if (!me) {
      setLoading(false);
      return;
    }

    const [{ data: friendRow }, { data: friendship }] = await Promise.all([
      supabase
        .from("profiles")
        .select("nickname, avatar, manner_score, meetups_joined_count")
        .eq("id", params.friendId)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("status")
        .eq("pair_key", pairKey(me, params.friendId))
        .maybeSingle(),
    ]);

    if (!friendRow) {
      setLoading(false);
      return;
    }
    setFriend({
      nickname: friendRow.nickname,
      avatarUrl: friendRow.avatar,
      score: friendRow.manner_score,
      meetupsJoined: friendRow.meetups_joined_count,
    });

    const accepted = friendship?.status === "accepted";
    setIsFriend(accepted);
    if (!accepted) {
      setLoading(false);
      return;
    }

    const { data: messageRows } = await supabase
      .from("direct_messages")
      .select("id, sender_id, content, created_at")
      .eq("pair_key", pairKey(me, params.friendId))
      .order("created_at", { ascending: true });

    setMessages(
      (messageRows ?? []).map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        content: m.content,
        createdAt: m.created_at,
      }))
    );
    setLoading(false);
  }, [params.friendId]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!userId || !isFriend) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dm-${[userId, params.friendId].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };
          const belongsToPair =
            (row.sender_id === userId && row.receiver_id === params.friendId) ||
            (row.sender_id === params.friendId && row.receiver_id === userId);
          if (!belongsToPair) return;
          setMessages((prev) => [
            ...prev,
            { id: row.id, senderId: row.sender_id, content: row.content, createdAt: row.created_at },
          ]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isFriend, params.friendId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !userId) return;
    setSending(true);
    setError(null);
    const supabase = createClient();
    const { error: sendError } = await supabase
      .from("direct_messages")
      .insert({ sender_id: userId, receiver_id: params.friendId, content: input.trim() });
    if (sendError) {
      console.error("direct_messages insert error:", sendError);
      setError(`전송에 실패했어요. (${sendError.message})`);
    } else {
      setInput("");
    }
    setSending(false);
  }

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  if (!friend) {
    return <main className="container" style={{ paddingTop: "40px" }}>존재하지 않는 깐부예요.</main>;
  }

  if (!isFriend) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 800 }}>깐부 사이에서만 채팅할 수 있어요</p>
          <Link href={`/profile/${params.friendId}`} className="btn btn-outline" style={{ marginTop: "16px", width: "100%" }}>
            프로필로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const tier = getMannerTier(friend.score, friend.meetupsJoined);

  return (
    <main className="chat-page">
      <div className="chat-pinned-card">
        <Link href={`/profile/${params.friendId}`} style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}>
          <ParticipantAvatar avatarUrl={friend.avatarUrl} tier={tier} size={36} />
          <div>
            <p style={{ fontWeight: 800, fontSize: "14px" }}>{friend.nickname}</p>
            <p style={{ fontSize: "12px", fontWeight: 700, color: tier.color }}>{tier.label}</p>
          </div>
        </Link>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "13px", marginTop: "12px" }}>
            아직 대화가 없어요. 첫 메시지를 보내보세요!
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === userId;
          return (
            <div key={m.id} className={`chat-row ${mine ? "chat-row-mine" : ""}`}>
              {!mine && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
                  <div className="chat-avatar-small">
                    {friend.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={friend.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span>📍</span>
                    )}
                  </div>
                  <div className="chat-bubble">{m.content}</div>
                </div>
              )}
              {mine && <div className="chat-bubble chat-bubble-mine">{m.content}</div>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="chat-composer">
        <input
          className="field-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요"
          maxLength={500}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
          전송
        </button>
      </form>
      {error && <p style={{ color: "var(--danger)", fontSize: "12px", padding: "0 20px" }}>{error}</p>}
    </main>
  );
}
