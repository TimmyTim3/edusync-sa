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
