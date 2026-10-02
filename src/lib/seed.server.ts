import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

const DEMO_DOMAIN = "demo-edusync.school";
export type Credential = { role: string; label: string; email: string; password: string };
export type SeedSummary = Record<string, string | number>;
export type SeedInput = { size: "small" | "large"; name?: string; phase: "start" | "attendance" | "marks" | "finish"; schoolId?: string; jobId?: string; chunk: number };

function randomPassword() {
  return "Demo#" + Math.random().toString(36).slice(2, 8) + "2026";
}

export async function runSeedPhase(supabaseAdmin: SupabaseClient<Database>, data: SeedInput, email: string) {
    let jobId = data.jobId;
    let schoolId = data.schoolId;

    try {
      if (data.phase === "start") {
        const { data: job, error: jobError } = await supabaseAdmin.from("seed_jobs").insert({ status: "running", size: data.size }).select("id").single();
        if (jobError || !job) throw new Error(jobError?.message ?? "Could not start demo");
        jobId = job.id;
        const { data: base, error } = await supabaseAdmin.rpc("seed_demo_school_base", { p_size: data.size, ...(data.name ? { p_name: data.name } : {}) });
        if (error) throw new Error(error.message);
        schoolId = String((base as SeedSummary)["school_id"]);
        await supabaseAdmin.from("seed_jobs").update({ school_id: schoolId, summary: base as Json }).eq("id", jobId);
        return { schoolId, jobId, summary: base as SeedSummary, credentials: [] as Credential[] };
      }
      if (!schoolId || !jobId || !/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error("Invalid demo job");
      const { data: job } = await supabaseAdmin.from("seed_jobs").select("school_id,status,summary,size").eq("id", jobId).single();
      if (!job || job.school_id !== schoolId || job.status !== "running" || job.size !== data.size) throw new Error("Demo job is unavailable");
      const sid: string = schoolId;
      if (data.phase === "attendance") {
        const start = new Date(); start.setUTCDate(start.getUTCDate() - (data.size === "large" ? 40 : 30) + data.chunk * 3);
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + 2);
        const { error } = await supabaseAdmin.rpc("seed_demo_attendance_chunk", { p_school: schoolId, p_from: start.toISOString().slice(0,10), p_to: end.toISOString().slice(0,10) });
        if (error) throw new Error(error.message);
        return { schoolId, jobId, summary: job.summary as SeedSummary, credentials: [] as Credential[] };
      }
      if (data.phase === "marks") {
        const { error } = await supabaseAdmin.rpc("seed_demo_marks_chunk", { p_school: schoolId, p_from: data.chunk * 5 + 1, p_to: data.chunk * 5 + 5 });
        if (error) throw new Error(error.message);
        return { schoolId, jobId, summary: job.summary as SeedSummary, credentials: [] as Credential[] };
      }
      const result = job.summary as SeedSummary;
      // Small schools get a sub-domain so the main demo logins stay on the big school.
      const domain = data.size === "large" ? DEMO_DOMAIN : `small.${DEMO_DOMAIN}`;
      const credentials: Credential[] = [];

      // Collect existing auth users on the demo domain so re-seeding re-uses the same emails.
      const existing = new Map<string, string>();
      for (let page = 1; page <= 10; page++) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        for (const u of list?.users ?? []) if (u.email) existing.set(u.email.toLowerCase(), u.id);
        if (!list || list.users.length < 1000) break;
      }

      const makeUser = async (localPart: string, fullName: string) => {
        const pwd = randomPassword();
        const userEmail = `${localPart}@${domain}`;
        const old = existing.get(userEmail);
        if (old) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", old);
          await supabaseAdmin.from("parents").update({ user_id: null }).eq("user_id", old);
          await supabaseAdmin.auth.admin.deleteUser(old);
        }
        const { data: created, error: err } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password: pwd,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (err || !created.user) throw new Error(err?.message ?? "Could not create demo user");
        return { id: created.user.id, email: userEmail, password: pwd, fullName };
      };

      const linkUser = async (
        u: { id: string; email: string; fullName: string },
        role: "school_admin" | "teacher" | "parent",
      ) => {
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: u.id, school_id: sid, full_name: u.fullName, email: u.email });
        await supabaseAdmin.from("user_roles").insert({ user_id: u.id, school_id: sid, role });
      };

      const principal = await makeUser("principal", "Dr Nomsa Khumalo");
      await linkUser(principal, "school_admin");
      credentials.push({
        role: "Principal / School Admin",
        label: principal.fullName,
        email: principal.email,
        password: principal.password,
      });

      const { data: classes } = await supabaseAdmin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name")
        .limit(4);
      const { data: subjects } = await supabaseAdmin
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId);

      const teacherSpecs = [
        { local: "maths.head", name: "Mr Sipho Dlamini", subject: "Mathematics" },
        { local: "teacher1", name: "Mrs Lerato Mokoena", subject: "English" },
        { local: "teacher2", name: "Mr Kyle Petersen", subject: "Physical Sciences" },
      ];
      for (const spec of teacherSpecs) {
        const t = await makeUser(spec.local, spec.name);
        await linkUser(t, "teacher");
        const subject = (subjects ?? []).find((s) => s.name === spec.subject) ?? (subjects ?? [])[0];
        if (subject && classes?.length) {
          for (const c of classes) {
            await supabaseAdmin
              .from("class_subject_teachers")
              .delete()
              .eq("class_id", c.id)
              .eq("subject_id", subject.id);
          }
          await supabaseAdmin.from("class_subject_teachers").insert(
            classes.map((c) => ({
              school_id: sid,
              class_id: c.id,
              subject_id: subject.id,
              teacher_id: t.id,
            })),
          );
        }
        credentials.push({
          role: `Teacher — ${spec.subject}`,
          label: spec.name,
          email: t.email,
          password: t.password,
        });
      }

      const { data: links } = await supabaseAdmin
        .from("parent_student")
        .select("parent_id")
        .eq("school_id", schoolId)
        .limit(5000);
      const counts = new Map<string, number>();
      for (const l of links ?? []) counts.set(l.parent_id, (counts.get(l.parent_id) ?? 0) + 1);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const multi = sorted.filter(([, n]) => n >= 2 && n <= 4).slice(0, 7);
      const single = sorted.filter(([, n]) => n === 1).slice(0, 3);
      const chosen = [...multi, ...single];

      let i = 1;
      for (const [parentId, childCount] of chosen) {
        const { data: parentRow } = await supabaseAdmin
          .from("parents")
          .select("full_name")
          .eq("id", parentId)
          .single();
        const name = parentRow?.full_name ?? `Parent ${i}`;
        const p = await makeUser(`parent${i}`, name);
        await linkUser(p, "parent");
        await supabaseAdmin.from("parents").update({ user_id: p.id, email: p.email }).eq("id", parentId);
        credentials.push({
          role: `Parent — ${childCount} ${childCount === 1 ? "child" : "children"}`,
          label: name,
          email: p.email,
          password: p.password,
        });
        i += 1;
      }

      const count = async (table: "attendance_records" | "marks") => {
        const { count: n } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).eq("school_id", sid);
        return n ?? 0;
      };
      result["attendance_records"] = await count("attendance_records");
      result["marks"] = await count("marks");
      await supabaseAdmin
        .from("seed_jobs")
        .update({
          status: "complete",
          school_id: schoolId,
          summary: result as Json,
          credentials: credentials as unknown as Json,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      await supabaseAdmin.from("audit_logs").insert({
        actor_email: email,
        school_id: schoolId,
        action: "seed_demo_school",
        details: result as Json,
      });

      return { summary: result, credentials, schoolId, jobId };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Seeding failed";
      await supabaseAdmin
        .from("seed_jobs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", jobId ?? "");
      throw new Error(message);
    }
}
