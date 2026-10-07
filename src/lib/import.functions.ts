import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Row = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  admission_no: z.string().trim().min(1).max(40),
  grade: z.string().trim().min(1).max(20),
  class_name: z.string().trim().max(40).optional().default(""),
  date_of_birth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gender: z.string().trim().max(20).optional().default(""),
});
export type ImportRow = z.input<typeof Row>;

/** Imports learners into a school; creates missing classes; updates learners with the same admission number. */
export const importLearners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ schoolId: z.string().uuid(), rows: z.array(Row).min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = String((context.claims as Record<string, unknown>)["email"] ?? "").toLowerCase();
    if (email !== "timmytim691@gmail.com") throw new Error("Access restricted to authorised platform administrator only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sid = data.schoolId;
    const { data: school } = await supabaseAdmin.from("schools").select("id").eq("id", sid).single();
    if (!school) throw new Error("School not found");

    const norm = (g: string) => g.replace(/^grade\s*/i, "").toUpperCase();
    const { data: existing } = await supabaseAdmin.from("classes").select("id, name, grade").eq("school_id", sid);
    const classMap = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    let createdClasses = 0;
    const classIdFor = async (gradeRaw: string, cls: string) => {
      const grade = norm(gradeRaw);
      const section = (cls.replace(new RegExp(`^(grade\\s*)?${grade}`, "i"), "").trim() || "A").toUpperCase();
      const name = `Grade ${grade}${section}`;
      const hit = classMap.get(name.toLowerCase());
      if (hit) return hit;
      const { data: c, error } = await supabaseAdmin.from("classes").insert({ school_id: sid, grade, section, name }).select("id").single();
      if (error || !c) throw new Error(error?.message ?? "Could not create class");
      classMap.set(name.toLowerCase(), c.id);
      createdClasses++;
      return c.id;
    };

    const records = [];
    for (const r of data.rows) {
      records.push({
        school_id: sid,
        class_id: await classIdFor(r.grade, r.class_name ?? ""),
        admission_no: r.admission_no,
        first_name: r.first_name,
        last_name: r.last_name,
        date_of_birth: r.date_of_birth || null,
        gender: r.gender || null,
      });
    }
    let saved = 0;
    for (let i = 0; i < records.length; i += 500) {
      const { error, count } = await supabaseAdmin
        .from("students")
        .upsert(records.slice(i, i + 500), { onConflict: "school_id,admission_no", count: "exact" });
      if (error) throw new Error(error.message);
      saved += count ?? 0;
    }
    await supabaseAdmin.from("audit_logs").insert({ actor_email: email, school_id: sid, action: "import_learners", details: { rows: records.length, createdClasses } });
    return { saved: saved || records.length, createdClasses };
  });
