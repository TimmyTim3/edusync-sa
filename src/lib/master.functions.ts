import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORM_ADMIN_EMAIL = "timmytim691@gmail.com";

type Credential = { role: string; label: string; email: string; password: string };

function randomPassword() {
  return "Demo#" + Math.random().toString(36).slice(2, 8) + "2026";
}

async function assertPlatformAdmin(claims: Record<string, unknown>) {
  const email = String(claims["email"] ?? "").toLowerCase();
  if (email !== PLATFORM_ADMIN_EMAIL) {
    throw new Error("Access restricted to authorised platform administrator only");
  }
  return email;
}

/** Seeds a full demo school (database generation + real demo logins). */
export const seedDemoSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { size: "small" | "large"; name?: string }) => input)
  .handler(async ({ data, context }) => {
    const email = await assertPlatformAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: job } = await supabaseAdmin
      .from("seed_jobs")
      .insert({ status: "running", size: data.size })
      .select("id")
      .single();

    try {
      const { data: summary, error } = await supabaseAdmin.rpc("seed_demo_school", {
        p_size: data.size,
        p_name: data.name ?? null,
      });
      if (error) throw new Error(error.message);

      const result = summary as Record<string, unknown>;
      const schoolId = String(result["school_id"]);
      const stamp = Math.random().toString(36).slice(2, 6);
      const domain = `demo${stamp}.edusync.school`;
      const credentials: Credential[] = [];

      const makeUser = async (localPart: string, fullName: string) => {
        const pwd = randomPassword();
        const userEmail = `${localPart}@${domain}`;
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
          .upsert({ id: u.id, school_id: schoolId, full_name: u.fullName, email: u.email });
        await supabaseAdmin.from("user_roles").insert({ user_id: u.id, school_id: schoolId, role });
      };

      // Principal
      const principal = await makeUser("principal", "Dr Nomsa Khumalo");
      await linkUser(principal, "school_admin");
      credentials.push({
        role: "Principal / School Admin",
        label: principal.fullName,
        email: principal.email,
        password: principal.password,
      });

      // Teachers (assigned to real classes)
      const { data: classes } = await supabaseAdmin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .limit(6);
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
          await supabaseAdmin.from("class_subject_teachers").insert(
            classes.map((c) => ({
              school_id: schoolId,
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

      // Parents: prefer ones with most children
      const { data: links } = await supabaseAdmin
        .from("parent_student")
        .select("parent_id")
        .eq("school_id", schoolId)
        .limit(4000);
      const counts = new Map<string, number>();
      for (const l of links ?? []) counts.set(l.parent_id, (counts.get(l.parent_id) ?? 0) + 1);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const multi = sorted.filter(([, n]) => n >= 2).slice(0, 7);
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
        await supabaseAdmin
          .from("parents")
          .update({ user_id: p.id, email: p.email })
          .eq("id", parentId);
        credentials.push({
          role: `Parent — ${childCount} ${childCount === 1 ? "child" : "children"}`,
          label: name,
          email: p.email,
          password: p.password,
        });
        i += 1;
      }

      await supabaseAdmin
        .from("seed_jobs")
        .update({
          status: "complete",
          school_id: schoolId,
          summary: result,
          credentials,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job?.id ?? "");

      await supabaseAdmin.from("audit_logs").insert({
        actor_email: email,
        school_id: schoolId,
        action: "seed_demo_school",
        details: result,
      });

      return { summary: result, credentials, schoolId };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Seeding failed";
      await supabaseAdmin
        .from("seed_jobs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", job?.id ?? "");
      throw new Error(message);
    }
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = await assertPlatformAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: demoSchools } = await supabaseAdmin.from("schools").select("id").eq("is_demo", true);
    const ids = (demoSchools ?? []).map((s) => s.id);
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id").in("school_id", ids);
      for (const p of profiles ?? []) {
        await supabaseAdmin.auth.admin.deleteUser(p.id).catch(() => undefined);
      }
      await supabaseAdmin.from("schools").delete().in("id", ids);
    }
    await supabaseAdmin.from("seed_jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin
      .from("audit_logs")
      .insert({ actor_email: email, action: "clear_demo_data", details: { schools: ids.length } });
    return { removed: ids.length };
  });

export const platformStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: string) => {
      const { count: c } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true });
      return c ?? 0;
    };
    const [schools, students, parents, attendance, marks, notices] = await Promise.all([
      count("schools"),
      count("students"),
      count("parents"),
      count("attendance_records"),
      count("marks"),
      count("notices"),
    ]);
    return { schools, students, parents, attendance, marks, notices };
  });
