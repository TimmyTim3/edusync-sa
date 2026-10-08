import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normStatus, normSeverity } from "./import-normalize";

const opt = (n: number) => z.string().trim().max(n).optional().default("");
const Row = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  admission_no: z.string().trim().min(1).max(40),
  grade: z.string().trim().min(1).max(20),
  class_name: opt(40),
  date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gender: opt(20),
  parent_name: opt(120),
  parent_phone: opt(30),
  parent_email: opt(160),
  relationship: opt(40),
});
export type ImportRow = z.input<typeof Row>;

const AttRow = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), admission_no: z.string().trim().min(1).max(40), status: z.string().trim().min(1).max(20), reason: opt(300) });
const BehRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), admission_no: z.string().trim().min(1).max(40),
  category: z.string().trim().min(1).max(80), severity: opt(30), points: z.number().int().min(-100).max(100),
  notes: opt(1000), action_taken: opt(300),
});
export type AttendanceRow = z.input<typeof AttRow>;
export type BehaviourRow = z.input<typeof BehRow>;
export type RowIssue = { row: number; admission_no: string; reason: string };

const ADMIN = "timmytim691@gmail.com";
async function guard(claims: unknown, schoolId: string) {
  const email = String((claims as Record<string, unknown>)["email"] ?? "").toLowerCase();
  if (email !== ADMIN) throw new Error("Access restricted to authorised platform administrator only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: school } = await supabaseAdmin.from("schools").select("id").eq("id", schoolId).single();
  if (!school) throw new Error("School not found");
  return { db: supabaseAdmin, email };
}
const phoneKey = (p: string) => p.replace(/\D/g, "").replace(/^27/, "0");

/** Imports learners; creates missing classes; updates learners with the same admission number; links parents by phone/email. */
export const importLearners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ schoolId: z.string().uuid(), rows: z.array(Row).min(1).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { db, email } = await guard(context.claims, data.schoolId);
    const sid = data.schoolId;
    const norm = (g: string) => g.replace(/^(grade|gr)\s*/i, "").toUpperCase();
    const { data: existing } = await db.from("classes").select("id, name").eq("school_id", sid);
    const classMap = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    let createdClasses = 0;
    const classIdFor = async (gradeRaw: string, cls: string) => {
      const grade = norm(gradeRaw);
      const section = (cls.replace(new RegExp(`^((grade|gr)\\s*)?${grade}`, "i"), "").trim() || "A").toUpperCase();
      const name = `Grade ${grade}${section}`;
      const hit = classMap.get(name.toLowerCase());
      if (hit) return hit;
      const { data: c, error } = await db.from("classes").insert({ school_id: sid, grade, section, name }).select("id").single();
      if (error || !c) throw new Error(error?.message ?? "Could not create class");
      classMap.set(name.toLowerCase(), c.id);
      createdClasses++;
      return c.id;
    };

    const seen = new Map<string, (typeof data.rows)[number]>();
    for (const r of data.rows) seen.set(r.admission_no.toUpperCase(), r);
    const uniq = [...seen.values()];
    const records = [];
    for (const r of uniq) {
      records.push({
        school_id: sid, class_id: await classIdFor(r.grade, r.class_name ?? ""), admission_no: r.admission_no,
        first_name: r.first_name, last_name: r.last_name, date_of_birth: r.date_of_birth || null, gender: r.gender || null,
      });
    }
    const idByAdm = new Map<string, string>();
    for (let i = 0; i < records.length; i += 500) {
      const { data: up, error } = await db.from("students").upsert(records.slice(i, i + 500), { onConflict: "school_id,admission_no" }).select("id, admission_no");
      if (error) throw new Error(error.message);
      for (const s of up ?? []) idByAdm.set(s.admission_no.toUpperCase(), s.id);
    }

    // Parent linking
    const withParent = uniq.filter((r) => r.parent_name && (r.parent_phone || r.parent_email));
    let parentsCreated = 0, parentsLinked = 0;
    if (withParent.length) {
      const { data: ps } = await db.from("parents").select("id, phone, email").eq("school_id", sid).limit(20000);
      const byPhone = new Map<string, string>(), byEmail = new Map<string, string>();
      for (const p of ps ?? []) { if (p.phone) byPhone.set(phoneKey(p.phone), p.id); if (p.email) byEmail.set(p.email.toLowerCase(), p.id); }
      const links: { school_id: string; parent_id: string; student_id: string; relationship: string; is_primary: boolean }[] = [];
      for (const r of withParent) {
        const ph = r.parent_phone ? phoneKey(r.parent_phone) : "", em = (r.parent_email ?? "").toLowerCase();
        let pid = (ph && byPhone.get(ph)) || (em && byEmail.get(em)) || "";
        if (!pid) {
          const { data: np, error } = await db.from("parents").insert({ school_id: sid, full_name: r.parent_name!, phone: r.parent_phone || null, whatsapp_number: r.parent_phone || null, email: em || null }).select("id").single();
          if (error || !np) throw new Error(error?.message ?? "Could not create parent");
          pid = np.id; parentsCreated++;
          if (ph) byPhone.set(ph, pid); if (em) byEmail.set(em, pid);
        }
        const stu = idByAdm.get(r.admission_no.toUpperCase());
        if (stu) links.push({ school_id: sid, parent_id: pid, student_id: stu, relationship: r.relationship || "Parent", is_primary: true });
      }
      for (let i = 0; i < links.length; i += 500) {
        const { error } = await db.from("parent_student").upsert(links.slice(i, i + 500), { onConflict: "parent_id,student_id" });
        if (error) throw new Error(error.message);
      }
      parentsLinked = links.length;
    }
    await db.from("audit_logs").insert({ actor_email: email, school_id: sid, action: "import_learners", details: { rows: records.length, createdClasses, parentsCreated, parentsLinked } });
    return { saved: records.length, duplicatesInFile: data.rows.length - uniq.length, createdClasses, parentsCreated, parentsLinked };
  });

