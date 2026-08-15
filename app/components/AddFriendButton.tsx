"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { pairKey } from "../lib/pairKey";

type Status = "loading" | "none" | "pending" | "accepted";

// 모임 멤버 목록(모임 상세 / 깐부톡 멤버 탭)에서 상대 유저 id로 바로 친구 추가하는 버튼.
export default function AddFriendButton({ targetId }: { targetId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    const { data } = await supabase
      .from("friendships")
      .select("status, requester_id")
      .eq("pair_key", pairKey(uid, targetId))
      .maybeSingle();

    if (!data) setStatus("none");
    else if (data.status === "accepted") setStatus("accepted");
    else setStatus(data.requester_id === uid ? "pending" : "none");
  }, [targetId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    setSubmitting(true);
    const supabase = createClient();
    await supabase.rpc("send_friend_request_by_id", { target_id: targetId });
    await load();
    setSubmitting(false);
  }

  if (status === "loading") return null;

  if (status === "accepted") {
    return <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>🤝 깐부</span>;
  }

  if (status === "pending") {
    return <span style={{ fontSize: "12px", color: "var(--muted)", whiteSpace: "nowrap" }}>요청됨</span>;
  }

  return (
    <button
      className="btn btn-outline"
      style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
      onClick={handleAdd}
      disabled={submitting}
    >
      {submitting ? "..." : "🤝 깐부 추가"}
    </button>
  );
}
