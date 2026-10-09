/** Shared, client-safe normalisers for South African school export formats. */
export type AttStatus = "present" | "absent" | "late" | "excused" | "half_day";

export function normStatus(v: string): AttStatus | null {
  const s = v.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (["p", "present", "/", "1", "yes", "y"].includes(s)) return "present";
  if (["a", "absent", "x", "0", "no", "n", "abs", "unexcused"].includes(s)) return "absent";
  if (["l", "late", "laat"].includes(s)) return "late";
  if (["e", "excused", "authorised", "authorized", "medical", "sick", "m", "ex"].includes(s)) return "excused";
  if (["h", "half", "half day", "hd"].includes(s)) return "half_day";
  return null;
}

/** Maps SASA levels (1–5) and common words onto low / medium / high. */
export function normSeverity(v: string): "low" | "medium" | "high" {
  const s = v.trim().toLowerCase();
  const n = Number(s.replace(/\D/g, ""));
  if (n >= 4 || /serious|high|severe|major|critical|level\s*[45]/.test(s)) return "high";
  if (n === 3 || /medium|moderate|level\s*3/.test(s)) return "medium";
  if (/medium|moderate/.test(s)) return "medium";
  return n === 2 ? "medium" : "low";
}

export function toISODate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(s)) return s.slice(0, 10).replace(/\//g, "-");
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : "";
}

/** SASA-style behaviour levels: 1 = minor … 5 = most serious / exceptional. */
export const SASA_LEVELS = [
  { level: 1, points: 5, severity: "low", merit: "Level 1 · Good effort", demerit: "Level 1 · Minor (e.g. late, no homework)" },
  { level: 2, points: 10, severity: "low", merit: "Level 2 · Commendable", demerit: "Level 2 · Repeated minor / disruption" },
  { level: 3, points: 15, severity: "medium", merit: "Level 3 · Outstanding", demerit: "Level 3 · Serious (e.g. defiance, bunking)" },
  { level: 4, points: 20, severity: "high", merit: "Level 4 · Excellence award", demerit: "Level 4 · Very serious (e.g. fighting, theft)" },
  { level: 5, points: 25, severity: "high", merit: "Level 5 · Exceptional honour", demerit: "Level 5 · Gross misconduct (SGB hearing)" },
] as const;

export function levelPoints(level: number, positive: boolean): number {
  const l = SASA_LEVELS[Math.min(5, Math.max(1, Math.round(level))) - 1]!;
  return positive ? l.points : -l.points;
}