async function studentLookup(db: Awaited<ReturnType<typeof guard>>["db"], sid: string, adms: string[]) {
  const map = new Map<string, { id: string; class_id: string | null }>();
  const list = [...new Set(adms)];
  for (let i = 0; i < list.length; i += 300) {
    const { data } = await db.from("students").select("id, class_id, admission_no").eq("school_id", sid).is("deleted_at", null).in("admission_no", list.slice(i, i + 300));
    for (const s of data ?? []) map.set(s.admission_no.toUpperCase(), { id: s.id, class_id: s.class_id });
  }
  return map;
}

/** Imports past attendance (Date, Admission_No, Status, Reason). Same learner + date is updated, not duplicated. */
export const importAttendanceHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ schoolId: z.string().uuid(), rows: z.array(AttRow).min(1).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { db, email } = await guard(context.claims, data.schoolId);
    const map = await studentLookup(db, data.schoolId, data.rows.map((r) => r.admission_no));
    const issues: RowIssue[] = [];
    const recs = new Map<string, { school_id: string; student_id: string; class_id: string; date: string; status: "present" | "absent" | "late" | "excused" | "half_day"; note: string | null }>();
    data.rows.forEach((r, i) => {
      const s = map.get(r.admission_no.toUpperCase());
      const status = normStatus(r.status);
      if (!s) return issues.push({ row: i + 2, admission_no: r.admission_no, reason: "Admission number not found — import learners first" });
      if (!s.class_id) return issues.push({ row: i + 2, admission_no: r.admission_no, reason: "Learner has no class" });
      if (!status) return issues.push({ row: i + 2, admission_no: r.admission_no, reason: `Unknown status "${r.status}"` });
      recs.set(`${s.id}|${r.date}`, { school_id: data.schoolId, student_id: s.id, class_id: s.class_id, date: r.date, status, note: r.reason || null });
      return 0;
    });
    const all = [...recs.values()];
    for (let i = 0; i < all.length; i += 500) {
      const { error } = await db.from("attendance_records").upsert(all.slice(i, i + 500), { onConflict: "student_id,date" });
      if (error) throw new Error(error.message);
    }
    await db.from("audit_logs").insert({ actor_email: email, school_id: data.schoolId, action: "import_attendance_history", details: { saved: all.length, rejected: issues.length } });
    return { saved: all.length, issues: issues.slice(0, 200), rejected: issues.length };
  });

/** Imports past behaviour (Date, Admission_No, Category, Severity, Points, Notes, Action_Taken). Records are permanent. */
export const importBehaviourHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ schoolId: z.string().uuid(), rows: z.array(BehRow).min(1).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { db, email } = await guard(context.claims, data.schoolId);
    const map = await studentLookup(db, data.schoolId, data.rows.map((r) => r.admission_no));
    const issues: RowIssue[] = [];
    const recs = [];
    for (const [i, r] of data.rows.entries()) {
      const s = map.get(r.admission_no.toUpperCase());
      if (!s) { issues.push({ row: i + 2, admission_no: r.admission_no, reason: "Admission number not found — import learners first" }); continue; }
      const positive = r.points > 0 || /merit|commend|award/i.test(r.severity ?? "");
      const note = [r.notes, r.action_taken ? `Action taken: ${r.action_taken}` : ""].filter(Boolean).join(" — ") || r.category;
      recs.push({
        school_id: data.schoolId, student_id: s.id, category: r.category, is_positive: positive,
        severity: normSeverity(r.severity ?? ""), points: r.points, note, parent_visible: true,
        created_at: `${r.date}T08:00:00+02:00`,
      });
    }
    for (let i = 0; i < recs.length; i += 500) {
      const { error } = await db.from("behaviour_notes").insert(recs.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    await db.from("audit_logs").insert({ actor_email: email, school_id: data.schoolId, action: "import_behaviour_history", details: { saved: recs.length, rejected: issues.length } });
    return { saved: recs.length, issues: issues.slice(0, 200), rejected: issues.length };
  });
