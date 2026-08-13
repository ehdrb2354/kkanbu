"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { REPORT_REASONS, ReportReasonKey, ReportTargetType } from "../lib/reportReasons";

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  label?: string;
  compact?: boolean;
  className?: string;
};

export default function ReportButton({ targetType, targetId, targetLabel, label, compact, className }: Props) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReasonKey | null>(null);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, [open]);

  const isSelf = targetType === "user" && userId === targetId;

  function openSheet() {
    setReason(null);
    setDetail("");
    setDone(false);
    setError(null);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!userId || !reason) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_type: targetType,
      target_id: targetId,
      reason,
      detail: detail.trim(),
    });
    if (insertError) {
      setError("신고 접수에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } else {
      setDone(true);
    }
    setSubmitting(false);
  }

  return (
    <>
      <button
        type="button"
        className={className ?? "report-trigger"}
        onClick={openSheet}
        aria-label="신고하기"
      >
        {label ?? (compact ? "🚩" : "🚩 신고하기")}
      </button>

      {open && (
        <div className="filter-sheet-overlay" onClick={() => setOpen(false)}>
          <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="filter-sheet-header">
              <p style={{ fontWeight: 800, fontSize: "16px" }}>🚩 신고하기</p>
              <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>

            {done ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ fontSize: "32px" }}>✅</p>
                <p style={{ fontWeight: 700, marginTop: "8px" }}>신고가 접수됐어요</p>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
                  운영팀이 확인 후 필요한 조치를 취할게요.
                </p>
                <button className="btn btn-primary" style={{ marginTop: "16px", width: "100%" }} onClick={() => setOpen(false)}>
                  확인
                </button>
              </div>
            ) : isSelf ? (
              <p style={{ fontSize: "13px", color: "var(--muted)", padding: "8px 0" }}>
                자기 자신은 신고할 수 없어요.
              </p>
            ) : (
              <>
                {targetLabel && (
                  <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
                    신고 대상: <strong style={{ color: "var(--text)" }}>{targetLabel}</strong>
                  </p>
                )}

                <div className="filter-sheet-group">
                  <p className="filter-sheet-group-title">신고 사유를 선택해 주세요</p>
                  <div className="filter-chip-grid">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        className="filter-chip"
                        data-active={reason === r.key}
                        onClick={() => setReason(r.key)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="field-input"
                  style={{ width: "100%", minHeight: "72px", marginTop: "4px", resize: "vertical" }}
                  placeholder="자세한 내용을 적어주시면 처리에 도움이 돼요 (선택)"
                  maxLength={500}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />

                {error && <p style={{ color: "var(--danger)", fontSize: "12px", marginTop: "8px" }}>{error}</p>}

                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ width: "100%", marginTop: "14px" }}
                  disabled={!reason || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "접수 중..." : "신고 제출"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
