import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const phoneKey = (p: string) => p.replace(/\D/g, "").replace(/^0/, "27");

/** Parent self-service: link an additional child with admission number + surname + birth date as proof. */
export const claimMyChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { admissionNo: string; surname: string; dob: string }) => ({
    admissionNo: String(input?.admissionNo ?? "").trim().slice(0, 40),
    surname: String(input?.surname ?? "").trim().slice(0, 80),
    dob: DATE.test(input?.dob ?? "") ? input.dob : "",
  }))
  .handler(async ({ data, context }) => {
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    if (!data.admissionNo || !data.surname || !data.dob)
      throw new Error("Enter the admission number, surname and birth date exactly as the school has them");
    const { data: found } = await admin.from("students").select("id, school_id, first_name, last_name, date_of_birth").eq("admission_no", data.admissionNo).is("deleted_at", null).limit(5);
    const student = (found ?? []).find((s) => s.last_name.toLowerCase() === data.surname.toLowerCase() && s.date_of_birth === data.dob);
    if (!student) throw new Error("No learner matches that admission number, surname and birth date — please confirm with the school office");

    const claims = context.claims as Record<string, unknown>;
    const email = String(claims["email"] ?? "").toLowerCase() || null;
    const phone = String(claims["phone"] ?? "") || null;

    let { data: prow } = await admin.from("parents").select("id").eq("user_id", context.userId).limit(1);
    let parentId = prow?.[0]?.id;
    if (!parentId) {
      // Adopt an unclaimed school record that matches the verified email or phone.
      const { data: unclaimed } = await admin.from("parents").select("id, email, phone, whatsapp_number").eq("school_id", student.school_id).is("user_id", null).limit(500);
      const match = (unclaimed ?? []).find((p) =>
        (email && p.email?.toLowerCase() === email) ||
        (phone && [p.phone, p.whatsapp_number].some((n) => n && phoneKey(n) === phoneKey(phone))));
      if (match) {
        await admin.from("parents").update({ user_id: context.userId }).eq("id", match.id);
        parentId = match.id;
      } else {
        const { data: np, error } = await admin.from("parents")
          .insert({ school_id: student.school_id, user_id: context.userId, full_name: String(claims["name"] ?? "") || "Parent", email, phone, whatsapp_number: phone })
          .select("id").single();
        if (error) throw new Error(error.message);
        parentId = np!.id;
      }
    }

    const { data: role } = await admin.from("user_roles").select("id").eq("user_id", context.userId).eq("school_id", student.school_id).eq("role", "parent").limit(1);
    if (!role?.length) {
      const { error } = await admin.from("user_roles").insert({ user_id: context.userId, school_id: student.school_id, role: "parent" });
      if (error) throw new Error(error.message);
    }
    const { error: linkErr } = await admin.from("parent_student")
      .upsert({ school_id: student.school_id, parent_id: parentId!, student_id: student.id, relationship: "Guardian", is_primary: false }, { onConflict: "parent_id,student_id", ignoreDuplicates: true });
    if (linkErr) throw new Error(linkErr.message);
    await admin.from("audit_logs").insert({ actor_id: context.userId, actor_email: email, school_id: student.school_id, action: "parent_self_claim", details: { student_id: student.id } });
    return { ok: true, studentName: `${student.first_name} ${student.last_name}` };
  });

/** Parent reports an absence for one of their children; recorded as excused with the guardian's reason. */
export const reportAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string; date: string; reason: string; detail?: string }) => ({
    studentId: String(input?.studentId ?? ""),
    date: DATE.test(input?.date ?? "") ? input.date : "",
    reason: String(input?.reason ?? "").slice(0, 80),
    detail: String(input?.detail ?? "").slice(0, 300),
  }))
  .handler(async ({ data, context }) => {
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    if (!data.date) throw new Error("Choose the day of the absence");
    if (data.date > new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)) throw new Error("Absences can be reported at most two weeks ahead");
    const { data: parentIds } = await admin.from("parent_student").select("parent_id").eq("student_id", data.studentId);
    if (!parentIds?.length) throw new Error("This learner is not linked to your account");
    const { data: link } = await admin.from("parents").select("id").in("id", parentIds.map((p) => p.parent_id)).eq("user_id", context.userId).limit(1);
    if (!link?.length) throw new Error("This learner is not linked to your account");
    const { data: stu } = await admin.from("students").select("school_id, class_id").eq("id", data.studentId).single();
    if (!stu) throw new Error("Learner not found");
    const { data: existing } = await admin.from("attendance_records").select("status").eq("student_id", data.studentId).eq("date", data.date).maybeSingle();
    if (existing) return { already: true as const, status: existing.status };
    const claims = context.claims as Record<string, unknown>;
    const note = `${String(claims["name"] ?? "") || "Guardian"} reported: ${data.reason}${data.detail ? " — " + data.detail : ""}`;
    const { error } = await admin.from("attendance_records")
      .insert({ school_id: stu.school_id, student_id: data.studentId, class_id: stu.class_id, date: data.date, status: "excused", note, marked_by: context.userId });
    if (error) throw new Error(error.message);
    await admin.from("audit_logs").insert({ actor_id: context.userId, actor_email: String(claims["email"] ?? "") || null, school_id: stu.school_id, action: "parent_absence_report", details: { student_id: data.studentId, date: data.date, reason: data.reason } });
    return { already: false as const, ok: true };
  });
