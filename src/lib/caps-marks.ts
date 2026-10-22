/**
 * CAPS / NPPPR mark rules, mirroring SA-SAMS: weighted marks are TRUNCATED
 * (never rounded up) to a whole percentage, so 49.6% is 49%, matching the official record.
 */
export type Phase = "foundation" | "intermediate" | "senior" | "fet";

export function phaseForGrade(grade: number): Phase {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

/** SBA share of the final mark per phase (exam share = 1 - sba). */
export const SBA_WEIGHT: Record<Phase, number> = { foundation: 1, intermediate: 0.75, senior: 0.4, fet: 0.25 };

/** SA-SAMS style truncation; small epsilon guards float error (e.g. 50 stored as 49.9999999). */
export function truncatePct(x: number): number {
  return Math.floor(x + 1e-9);
}

export function finalMark(sbaPct: number, examPct: number | null, grade: number): number {
  const w = SBA_WEIGHT[phaseForGrade(grade)];
  if (examPct == null || w === 1) return truncatePct(sbaPct);
  return truncatePct(sbaPct * w + examPct * (1 - w));
}

/** DBE 7-point achievement scale. */
export function achievementLevel(pct: number): number {
  const p = truncatePct(pct);
  return p >= 80 ? 7 : p >= 70 ? 6 : p >= 60 ? 5 : p >= 50 ? 4 : p >= 40 ? 3 : p >= 30 ? 2 : 1;
}
