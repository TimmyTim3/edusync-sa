import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  importLearners, importAttendanceHistory, importBehaviourHistory,
  type ImportRow, type AttendanceRow, type BehaviourRow, type RowIssue,
} from "@/lib/import.functions";
import { toISODate, levelPoints } from "@/lib/import-normalize";

type Mode = "learners" | "attendance" | "behaviour";
type Raw = Record<string, unknown>;
const key = (h: string) => h.toLowerCase().replace(/[_\-.#:]/g, " ").replace(/\s+/g, " ").trim();
const ADM = ["admission no", "admission number", "admission", "adm no", "learner number", "learner no", "student id", "accession no", "id"];

const ALIASES: Record<Mode, Record<string, string[]>> = {
  learners: {
    first_name: ["first name", "firstname", "name", "first", "given name", "names", "learner name"],
    last_name: ["last name", "lastname", "surname", "family name"],
    admission_no: ADM, grade: ["grade", "gr", "graad"], class_name: ["class", "class name", "section", "register class", "klas"],
    date_of_birth: ["date of birth", "dob", "birth date", "birthday"], gender: ["gender", "sex"],
    parent_name: ["parent name", "parent", "guardian", "guardian name", "parent guardian", "mother name", "father name", "contact name"],
    parent_phone: ["parent cell", "parent phone", "cell", "cellphone", "cell no", "mobile", "whatsapp", "parent whatsapp", "contact number", "guardian cell", "phone"],
    parent_email: ["parent email", "email", "guardian email", "e mail"], relationship: ["relationship", "relation"],
  },
  attendance: { date: ["date", "day"], admission_no: ADM, status: ["status", "attendance", "code", "mark"], reason: ["reason", "note", "notes", "comment"] },
  behaviour: {
    date: ["date", "incident date"], admission_no: ADM, category: ["category", "offence", "offence type", "incident", "merit", "type"],
    severity: ["severity", "level", "offence level", "sasa level"], points: ["points", "merits", "demerits", "score"],
    notes: ["notes", "note", "description", "incident summary", "details"], action_taken: ["action taken", "action", "sanction", "outcome"],
  },
};
const REQUIRED: Record<Mode, string[]> = {
  learners: ["first_name", "last_name", "admission_no", "grade"],
  attendance: ["date", "admission_no", "status"],
  behaviour: ["date", "admission_no", "category", "points"],
};
const TEMPLATES: Record<Mode, string> = {
  learners: "First Name,Surname,Admission No,Grade,Class,Date of Birth,Gender,Parent Name,Parent Cell,Parent Email,Relationship\nThabo,Mokoena,ADM-2023-412,10,A,2009-03-14,M,Lerato Mokoena,0821234567,lerato@example.com,Mother\n",
  attendance: "Date,Admission_No,Status,Reason\n2026-05-12,ADM-2023-412,A,Sick note\n2026-05-13,ADM-2023-412,P,\n2026-05-14,ADM-2023-412,L,Taxi delay\n",
  behaviour: 'Date,Admission_No,Category,Severity,Points,Notes,Action_Taken\n2026-05-12,ADM-2023-412,Disruption,medium,-5,"Talking during examination",Verbal Warning\n2026-06-02,ADM-2022-045,Fighting,serious,-20,"Physical fight at pavilion",SGB Hearing Scheduled\n2026-06-05,ADM-2023-412,Leadership,merit,10,"Led class cleanup",Commendation letter\n',
};
const INFO: Record<Mode, { title: string; text: string }> = {
  learners: { title: "Learners & parents", text: "Needed: first name, surname, admission number, grade. Optional: class, date of birth, gender, parent name, parent cell/WhatsApp, parent email, relationship. Existing admission numbers are updated; parents with the same cell number or email are reused and linked to every child." },
  attendance: { title: "Past attendance", text: "Needed: date, admission number, status (P / A / L / E / H or Present, Absent, Late, Excused, Half day). Optional: reason. Re-importing the same learner and date updates it." },
  behaviour: { title: "Past behaviour", text: "Needed: date, admission number, category, points (negative for demerits, positive for merits). Optional: severity (low/medium/serious or SASA level 1–5), notes, action taken. Imported notes are permanent and feed the disciplinary reports." },
};

const isComplete = (mode: Mode, o: Raw) => REQUIRED[mode].every((f) => o[f] !== "" && o[f] !== undefined && o[f] !== null);

function mapRows(mode: Mode, raw: Raw[]): { rows: Raw[]; bad: Raw[]; missing: string[] } {
  const headers = Object.keys(raw[0] ?? {});
  const col: Record<string, string | undefined> = {};
  for (const f of Object.keys(ALIASES[mode])) col[f] = headers.find((h) => ALIASES[mode][f]!.includes(key(h)) || key(h) === f.replace(/_/g, " "));
  const missing = REQUIRED[mode].filter((f) => !col[f] && !(mode === "learners" && f === "last_name" && col["first_name"]));
  const rows: Raw[] = [];
  const bad: Raw[] = [];
  for (const r of raw) {
    const o: Raw = {};
    for (const f of Object.keys(col)) o[f] = col[f] ? String(r[col[f]!] ?? "").trim() : "";
    { if (col["date"]) o["date"] = toISODate(r[col["date"]!]); if (col["date_of_birth"]) o["date_of_birth"] = toISODate(r[col["date_of_birth"]!]); }
    if (mode === "learners" && o["first_name"] && !o["last_name"] && String(o["first_name"]).includes(" ")) {
      const p = String(o["first_name"]).split(" "); o["last_name"] = p.pop(); o["first_name"] = p.join(" ");
    }
    if (mode === "behaviour") {
      const n = parseInt(String(o["points"]).replace(/[^\d-]/g, ""), 10);
      const lvl = Number(String(o["severity"]).replace(/\D/g, ""));
      o["points"] = !isNaN(n) ? n : lvl >= 1 && lvl <= 5 ? levelPoints(lvl, /merit|commend|award/i.test(String(o["category"]))) : "";
    }
    if (Object.values(o).every((v) => v === "")) continue;
    (isComplete(mode, o) ? rows : bad).push(o);
  }
  return { rows, bad, missing };
}

async function readFile(file: File): Promise<Raw[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "json") {
    const j = JSON.parse(await file.text());
    return Array.isArray(j) ? j : (j.learners ?? j.students ?? j.records ?? []);
  }
  if (ext === "docx") return tableToRows(await docxTable(file));
  if (ext === "pdf") return tableToRows(await pdfTable(file));
  const XLSX = await import("xlsx");
  const wb = ["csv", "tsv", "txt"].includes(ext ?? "")
    ? XLSX.read(await file.text(), { type: "string", cellDates: true })
    : XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Raw>(sheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd" });
}

function tableToRows(t: string[][]): Raw[] {
  const hi = t.findIndex((r) => r.filter((c) => c.trim()).length >= 2);
  if (hi < 0) throw new Error("No table found in this document.");
  const head = t[hi]!.map((h, i) => h.trim() || `Column ${i + 1}`);
  return t.slice(hi + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

async function docxTable(file: File): Promise<string[][]> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const doc = new DOMParser().parseFromString(value, "text/html");
  const tables = [...doc.querySelectorAll("table")];
  if (!tables.length) throw new Error("This Word document has no table. Put the learners in a Word table with a heading row.");
  const best = tables.sort((a, b) => b.rows.length - a.rows.length)[0]!;
  return [...best.rows].map((r) => [...r.cells].map((c) => c.textContent ?? ""));
}

async function pdfTable(file: File): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const lines = new Map<number, { x: number; w: number; s: string }[]>();
    for (const it of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]! / 3) * 3;
      (lines.get(y) ?? lines.set(y, []).get(y)!).push({ x: it.transform[4]!, w: it.width, s: it.str });
    }
    for (const y of [...lines.keys()].sort((a, b) => b - a)) {
      const parts = lines.get(y)!.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let lastEnd = -Infinity;
      for (const t of parts) {
        if (t.x - lastEnd > 8 || !cells.length) cells.push(t.s); else cells[cells.length - 1] += (t.x - lastEnd > 1 ? " " : "") + t.s;
        lastEnd = t.x + t.w;
      }
      out.push(cells);
    }
  }
  if (out.length > 1 && out[0]!.length < 2) throw new Error("Couldn't find table columns in this PDF. Export it as Excel or CSV instead.");
  return out;
}

