"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import { getMannerTier } from "../lib/mannerTier";
import ParticipantAvatar from "../components/ParticipantAvatar";
import { useOnlinePresence } from "../lib/notifications";

type FriendProfile = {
  id: string;
  nickname: string;
  avatar: string | null;
  manner_score: number;
  meetups_joined_count: number;
};

type IncomingRequest = {
  id: string;
  requester: FriendProfile;
};

type Friend = {
  friendshipId: string;
  profile: FriendProfile;
};

export default function KkanbuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myCode, setMyCode] = useState("");
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { onlineUserIds } = useOnlinePresence();

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    setUserId(uid);

    const [{ data: profile }, { data: incomingRows }, { data: friendRows }] = await Promise.all([
      supabase.from("profiles").select("friend_code").eq("id", uid).single(),
      supabase
        .from("friendships")
        .select("id, requester:profiles!friendships_requester_id_fkey(id, nickname, avatar, manner_score, meetups_joined_count)")
        .eq("addressee_id", uid)
        .eq("status", "pending"),
      supabase
        .from("friendships")
        .select(
          "id, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, nickname, avatar, manner_score, meetups_joined_count), addressee:profiles!friendships_addressee_id_fkey(id, nickname, avatar, manner_score, meetups_joined_count)"
        )
        .eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
    ]);
    setMyCode(profile?.friend_code ?? "");

    setIncoming(
      (incomingRows ?? []).map((row) => {
        const r = row as unknown as { id: string; requester: FriendProfile | FriendProfile[] };
        const requester = Array.isArray(r.requester) ? r.requester[0] : r.requester;
        return { id: r.id, requester };
      })
    );

    setFriends(
      (friendRows ?? []).map((row) => {
        const r = row as unknown as {
          id: string;
          requester_id: string;
          requester: FriendProfile | FriendProfile[];
          addressee: FriendProfile | FriendProfile[];
        };
        const isMeRequester = r.requester_id === uid;
        const raw = isMeRequester ? r.addressee : r.requester;
        const profile = Array.isArray(raw) ? raw[0] : raw;
        return { friendshipId: r.id, profile };
      })
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("kkanbu-friendships")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  async function handleRespond(requestId: string, accept: boolean) {
    const supabase = createClient();
    await supabase.rpc("respond_friend_request", { request_id: requestId, accept });
    load();
  }

  async function handleCopyCode() {
    if (!myCode) return;
    await navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return <main className="container" style={{ paddingTop: "40px" }}>불러오는 중...</main>;
  }

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 800 }}>🤝 나의 깐부</h1>
        <button
          onClick={() => setAddOpen(true)}
          aria-label="깐부 추가"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "none",
            background: "var(--primary-dark)",
            color: "#fff",
            fontSize: "20px",
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>내 깐부 코드</p>
          <p style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "1px" }}>{myCode}</p>
        </div>
        <button className="btn btn-outline" style={{ padding: "8px 14px", fontSize: "12px" }} onClick={handleCopyCode}>
          {copied ? "복사됨!" : "복사"}
        </button>
      </div>

      {incoming.length > 0 && (
        <div className="card" style={{ marginTop: "16px" }}>
          <p style={{ fontWeight: 800, marginBottom: "12px" }}>새로운 깐부 요청</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {incoming.map((req) => {
              const tier = getMannerTier(req.requester.manner_score, req.requester.meetups_joined_count);
              return (
                <div key={req.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <ParticipantAvatar avatarUrl={req.requester.avatar} tier={tier} size={40} />
                    <p style={{ fontWeight: 700 }}>{req.requester.nickname}</p>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => handleRespond(req.id, true)}
                    >
                      수락
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => handleRespond(req.id, false)}
                    >
                      거절
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "16px" }}>
        <p style={{ fontWeight: 800, marginBottom: "12px" }}>내 깐부 목록 ({friends.length})</p>
        {friends.length > 0 && (
          <input
            className="field-input"
            style={{ marginBottom: "12px" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="깐부 이름으로 검색"
          />
        )}
        {friends.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>
            아직 깐부가 없어요. 오른쪽 위 + 버튼을 눌러서 깐부 코드로 추가해보세요!
          </p>
        ) : (
          (() => {
            const filtered = friends.filter((f) =>
              f.profile.nickname.toLowerCase().includes(query.trim().toLowerCase())
            );
            if (filtered.length === 0) {
              return (
                <p style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center" }}>
                  검색 결과가 없어요.
                </p>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filtered.map((f) => {
                  const tier = getMannerTier(f.profile.manner_score, f.profile.meetups_joined_count);
                  const online = onlineUserIds.has(f.profile.id);
                  return (
                    <div key={f.friendshipId} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Link
                        href={`/profile/${f.profile.id}`}
                        style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, textDecoration: "none", color: "inherit" }}
                      >
                        <div style={{ position: "relative" }}>
                          <ParticipantAvatar avatarUrl={f.profile.avatar} tier={tier} size={40} />
                          <span
                            title={online ? "온라인" : "오프라인"}
                            style={{
                              position: "absolute",
                              top: -2,
                              left: -2,
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: online ? "#22c55e" : "#9ca3af",
                              border: "2px solid #fff",
                            }}
                          />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700 }}>{f.profile.nickname}</p>
                          <p style={{ fontSize: "12px", fontWeight: 700, color: tier.color }}>{tier.label}</p>
                        </div>
                      </Link>
                      <Link
                        href={`/dm/${f.profile.id}`}
                        aria-label={`${f.profile.nickname}와 채팅하기`}
                        className="btn btn-outline"
                        style={{ padding: "8px 10px", fontSize: "14px" }}
                      >
                        💬
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>

      {addOpen && <AddFriendModal onClose={() => setAddOpen(false)} onDone={load} />}
    </main>
  );
}

function AddFriendModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const RESULT_MESSAGES: Record<string, string> = {
    requested: "요청을 보냈어요!",
    accepted: "이미 상대가 요청을 보내둔 상태여서 바로 깐부가 됐어요!",
    already_friends: "이미 깐부인 사이예요.",
    already_requested: "이미 요청을 보낸 상태예요.",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setMessage(null);
    setIsError(false);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("send_friend_request", { target_code: code.trim() });
    if (error) {
      setIsError(true);
      setMessage(error.message.includes("찾을 수 없어요") || error.message.includes("추가할 수 없어요") ? error.message : "요청에 실패했어요.");
    } else {
      setMessage(RESULT_MESSAGES[data as string] ?? "완료했어요.");
      setCode("");
      onDone();
    }
    setSubmitting(false);
  }

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="filter-sheet-header">
          <p style={{ fontWeight: 800, fontSize: "16px" }}>깐부 추가하기</p>
          <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={onClose}>
            닫기
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "14px" }}>
          상대방의 깐부 코드를 입력하면 친구 요청을 보낼 수 있어요.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px" }}>
          <input
            className="field-input"
            style={{ flex: 1 }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="깐부 코드 입력 (예: A1B2C3D4)"
            maxLength={20}
          />
          <button className="btn btn-primary" disabled={submitting || !code.trim()}>
            {submitting ? "확인 중..." : "요청 보내기"}
          </button>
        </form>

        {message && (
          <p style={{ color: isError ? "var(--danger)" : "var(--primary-dark)", fontSize: "13px", marginTop: "12px" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
