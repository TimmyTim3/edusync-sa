/** Normalise SA mobile numbers (072 123 4567, 27721234567, +27…) to E.164, or null if invalid. */
export function toE164SA(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (/^0[6-8]\d{8}$/.test(d)) return `+27${d.slice(1)}`;
  if (/^27[6-8]\d{8}$/.test(d)) return `+${d}`;
  if (/^[6-8]\d{8}$/.test(d)) return `+27${d}`;
  return null;
}
