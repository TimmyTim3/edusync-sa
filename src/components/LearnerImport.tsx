import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLearners, type ImportRow } from "@/lib/import.functions";

const ALIASES: Record<keyof ImportRow, string[]> = {
  first_name: ["first name", "firstname", "name", "first", "given name"],
  last_name: ["last name", "lastname", "surname", "family name"],
  admission_no: ["admission no", "admission number", "admission", "learner number", "student id", "id"],
  grade: ["grade", "gr"],
  class_name: ["class", "class name", "section", "register class"],
  date_of_birth: ["date of birth", "dob", "birth date", "birthday"],
  gender: ["gender", "sex"],
};
const key = (h: string) => h.toLowerCase().replace(/[_\-.]/g, " ").replace(/\s+/g, " ").trim();

function toDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : "";
}

function mapRows(raw: Record<string, unknown>[]): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of raw) {
    const get = (f: keyof ImportRow) => {
      const k = Object.keys(r).find((h) => ALIASES[f].includes(key(h)) || key(h) === f.replace("_", " "));
      return k ? r[k] : undefined;
    };
    let first = String(get("first_name") ?? "").trim();
    let last = String(get("last_name") ?? "").trim();
    if (first && !last && first.includes(" ")) { const p = first.split(" "); last = p.pop()!; first = p.join(" "); }
    const row: ImportRow = {
      first_name: first, last_name: last,
      admission_no: String(get("admission_no") ?? "").trim(),
      grade: String(get("grade") ?? "").trim(),
      class_name: String(get("class_name") ?? "").trim(),
      date_of_birth: toDate(get("date_of_birth")),
      gender: String(get("gender") ?? "").trim(),
    };
    if (row.first_name && row.last_name && row.admission_no && row.grade) rows.push(row); else skipped++;
  }
  return { rows, skipped };
}

async function readFile(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "json") {
    const j = JSON.parse(await file.text());
    return Array.isArray(j) ? j : (j.learners ?? j.students ?? []);
  }
  if (ext === "pdf") throw new Error("PDF files can't be read reliably. Open the PDF, save or export it as Excel or CSV, then import that file.");
  const XLSX = await import("xlsx");
  const wb = ext === "csv" || ext === "tsv" || ext === "txt"
    ? XLSX.read(await file.text(), { type: "string", cellDates: true })
    : XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function LearnerImport({ schools }: { schools: { id: string; name: string }[] }) {
  const run = useServerFn(importLearners);
  const [school, setSchool] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = mapRows(await readFile(f));
      setRows(parsed.rows); setSkipped(parsed.skipped);
      if (!parsed.rows.length) toast.error("No learners found. Columns needed: first name, surname, admission number, grade.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read file"); }
  };

  const submit = async () => {
    if (!school || !rows.length) return;
    setBusy(true);
    try {
      let saved = 0, created = 0;
      for (let i = 0; i < rows.length; i += 1000) {
        const r = await run({ data: { schoolId: school, rows: rows.slice(i, i + 1000) } });
        saved += r.saved; created += r.createdClasses;
      }
      toast.success(`${saved} learners imported${created ? `, ${created} new classes created` : ""}`);
      setRows([]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div><h2 className="font-display text-xl font-semibold">Import learners</h2>
        <p className="text-sm text-muted-foreground">Excel (.xlsx, .xls), CSV, TSV, text, OpenDocument (.ods) or JSON. Needed columns: first name, surname, admission number and grade. Optional: class, date of birth, gender. Learners with an existing admission number are updated, not duplicated.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <select aria-label="School to import into" className="h-10 rounded-md border bg-background px-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Choose a school</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-card text-sm">
          <Upload className="h-4 w-4" /> Choose file
          <input type="file" className="sr-only" accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.json,.pdf" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      </div>
      {rows.length > 0 && <>
        <p className="text-sm">{rows.length} learners ready{skipped ? ` · ${skipped} rows skipped (missing name, admission number or grade)` : ""}. Preview of the first 10:</p>
        <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground"><tr>{["Admission", "Name", "Grade", "Class", "Birth date", "Gender"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 10).map((r) => <tr key={r.admission_no} className="border-t"><td className="p-2 font-mono text-xs">{r.admission_no}</td><td className="p-2">{r.first_name} {r.last_name}</td><td className="p-2">{r.grade}</td><td className="p-2">{r.class_name || "A"}</td><td className="p-2">{r.date_of_birth || "—"}</td><td className="p-2">{r.gender || "—"}</td></tr>)}</tbody>
        </table></div>
        <Button disabled={!school || busy} onClick={() => void submit()}>{busy ? "Importing…" : `Import ${rows.length} learners`}</Button>
      </>}
    </div>
  );
}
