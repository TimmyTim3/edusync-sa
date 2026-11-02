export type AssessmentStatus = "draft" | "checked" | "locked";

export function assessmentStatus(checkedAt: string | null, lockedAt: string | null): AssessmentStatus {
  if (lockedAt) return "locked";
  if (checkedAt) return "checked";
  return "draft";
}
