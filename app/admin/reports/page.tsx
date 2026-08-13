"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { REPORT_REASONS } from "../../lib/reportReasons";

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: "user" | "meetup" | "message";
  target_id: string;
  reason: string;
  detail: string;
  status: string;
  created_at: string;
  reporterNickname: string;
  targetLabel: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "대기중", color: "var(--muted)" },
  reviewed: { label: "검토완료", color: "var(--primary-dark)" },
  dismissed: { label: "반려됨", color: "var(--muted)" },
  actioned: { label: "제재완료", color: "var(--danger)" },
};

const TARGET_LABEL: Record<string, string> = {
  user: "유저",
  meetup: "모임",
  message: "메시지",
};

export default function AdminReportsPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setChecking(false);
      return;
    }

    const { data: myProfile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!myProfile?.is_admin) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setIsAdmin(true);

    const { data: reportRows } = await supabase
      .from("reports")
      .select("id, reporter_id, target_type, target_id, reason, detail, status, created_at, reporter:profiles(nickname)")
      .order("created_at", { ascending: false });

    const rows = reportRows ?? [];

    const userTargetIds = rows.filter((r) => r.target_type === "user").map((r) => r.target_id);
    const meetupTargetIds = rows.filter((r) => r.target_type === "meetup").map((r) => r.target_id);

    const userLabels: Record<string, string> = {};
    if (userTargetIds.length > 0) {
      const { data: userProfiles } = await supabase.from("profiles").select("id, nickname").in("id", userTargetIds);
      (userProfiles ?? []).forEach((p) => (userLabels[p.id] = p.nickname));
    }

    const meetupLabels: Record<string, string> = {};
    if (meetupTargetIds.length > 0) {
      const { data: meetups } = await supabase.from("meetups").select("id, title").in("id", meetupTargetIds);
      (meetups ?? []).forEach((m) => (meetupLabels[m.id] = m.title));
    }

    setReports(
      rows.map((r) => {
        const reporterRow = r.reporter as unknown as { nickname: string } | { nickname: string }[] | null;
        const reporter = Array.isArray(reporterRow) ? reporterRow[0] : reporterRow;
        let targetLabel = "알 수 없음";
        if (r.target_type === "user") targetLabel = userLabels[r.target_id] ?? "탈퇴했거나 알 수 없는 유저";
        else if (r.target_type === "meetup") targetLabel = meetupLabels[r.target_id] ?? "삭제된 모임";
        else targetLabel = "메시지 (내용은 폭파 정책에 따라 사라졌을 수 있어요)";

        return {
          id: r.id,
          reporter_id: r.reporter_id,
          target_type: r.target_type,
          target_id: r.target_id,
          reason: r.reason,
          detail: r.detail,
          status: r.status,
          created_at: r.created_at,
          reporterNickname: reporter?.nickname ?? "알 수 없음",
          targetLabel,
        };
      })
    );
    setChecking(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSanction(reportId: string) {
    setBusyId(reportId);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("apply_report_sanction", { report_id: reportId });
    if (rpcError) setError("제재 적용에 실패했어요: " + rpcError.message);
    setBusyId(null);
    load();
  }

  async function handleDismiss(reportId: string) {
    setBusyId(reportId);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", reportId);
    if (updateError) setError("반려 처리에 실패했어요.");
    setBusyId(null);
    load();
  }

  if (checking) {
    return <main className="container" style={{ paddingTop: "40px" }}>확인 중...</main>;
  }

  if (!isAdmin) {
    return (
      <main className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "32px" }}>🔒</p>
          <p style={{ fontWeight: 800, marginTop: "8px" }}>운영자만 볼 수 있는 화면이에요</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: "24px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "16px" }}>🚩 신고 관리</h1>

      {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

      {reports.length === 0 ? (
        <p style={{ color: "var(--muted)", textAlign: "center", marginTop: "40px" }}>접수된 신고가 없어요.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {reports.map((r) => {
            const status = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
            const reasonLabel = REPORT_REASONS.find((rr) => rr.key === r.reason)?.label ?? r.reason;
            const isPending = r.status === "pending";
            return (
              <div key={r.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="tag" style={{ background: `${status.color}22`, color: status.color }}>
                    {status.label}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{formatDateTime(r.created_at)}</span>
                </div>

                <p style={{ fontWeight: 800, marginTop: "10px" }}>
                  [{TARGET_LABEL[r.target_type]}] {r.targetLabel}
                </p>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
                  신고자: {r.reporterNickname} · 사유: {reasonLabel}
                </p>
                {r.detail && (
                  <p style={{ fontSize: "13px", marginTop: "8px", background: "var(--bg)", padding: "8px 10px", borderRadius: "10px" }}>
                    {r.detail}
                  </p>
                )}

                {isPending && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1, padding: "8px", fontSize: "12px" }}
                      disabled={busyId === r.id}
                      onClick={() => handleDismiss(r.id)}
                    >
                      반려
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ flex: 1, padding: "8px", fontSize: "12px" }}
                      disabled={busyId === r.id || r.target_type === "message"}
                      onClick={() => handleSanction(r.id)}
                    >
                      제재 적용
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
