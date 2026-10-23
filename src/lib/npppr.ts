/**
 * NPPPR promotion & condonation rules (National Policy Pertaining to the
 * Programme and Promotion Requirements, DBE/NPPPPR 2016).
 *
 * Input percentages are FINAL subject marks — already SBA/exam weighted and
 * SA-SAMS truncated via caps-marks.finalMark — so this engine never re-weights
 * or re-rounds a mark.
 */
import { phaseForGrade, truncatePct, type Phase } from "./caps-marks";

export type SubjectRole = "hl" | "fal" | "maths" | "other";

export type SubjectResult = { subject: string; pct: number | null };

export type PromotionOutcome = {
  grade: number;
  phase: Phase;
  promoted: boolean;
  /** FET only: everything else passed, one subject failed — may be condoned per Umalusi. */
  condonationPossible: boolean;
  /** Subjects sitting below their minimum requirement. */
  failed: string[];
  /** Human-readable unmet requirements (empty = meets all promotion requirements). */
  reasons: string[];
};

/** Maps an SA subject name onto its NPPPR role. */
export function classifySubject(name: string): SubjectRole {
  const n = (name ?? "").toLowerCase();
  if (/first additional|second additional|(?<![a-z])fal(?![a-z])/.test(n)) return "fal";
  if (/home language|(?<![a-z])hl(?![a-z])/.test(n)) return "hl";
  if (/mathematical literacy|maths literacy|wiskunde geletterd/.test(n)) return "other";
  if (/mathematic|wiskunde/.test(n)) return "maths";
  return "other";
}

const best = (xs: SubjectResult[]): SubjectResult | undefined =>
  xs.filter((r) => r.pct != null).reduce<SubjectResult | undefined>((a, b) => (!a || b.pct! > a.pct! ? b : a), undefined);

export function evaluatePromotion(results: SubjectResult[], grade: number): PromotionOutcome {
  const phase = phaseForGrade(grade);
  const base = { grade, phase, failed: [] as string[], reasons: [] as string[] };

  // Grade R promotes informally.
  if (grade === 0) return { ...base, promoted: true, condonationPossible: false, reasons: ["Grade R promotes informally."] };

  if (phase === "foundation") {
    const reqs: [SubjectRole, number, string][] = [
      ["hl", 50, "Home Language 50%"],
      ["fal", 40, "First Additional Language 40%"],
      ["maths", 40, "Mathematics 40%"],
    ];
    for (const [role, min, label] of reqs) {
      const xs = results.filter((r) => classifySubject(r.subject) === role);
      const top = best(xs);
      if (!top) { if (role !== "fal") base.reasons.push(`${label} — no results captured`); continue; }
      if (truncatePct(top.pct!) < min) base.reasons.push(`${label} (best ${truncatePct(top.pct!)}%)`);
    }
    return { ...base, promoted: base.reasons.length === 0, condonationPossible: false, failed: base.reasons.flatMap((r) => results.filter((x) => x.pct != null && r.startsWith(x.subject) && truncatePct(x.pct!) < 40).map((x) => x.subject)) };
  }

  if (phase === "intermediate" || phase === "senior") {
    const hlMin = phase === "senior" ? 50 : 40;
    const core: [SubjectRole, number, string][] = [
      ["hl", hlMin, `Home Language ${hlMin}%`],
      ["fal", 40, "First Additional Language 40%"],
      ["maths", 40, "Mathematics 40%"],
    ];
    for (const [role, min, label] of core) {
      const xs = results.filter((r) => classifySubject(r.subject) === role);
      const top = best(xs);
      if (!top) { if (role !== "fal") base.reasons.push(`${label} — no results captured`); continue; }
      if (truncatePct(top.pct!) < min) base.reasons.push(`${label} (best ${truncatePct(top.pct!)}%)`);
    }
    const rest = results.filter((r) => classifySubject(r.subject) === "other" && r.pct != null);
    const at40 = rest.filter((r) => truncatePct(r.pct!) >= 40);
    if (at40.length < 2) base.reasons.push(`Needs 2 more subjects at 40%+ (has ${at40.length})`);
    const at40Set = new Set(at40.slice(0, 2).map((r) => r.subject));
    const at30 = rest.filter((r) => !at40Set.has(r.subject) && truncatePct(r.pct!) >= 30);
    if (at30.length < 3) base.reasons.push(`Needs 3 more subjects at 30%+ (has ${at30.length})`);
    return { ...base, promoted: base.reasons.length === 0, condonationPossible: false, failed: results.filter((r) => r.pct != null && truncatePct(r.pct!) < 30).map((r) => r.subject) };
  }

  // FET (Grades 10–12)
  const graded = results.filter((r) => r.pct != null);
  const at40 = graded.filter((r) => truncatePct(r.pct!) >= 40);
  const hasHl40 = at40.some((r) => classifySubject(r.subject) === "hl");
  if (at40.length < 3 || !hasHl40) base.reasons.push(`Needs 3 subjects at 40%+, including Home Language (has ${at40.length}${hasHl40 ? "" : ", no Home Language"})`);
  const at40Set = new Set(at40.map((r) => r.subject));
  const at30 = graded.filter((r) => !at40Set.has(r.subject) && truncatePct(r.pct!) >= 30);
  const hasFal30 = at30.some((r) => classifySubject(r.subject) === "fal");
  if (at30.length < 2 || (graded.some((r) => classifySubject(r.subject) === "fal") && !hasFal30))
    base.reasons.push(`Needs 2 more subjects at 30%+, including First Additional Language (has ${at30.length})`);
  const failed = graded.filter((r) => truncatePct(r.pct!) < 30).map((r) => r.subject);
  if (failed.length > 1) base.reasons.push(`Fails ${failed.length} subjects — only one may be condoned`);
  if (results.some((r) => r.pct == null)) base.reasons.push("Some subjects have no results captured yet");
  const condonationPossible = failed.length === 1 && base.reasons.every((r) => !r.startsWith("Needs") && !r.startsWith("Some") && !r.startsWith("Fails"));
  return { ...base, promoted: base.reasons.length === 0 && failed.length === 0, condonationPossible, failed, reasons: base.reasons };
}
