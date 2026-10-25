/** South African phone to +27 format; returns "" when it can't be a valid SA number. */
export function normalizeSaPhone(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0027")) d = d.slice(4);
  else if (d.startsWith("27")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^[1-8]\d{8}$/.test(d) ? `+27${d}` : "";
}

/** Map a staff role from a spreadsheet to an app role; null = not supported yet. */
export function mapStaffRole(raw: string | undefined): "teacher" | "school_admin" | "clerk" | null {
  const r = String(raw ?? "teacher").trim().toLowerCase();
  if (/clerk|reception|front office|admin assistant|secretary/.test(r)) return "clerk";
  if (!r || /teacher|educator|hod|head of dep|subject/.test(r)) return "teacher";
  if (/principal|deputy|admin/.test(r) && !/clerk/.test(r)) return "school_admin";
  return null;
}
