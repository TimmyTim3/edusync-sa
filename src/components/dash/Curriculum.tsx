import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty } from "./Shell";
import { CAPS_PRESETS, missingFromPreset, normalizeClassName } from "@/lib/caps-subjects";

type Subj = { id: string; name: string; code: string | null; phase: string | null; grades: string | null; archived: boolean };
const k = (h: string) => h.toLowerCase().replace(/[_\-.#:]/g, " ").replace(/\s+/g, " ").trim();
const pick = (r: Record<string, unknown>, names: string[]) => {
  for (const key of Object.keys(r)) if (names.includes(k(key))) return String(r[key] ?? "").trim();
  return "";
};

/** Principal: set up which subjects the school offers — CAPS packs, custom subjects, and SA-SAMS educator sheet upload. */
export function CurriculumManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", code: "", grades: "" });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);
  const subjects = useQuery({
    queryKey: ["curriculum", schoolId],
    queryFn: async () => (await supabase.from("subjects").select("id, name, code, phase, grades, archived").eq("school_id", schoolId).order("name")).data as Subj[] ?? [],
  });
  const usage = useQuery({
    queryKey: ["curriculum-usage", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("class_subject_teachers").select("subject_id").eq("school_id", schoolId).limit(5000);
      const m = new Map<string, number>();
      for (const r of data ?? []) m.set(r.subject_id, (m.get(r.subject_id) ?? 0) + 1);
      return m;
    },
  });
  const list = subjects.data ?? [];
  const refresh = () => { for (const q of ["curriculum", "curriculum-usage", "subjects", "allocations"]) void qc.invalidateQueries({ queryKey: [q] }); };

  const loadPreset = async (id: string) => {
    const p = CAPS_PRESETS.find((x) => x.id === id)!;
    const add = missingFromPreset(p, list.map((s) => s.name));
    if (!add.length) { toast.info("All subjects in this pack are already set up"); return; }
    const { error } = await supabase.from("subjects").insert(add.map((s) => ({ school_id: schoolId, ...s })));
    if (error) { toast.error(error.message); return; }
    toast.success(`${add.length} subjects added`); refresh();
  };
  const addOne = async () => {
    if (!f.name.trim()) return;
    const { error } = await supabase.from("subjects").insert({ school_id: schoolId, name: f.name.trim(), code: f.code.trim().toUpperCase() || null, grades: f.grades.trim() || null });
    if (error) { toast.error(error.message.includes("duplicate") ? "That subject already exists" : error.message); return; }
    setF({ name: "", code: "", grades: "" }); toast.success("Subject added"); refresh();
  };
  const toggle = async (s: Subj) => {
    const { error } = await supabase.from("subjects").update({ archived: !s.archived }).eq("id", s.id);
    if (error) toast.error(error.message); else refresh();
  };
  const remove = async (s: Subj) => {
    if ((usage.data?.get(s.id) ?? 0) > 0) { toast.error("Teachers are still allocated to this subject — archive it instead"); return; }
    if (!confirm(`Delete ${s.name}? Marks and homework linked to it would also be removed.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Subject deleted"); refresh(); }
  };

  const upload = async (file: File) => {
    setBusy(true); setReport([]);
    try {
      const XLSX = await import("xlsx");
      const ext = file.name.split(".").pop()?.toLowerCase();
      const wb = ext === "csv" ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer());
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
      const [{ data: roles }, { data: cls }] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("school_id", schoolId).in("role", ["teacher", "school_admin"]),
        supabase.from("classes").select("id, name").eq("school_id", schoolId),
      ]);
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const byEmail = new Map((profs ?? []).filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.id]));
      const byName = new Map((profs ?? []).map((p) => [p.full_name.toLowerCase().replace(/\s+/g, " "), p.id]));
      const classMap = new Map((cls ?? []).map((c) => [c.name.toLowerCase(), c.id]));
      const subjMap = new Map(list.map((s) => [s.name.toLowerCase(), s.id]));
      const problems: string[] = []; const rows: { school_id: string; teacher_id: string; subject_id: string; class_id: string }[] = [];
      let newSubjects = 0;
      for (const [i, r] of raw.entries()) {
        const email = pick(r, ["email", "educator email", "teacher email", "e mail"]).toLowerCase();
        const name = pick(r, ["educator", "educator name", "teacher", "teacher name", "name", "full name"]).toLowerCase().replace(/\s+/g, " ");
        const subject = pick(r, ["subject", "subject name", "learning area"]);
        const grade = pick(r, ["grade", "gr"]);
        let klass = pick(r, ["class", "class name", "register class", "section"]);
        if (grade && klass && !/\d/.test(klass)) klass = `${grade}${klass}`;
        if (!klass && grade) klass = grade;
        if (!subject && !klass && !email && !name) continue;
        const tid = (email && byEmail.get(email)) || (name && byName.get(name));
        const cid = classMap.get(normalizeClassName(klass).toLowerCase());
        if (!tid) { problems.push(`Row ${i + 2}: teacher "${email || name}" not found — add them via staff upload first`); continue; }
        if (!cid) { problems.push(`Row ${i + 2}: class "${klass}" not found`); continue; }
        if (!subject) { problems.push(`Row ${i + 2}: subject missing`); continue; }
        let sid = subjMap.get(subject.toLowerCase());
        if (!sid) {
          const { data: ns, error } = await supabase.from("subjects").insert({ school_id: schoolId, name: subject }).select("id").single();
          if (error || !ns) { problems.push(`Row ${i + 2}: could not add subject "${subject}"`); continue; }
          sid = ns.id; subjMap.set(subject.toLowerCase(), sid); newSubjects++;
        }
        rows.push({ school_id: schoolId, teacher_id: tid, subject_id: sid, class_id: cid });
      }
      let added = 0;
      for (let i = 0; i < rows.length; i += 300) {
        const { data, error } = await supabase.from("class_subject_teachers").upsert(rows.slice(i, i + 300), { onConflict: "class_id,subject_id,teacher_id", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        added += data?.length ?? 0;
      }
      toast.success(`${added} allocations saved, ${newSubjects} new subjects${problems.length ? `, ${problems.length} rows need attention` : ""}`);
      setReport(problems); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read the file"); }
    finally { setBusy(false); }
  };
  const template = () => {
    const blob = new Blob(["Educator Name,Email,Subject,Grade,Class\nN. Dlamini,ndlamini@school.co.za,Mathematics,10,A\nN. Dlamini,ndlamini@school.co.za,Physical Sciences,11,B\n"], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "educator_subject_allocation_template.csv"; a.click();
  };

  return (
    <Card title="Subjects offered">
      <p className="mb-2 text-xs text-muted-foreground">SA-SAMS learner lists don't say which subjects a school teaches. Set them up here once.</p>
      <div className="flex flex-wrap gap-2">
        {CAPS_PRESETS.map((p) => <Button key={p.id} size="sm" variant="outline" onClick={() => void loadPreset(p.id)}>Load {p.label}</Button>)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_6rem_5rem_auto]">
        <Input aria-label="Subject name" placeholder="Subject e.g. Sesotho Home Language" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input aria-label="Subject code" placeholder="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        <Input aria-label="Grades" placeholder="Grades" value={f.grades} onChange={(e) => setF({ ...f, grades: e.target.value })} />
        <Button onClick={() => void addOne()} disabled={!f.name.trim()}>Add</Button>
      </div>
      {list.length === 0 ? <Empty text="No subjects yet — load a CAPS pack above." /> : (
        <ul className="mt-3 max-h-72 divide-y overflow-y-auto rounded-md border text-sm">
          {list.map((s) => (
            <li key={s.id} className={`flex items-center justify-between gap-2 p-2 ${s.archived ? "opacity-50" : ""}`}>
              <div className="min-w-0"><p className="truncate font-medium">{s.name} {s.code && <span className="text-xs text-muted-foreground">{s.code}</span>}</p>
                <p className="text-xs text-muted-foreground">{s.grades ? `Grades ${s.grades} · ` : ""}{usage.data?.get(s.id) ?? 0} class allocations{s.archived ? " · not offered" : ""}</p></div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" onClick={() => void toggle(s)}>{s.archived ? "Restore" : "Archive"}</Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(s)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t pt-3">
        <p className="text-sm font-medium">Upload SA-SAMS educator subject allocation</p>
        <p className="mb-2 text-xs text-muted-foreground">Columns: Educator Name or Email, Subject, Grade, Class. New subjects are added automatically.</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Upload className="h-4 w-4" />{busy ? "Reading…" : "Choose CSV / Excel"}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={busy} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void upload(fl); e.target.value = ""; }} />
          </label>
          <Button size="sm" variant="outline" onClick={template}>Template</Button>
        </div>
        {report.length > 0 && <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-destructive">{report.map((p) => <li key={p}>{p}</li>)}</ul>}
      </div>
    </Card>
  );
}
