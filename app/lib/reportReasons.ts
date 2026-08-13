export type ReportReasonKey = "inappropriate" | "abuse" | "spam" | "other";

export type ReportTargetType = "user" | "meetup" | "message";

export const REPORT_REASONS: { key: ReportReasonKey; label: string }[] = [
  { key: "inappropriate", label: "부적절한 내용" },
  { key: "abuse", label: "욕설/비방" },
  { key: "spam", label: "광고/스팸" },
  { key: "other", label: "기타" },
];