export function LearnerImport({ schools }: { schools: { id: string; name: string }[] }) {
  const runL = useServerFn(importLearners);
  const runA = useServerFn(importAttendanceHistory);
  const runB = useServerFn(importBehaviourHistory);
  const [mode, setMode] = useState<Mode>("learners");
  const [school, setSchool] = useState("");
  const [rows, setRows] = useState<Raw[]>([]);
  const [bad, setBad] = useState<Raw[]>([]);
  const [bulk, setBulk] = useState({ field: "", value: "" });
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<RowIssue[]>([]);
  const [result, setResult] = useState("");

  const switchMode = (m: Mode) => { setMode(m); setRows([]); setIssues([]); setResult(""); setBad([]); };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setIssues([]); setResult("");
    try {
      const p = mapRows(mode, await readFile(f));
      if (p.missing.length) { setRows([]); toast.error(`Missing column(s): ${p.missing.join(", ").replace(/_/g, " ")}. Download the template to see the expected headings.`); return; }
      setRows(p.rows); setBad(p.bad);
      if (!p.rows.length && !p.bad.length) toast.error("No usable rows found in this file.");
      else if (p.bad.length) toast.warning(`${p.bad.length} rows need fixing before they can be imported.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read file"); }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATES[mode]], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `edusync-${mode}-template.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!school || !rows.length) return;
    setBusy(true);
    try {
      const all: RowIssue[] = [];
      let saved = 0, classes = 0, pc = 0, pl = 0, rejected = 0;
      for (let i = 0; i < rows.length; i += 1000) {
        const chunk = rows.slice(i, i + 1000);
        if (mode === "learners") {
          const r = await runL({ data: { schoolId: school, rows: chunk as unknown as ImportRow[] } });
          saved += r.saved; classes += r.createdClasses; pc += r.parentsCreated; pl += r.parentsLinked;
        } else {
          const r = mode === "attendance"
            ? await runA({ data: { schoolId: school, rows: chunk as unknown as AttendanceRow[] } })
            : await runB({ data: { schoolId: school, rows: chunk as unknown as BehaviourRow[] } });
          saved += r.saved; rejected += r.rejected;
          all.push(...r.issues.map((x) => ({ ...x, row: x.row + i })));
        }
      }
      const msg = mode === "learners"
        ? `${saved} learners saved${classes ? ` · ${classes} new classes` : ""}${pl ? ` · ${pl} parent links (${pc} new parents)` : ""}`
        : `${saved} ${mode} records saved${rejected ? ` · ${rejected} rows rejected` : ""}`;
      toast.success(msg); setResult(msg); setIssues(all); setRows([]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); } finally { setBusy(false); }
  };

  const cols = Object.keys(ALIASES[mode]);
  const req = REQUIRED[mode];
  const editBad = (i: number, f: string, v: string) => setBad((b) => b.map((r, j) => (j === i ? { ...r, [f]: f === "points" ? (v === "" ? "" : Number(v)) : v } : r)));
  const applyBulk = () => {
    if (!bulk.field || !bulk.value) return;
    setBad((b) => b.map((r) => (r[bulk.field] === "" || r[bulk.field] === undefined ? { ...r, [bulk.field]: bulk.field === "points" ? Number(bulk.value) : bulk.value } : r)));
    toast.success("Filled every empty cell in that column");
  };
  const moveFixed = () => {
    const ok = bad.filter((r) => isComplete(mode, r));
    setRows((r) => [...r, ...ok]); setBad((b) => b.filter((r) => !isComplete(mode, r)));
    toast.success(`${ok.length} fixed rows added to the import`);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist">
        {(Object.keys(INFO) as Mode[]).map((m) => (
          <Button key={m} role="tab" aria-selected={mode === m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => switchMode(m)}>{INFO[m].title}</Button>
        ))}
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold">Import {INFO[mode].title.toLowerCase()}</h2>
        <p className="text-sm text-muted-foreground">{INFO[mode].text} Accepts Excel (.xlsx, .xls), SA-SAMS Excel exports, CSV, TSV, text, OpenDocument (.ods), Word tables (.docx), PDF tables or JSON. Dates may be 2026-05-12 or 12/05/2026.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select aria-label="School to import into" className="h-10 rounded-md border bg-background px-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Choose a school</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-card text-sm">
          <Upload className="h-4 w-4" /> Choose file
          <input key={mode} type="file" className="sr-only" accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.json,.pdf,.docx" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Download template</Button>
      </div>
      {result && <p className="rounded-md border bg-card p-3 text-sm">{result}</p>}
      {issues.length > 0 && (
        <div className="rounded-md border border-destructive/40 p-3 text-sm">
          <p className="mb-2 font-medium text-destructive">Rows not imported</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">{issues.map((x, i) => <li key={i}>Row {x.row} · {x.admission_no}: {x.reason}</li>)}</ul>
        </div>
      )}
      {bad.length > 0 && (
        <div className="space-y-3 rounded-md border border-warning/50 bg-warning/5 p-3">
          <p className="text-sm font-medium">{bad.length} rows are missing required information. Fill in the highlighted boxes, then press "Add fixed rows".</p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Column to fill" className="h-9 rounded-md border bg-background px-2 text-sm" value={bulk.field} onChange={(e) => setBulk({ ...bulk, field: e.target.value })}>
              <option value="">Fill all empty…</option>{cols.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
            <input aria-label="Value for all empty cells" className="h-9 rounded-md border bg-background px-2 text-sm" placeholder="Value" value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value })} />
            <Button size="sm" variant="outline" onClick={applyBulk}>Fill all</Button>
            <Button size="sm" onClick={moveFixed}>Add fixed rows ({bad.filter((r) => isComplete(mode, r)).length})</Button>
          </div>
          <div className="max-h-96 overflow-auto rounded-md border bg-background"><table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 bg-muted text-muted-foreground"><tr>{cols.map((h) => <th key={h} className="p-2 capitalize">{h.replace(/_/g, " ")}{req.includes(h) ? " *" : ""}</th>)}</tr></thead>
            <tbody>{bad.slice(0, 200).map((r, i) => <tr key={i} className="border-t">{cols.map((c) => {
              const empty = req.includes(c) && (r[c] === "" || r[c] === undefined);
              return <td key={c} className="p-1"><input aria-label={`${c} row ${i + 1}`} type={c === "date" || c === "date_of_birth" ? "date" : c === "points" ? "number" : "text"} className={`h-8 w-full min-w-[90px] rounded border bg-background px-1 ${empty ? "border-destructive ring-1 ring-destructive" : ""}`} value={String(r[c] ?? "")} onChange={(e) => editBad(i, c, e.target.value)} /></td>;
            })}</tr>)}</tbody>
          </table></div>
          {bad.length > 200 && <p className="text-xs text-muted-foreground">Showing the first 200. Use "Fill all" for the rest, or fix the file and upload again.</p>}
        </div>
      )}
      {rows.length > 0 && <>
        <p className="text-sm">{rows.length} rows ready{bad.length ? ` · ${bad.length} still need fixing (not included yet)` : ""}. Preview of the first 10:</p>
        <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground"><tr>{cols.map((h) => <th key={h} className="p-2 capitalize">{h.replace(/_/g, " ")}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 10).map((r, i) => <tr key={i} className="border-t">{cols.map((c) => <td key={c} className="p-2">{String(r[c] ?? "") || "—"}</td>)}</tr>)}</tbody>
        </table></div>
        <Button disabled={!school || busy} onClick={() => void submit()}>{busy ? "Importing…" : `Import ${rows.length} rows`}</Button>
      </>}
    </div>
  );
}
