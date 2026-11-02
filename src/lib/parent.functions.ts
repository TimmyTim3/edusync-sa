import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const phoneKey = (p: string) => p.replace(/\D/g, "").replace(/^0/, "27");

/** Parent self-service: link an additional child with admission number + surname + birth date as proof. */
const RELS = ["Mother", "Father", "Guardian", "Grandmother", "Grandfather", "Aunt", "Uncle", "Sibling", "Foster parent", "Other"];
export const claimMyChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { admissionNo: string; surname: string; dob: string; relationship?: string }) => ({
    relationship: RELS.includes(String(input?.relationship)) ? String(input.relationship) : "Guardian",
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
      .upsert({ school_id: student.school_id, parent_id: parentId!, student_id: student.id, relationship: data.relationship, is_primary: false }, { onConflict: "parent_id,student_id", ignoreDuplicates: true });
    if (linkErr) throw new Error(linkErr.message);
    await admin.from("audit_logs").insert({ actor_id: context.userId, actor_email: email, school_id: student.school_id, action: "parent_self_claim", details: { student_id: student.id } });
    return { ok: true, studentName: `${student.first_name} ${student.last_name}` };
  });

/** Parent reports an absence for one of their children; recorded as excused with the guardian's reason and medical cert if attached. */
export const reportAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string; date: string; reason: string; detail?: string; certificateBase64?: string }) => ({
    studentId: String(input?.studentId ?? ""),
    date: DATE.test(input?.date ?? "") ? input.date : "",
    reason: String(input?.reason ?? "").slice(0, 80),
    detail: String(input?.detail ?? "").slice(0, 300),
    certificateBase64: input?.certificateBase64 ? String(input.certificateBase64).slice(0, 350000) : undefined,
  }))
  .handler(async ({ data, context }) => {
    if (!data.date) throw new Error("Choose the day of the absence");
    if (data.date > new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)) throw new Error("Absences can be reported at most two weeks ahead");
    // Step 1: prove the link using the parent's OWN session (works on any host, RLS-scoped).
    const { data: myParents, error: pErr } = await context.supabase.from("parents").select("id").eq("user_id", context.userId);
    if (pErr) throw new Error(`Could not check your parent profile: ${pErr.message}`);
    const myIds = (myParents ?? []).map((p) => p.id);
    if (!myIds.length) throw new Error("This learner is not linked to your account");
    const { data: link, error: lErr } = await context.supabase.from("parent_student").select("id").eq("student_id", data.studentId).in("parent_id", myIds).limit(1);
    if (lErr) throw new Error(`Could not check the learner link: ${lErr.message}`);
    if (!link?.length) throw new Error("This learner is not linked to your account");
    // Step 2: privileged writes need the server admin key; report clearly when the host lacks it.
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) throw new Error("The school server is not fully configured to save absence reports on this website. Please use the official EduSync address or contact the school.");
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: stu } = await admin.from("students").select("school_id, class_id").eq("id", data.studentId).single();
    if (!stu) throw new Error("Learner not found");
    const { data: existing } = await admin.from("attendance_records").select("status").eq("student_id", data.studentId).eq("date", data.date).maybeSingle();
    if (existing) return { already: true as const, status: existing.status };
    
    const claims = context.claims as Record<string, unknown>;
    const parentName = String(claims["name"] ?? "") || "Guardian";

    // Upload compressed certificate to cloud storage if provided
    let certUrl = "";
    if (data.certificateBase64) {
      try {
        const raw = data.certificateBase64.replace(/^data:image\/\w+;base64,/, "");
        const binaryStr = atob(raw);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const path = `${stu.school_id}/${data.studentId}/${data.date}-${Date.now()}.jpg`;
        const { error: upErr } = await admin.storage
          .from("medical-certificates")
          .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        if (!upErr) {
          const { data: pub } = admin.storage.from("medical-certificates").getPublicUrl(path);
          certUrl = pub.publicUrl;
        }
      } catch {
        // Continue gracefully even if storage bucket is not yet provisioned
      }
    }

    const note = `${parentName} reported: ${data.reason}${data.detail ? " — " + data.detail : ""}${certUrl ? ` [Medical note: ${certUrl}]` : ""}`;
    
    // Save to daily attendance register
    const { error } = await admin.from("attendance_records")
      .insert({ school_id: stu.school_id, student_id: data.studentId, class_id: stu.class_id, date: data.date, status: "excused", note, marked_by: context.userId });
    if (error) throw new Error(error.message);

    // Also mirror to Front Office absence reports table so clerks and reception see it
    await admin.from("absence_reports").insert({
      school_id: stu.school_id,
      student_id: data.studentId,
      absence_date: data.date,
      reason: `${data.reason}${data.detail ? ` (${data.detail})` : ""}${certUrl ? " [Dr Note Attached]" : ""}`,
      reported_by: parentName,
      channel: "parent_portal",
      logged_by: context.userId,
    });

    await admin.from("audit_logs").insert({
      actor_id: context.userId,
      actor_email: String(claims["email"] ?? "") || null,
      school_id: stu.school_id,
      action: "parent_absence_report",
      details: { student_id: data.studentId, date: data.date, reason: data.reason, has_certificate: !!certUrl }
    });
    return { already: false as const, ok: true };
  });
          
