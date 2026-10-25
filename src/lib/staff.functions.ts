import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeSaPhone, mapStaffRole } from "./staff-normalize";

export type StaffRow = { title?: string; full_name: string; staff_no?: string; phone?: string; email: string; department?: string; role?: string };
export type StaffResult = { email: string; ok: boolean; message: string };

/** Principal: create staff logins for their own school and give them the right role. */
export const bulkIngestStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { schoolId: string; rows: StaffRow[] }) => {
    if (!input?.schoolId || !Array.isArray(input.rows)) throw new Error("Invalid input");
    if (input.rows.length > 500) throw new Error("Maximum 500 staff per upload");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Caller must be the principal (school admin) of this school — checked as the user, through RLS.
    const { data: mine } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("school_id", data.schoolId).eq("role", "school_admin");
    if (!mine?.length) throw new Error("Only the principal of this school can add staff");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: StaffResult[] = [];
    for (const r of data.rows) {
      const email = String(r.email ?? "").trim().toLowerCase();
      const name = String(r.full_name ?? "").trim().slice(0, 120);
      const role = mapStaffRole(r.role);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) { out.push({ email, ok: false, message: "Missing name or valid email" }); continue; }
      if (!role) { out.push({ email, ok: false, message: `Role "${r.role}" not supported yet` }); continue; }
      const phone = normalizeSaPhone(r.phone ?? "");
      let uid: string | null = null;
      const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existing) uid = existing.id;
      else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
        if (error || !created.user) { out.push({ email, ok: false, message: error?.message ?? "Could not create login" }); continue; }
        uid = created.user.id;
      }
      await supabaseAdmin.from("profiles").upsert({ id: uid, email, full_name: [r.title, name].filter(Boolean).join(" "), phone: phone || null, school_id: data.schoolId });
      const { data: has } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", uid).eq("school_id", data.schoolId).eq("role", role);
      if (!has?.length) await supabaseAdmin.from("user_roles").insert({ user_id: uid, school_id: data.schoolId, role });
      out.push({ email, ok: true, message: existing ? "Already had a login — role added" : "Login created" });
    }
    await supabaseAdmin.from("audit_logs").insert({ actor_email: String(context.claims["email"] ?? ""), action: "bulk_staff_ingest", details: { school_id: data.schoolId, added: out.filter((o) => o.ok).length } });
    return out;
  });
