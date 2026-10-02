import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const PLATFORM_ADMIN_EMAIL = "timmytim691@gmail.com";
const DEMO_DOMAIN = "demo-edusync.school";

export type Credential = { role: string; label: string; email: string; password: string };
export type SeedSummary = Record<string, string | number>;

function randomPassword() {
  return "Demo#" + Math.random().toString(36).slice(2, 8) + "2026";
}

function assertPlatformAdmin(claims: Record<string, unknown>) {
  const email = String(claims["email"] ?? "").toLowerCase();
  if (email !== PLATFORM_ADMIN_EMAIL) {
    throw new Error("Access restricted to authorised platform administrator only");
  }
  return email;
}

/** Seeds a full demo school (database generation + real demo logins). */
export const seedDemoSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { size: "small" | "large"; name?: string; phase?: "start" | "attendance" | "marks" | "finish"; schoolId?: string; jobId?: string; chunk?: number }) => ({
    size: input.size === "small" ? ("small" as const) : ("large" as const),
    name: input.name?.slice(0, 120),
    phase: input.phase ?? "start", schoolId: input.schoolId, jobId: input.jobId, chunk: input.chunk ?? 0,
  }))
  .handler(async ({ data, context }) => {
    const email = assertPlatformAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runSeedPhase } = await import("./seed.server");
    return runSeedPhase(supabaseAdmin, data, email);
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = assertPlatformAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: demoSchools } = await supabaseAdmin.from("schools").select("id").eq("is_demo", true);
    const ids = (demoSchools ?? []).map((s) => s.id);
    // Remove every demo login (they all live on the demo domain).
    for (let page = 1; page <= 10; page++) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of list?.users ?? []) {
        if (u.email?.toLowerCase().endsWith(DEMO_DOMAIN)) await supabaseAdmin.auth.admin.deleteUser(u.id);
      }
      if (!list || list.users.length < 1000) break;
    }
    if (ids.length) {
      const { error } = await supabaseAdmin.rpc("clear_demo_data");
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin
      .from("audit_logs")
      .insert({ actor_email: email, action: "clear_demo_data", details: { schools: ids.length } });
    return { removed: ids.length };
  });

type CountTable = "schools" | "students" | "parents" | "attendance_records" | "marks" | "notices" | "profiles";

export const platformStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertPlatformAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: CountTable) => {
      const { count: c } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
      return c ?? 0;
    };
    const [schools, students, parents, attendance, marks, notices, staff] = await Promise.all([
      count("schools"),
      count("students"),
      count("parents"),
      count("attendance_records"),
      count("marks"),
      count("notices"),
      count("profiles"),
    ]);
    return { schools, students, parents, attendance, marks, notices, staff };
  });
