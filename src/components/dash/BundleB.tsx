import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty, today } from "./Shell";
import { claimMyChild, reportAbsence } from "@/lib/parent.functions";
import { evaluatePromotion, type PromotionOutcome } from "@/lib/npppr";
import { finalMark, truncatePct } from "@/lib/caps-marks";
import { compressMedicalImage } from "@/lib/image-compress";

const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/* ---------------- Parent: link another child ---------------- */
const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandmother", "Grandfather", "Aunt", "Uncle", "Sibling", "Foster parent", "Other"];
export function ClaimChild({ userId, startOpen = false, onLinked }: { userId: string; startOpen?: boolean; onLinked?: () => void | Promise<void> }) {
  const qc = useQueryClient();
  const claim = useServerFn(claimMyChild);
  const [open, setOpen] = useState(startOpen);
  const [f, setF] = useState({ admissionNo: "", surname: "", dob: "", relationship: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.relationship) { toast.error("Choose your relationship to the child"); return; }
    setBusy(true);
    try {
      await claim({ data: f });
      toast.success("Child linked to your account");
      setF({ admissionNo: "", surname: "", dob: "", relationship: "" });
      setOpen(startOpen);
      await onLinked?.();
      await qc.invalidateQueries({ queryKey: ["children", userId] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Link a child</Button>;
  return (
    <Card title="Link a child">
      <p className="mb-2 text-xs text-muted-foreground">Enter the details exactly as on the school record.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Admission number" value={f.admissionNo} onChange={(e) => setF({ ...f, admissionNo: e.target.value })} />
        <Input placeholder="Learner surname" value={f.surname} onChange={(e) => setF({ ...f, surname: e.target.value })} />
        <Input type="date" aria-label="Birth date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        <select aria-label="Your relationship to the child" className={sel + " sm:col-span-3"} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>
          <option value="">I am the child's…</option>
          {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={busy} onClick={submit}>{busy ? "Checking…" : "Link child"}</Button>
        {!startOpen && <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
      </div>
    </Card>
  );
}

/* ---------------- Parent: report an absence ---------------- */
const REASONS = ["Illness", "Doctor / clinic appointment", "Family emergency", "Bereavement", "Religious observance", "Other"];

export function ReportAbsence({ studentId, name }: { studentId: string; name: string }) {
  const qc = useQueryClient();
  const send = useServerFn(reportAbsence);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: today(), reason: REASONS[0] ?? "Illness", detail: "" });
  const [cert, setCert] = useState<{ base64: string; sizeKb: number; origKb: number } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCompressing(true);
      const res = await compressMedicalImage(file, 1200, 0.72);
      setCert({ base64: res.base64, sizeKb: res.compressedSizeKb, origKb: res.originalSizeKb });
      toast.success(`Doctor note compressed: ${res.compressedSizeKb} KB (saved ${res.originalSizeKb - res.compressedSizeKb} KB)`);
    } catch {
      toast.error("Could not process this image. Please take a photo or select a JPEG/PNG.");
    } finally {
      setCompressing(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = (await send({
        data: { studentId, ...f, certificateBase64: cert?.base64 }
      })) as { already?: boolean; status?: string } | undefined;

      if (r?.already) toast.info(`The register already shows ${name} as ${r.status} for that day`);
      else toast.success(`Absence & medical note reported for ${name}`);
      setOpen(false);
      setCert(null);
      await qc.invalidateQueries({ queryKey: ["child-detail", studentId] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Report an absence</Button>;

  return (
    <Card title={`Report absence — ${name}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="date" aria-label="Day absent" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <select className={sel} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      <Textarea className="mt-2" placeholder="Details (e.g. Diagnosed with flu, bed rest ordered by doctor)" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
      
      <div className="mt-3 rounded-lg border border-dashed p-3">
        <label className="block text-xs font-medium text-foreground mb-1">
          Attach Doctor's Note / Medical Certificate (Optional)
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={compressing || busy}
          onChange={(e) => void onFileChange(e)}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-xs file:font-semibold hover:file:bg-secondary/80"
        />
        {compressing && <p className="mt-1 text-xs text-muted-foreground animate-pulse">Compressing photo...</p>}
        {cert && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            ✓ Certificate attached ({cert.sizeKb} KB · Saved {cert.origKb - cert.sizeKb} KB)
            <button type="button" onClick={() => setCert(null)} className="ml-2 text-destructive underline text-[11px]">Remove</button>
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy || compressing} onClick={submit}>{busy ? "Submitting…" : "Send to school"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setCert(null); }}>Cancel</Button>
      </div>
    </Card>
  );
}
  
/* ---------------- Teacher: edit / delete posted homework ---------------- */
type Hw = { id: string; title: string; description: string | null; due_date: string };
export function HomeworkEditor({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["teacher-homework-edit", classId],
    queryFn: async () => {
      const { data } = await supabase.from("homework").select("id, title, description, due_date").eq("class_id", classId).order("due_date", { ascending: false }).limit(30);
      return (data ?? []) as Hw[];
    },
  });
  const [edit, setEdit] = useState<Hw | null>(null);
  const refresh = () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("teacher-homework") });
  const save = async () => {
    if (!edit) return;
    const { error } = await supabase.from("homework").update({ title: edit.title, description: edit.description, due_date: edit.due_date }).eq("id", edit.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Homework updated"); setEdit(null); refresh();
  };
  const del = async (h: Hw) => {
    if (!confirm(`Delete "${h.title}" and its hand-in ticks?`)) return;
    const { error } = await supabase.from("homework").delete().eq("id", h.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Homework deleted"); refresh();
  };
  return (
    <Card title="Posted homework">
      {!list.data?.length ? <Empty text="No homework posted for this class." /> : (
        <ul className="divide-y text-sm">
          {list.data.map((h) => edit?.id === h.id ? (
            <li key={h.id} className="space-y-2 py-2">
              <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              <Input type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
              <Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              <div className="flex gap-2"><Button size="sm" onClick={save}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
            </li>
          ) : (
            <li key={h.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 truncate">{h.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{h.due_date}</span>
              <Button size="sm" variant="ghost" onClick={() => setEdit(h)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(h)}>Delete</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Teacher: edit published marks ---------------- */
type St = { id: string; first_name: string; last_name: string; admission_no?: string };
export function MarkbookEditor({ schoolId, classId, subjectId, students }: { schoolId: string; classId: string; subjectId: string; students: St[] }) {
  const qc = useQueryClient();
  const [aid, setAid] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const list = useQuery({
    queryKey: ["teacher-assessments", classId, subjectId],
    queryFn: async () => {
      const { data } = await supabase.from("assessments").select("id, title, date, max_marks").eq("class_id", classId).eq("subject_id", subjectId).order("date", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const a = list.data?.find((x) => x.id === aid);
  const load = async (id: string) => {
    setAid(id); setScores({});
    if (!id) return;
    const { data } = await supabase.from("marks").select("student_id, score").eq("assessment_id", id);
    setScores(Object.fromEntries((data ?? []).map((m) => [m.student_id, m.score == null ? "" : String(m.score)])));
  };
  const save = async () => {
    if (!a) return;
    const rows = Object.entries(scores).filter(([, v]) => v !== "").map(([student_id, v]) => ({ school_id: schoolId, assessment_id: a.id, student_id, score: Math.max(0, Math.min(Number(v), a.max_marks)) }));
    const cleared = Object.entries(scores).filter(([, v]) => v === "").map(([k]) => k);
    const { error } = rows.length ? await supabase.from("marks").upsert(rows, { onConflict: "assessment_id,student_id" }) : { error: null };
    if (error) { toast.error(error.message); return; }
    if (cleared.length) await supabase.from("marks").delete().eq("assessment_id", a.id).in("student_id", cleared);
    toast.success(`Saved ${rows.length} marks`);
  };
  const remove = async () => {
    if (!a || !confirm(`Delete "${a.title}" and all its marks?`)) return;
    await supabase.from("marks").delete().eq("assessment_id", a.id);
    const { error } = await supabase.from("assessments").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assessment deleted"); setAid(""); qc.invalidateQueries({ queryKey: ["teacher-assessments", classId, subjectId] });
  };
  return (
    <Card title="Edit recorded marks">
      <select className={sel} value={aid} onChange={(e) => load(e.target.value)}>
        <option value="">Choose an assessment…</option>
        {(list.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.date} · {x.title}</option>)}
      </select>
      {a && (
        <>
          <div className="mt-2 max-h-80 overflow-y-auto">
            <table className="w-full text-sm"><tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-1">{s.first_name} {s.last_name}</td>
                  <td className="w-24"><Input className="h-7" type="number" min={0} max={a.max_marks} value={scores[s.id] ?? ""} onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Out of {a.max_marks}. Clear a box to remove that mark.</p>
          <div className="mt-2 flex gap-2"><Button size="sm" onClick={save}>Save changes</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={remove}>Delete assessment</Button></div>
        </>
      )}
    </Card>
  );
}

/* ---------------- Principal: NPPPR promotion preview ---------------- */
type Row = { id: string; name: string; adm: string; out: PromotionOutcome; subjects: { subject: string; pct: number | null }[] };
export function PromotionPreview({ schoolId }: { schoolId: string }) {
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const classes = useQuery({
    queryKey: ["promo-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name, grade").eq("school_id", schoolId).order("grade").order("name")).data ?? [],
  });
  const run = async () => {
    const c = classes.data?.find((x) => x.id === classId);
    if (!c) return;
    const grade = parseInt(String(c.grade).replace(/\D/g, ""), 10) || 0;
    setBusy(true);
    try {
      const [{ data: studs }, { data: ass }] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId).is("deleted_at", null).order("last_name"),
        supabase.from("assessments").select("id, type, max_marks, subjects(name)").eq("class_id", classId).eq("published", true),
      ]);
      const aMap = new Map((ass ?? []).map((x) => [x.id, x as unknown as { id: string; type: string; max_marks: number; subjects: { name: string } | null }]));
      const ids = [...aMap.keys()];
      const marks: { assessment_id: string; student_id: string; score: number | null }[] = [];
      for (let i = 0; i < ids.length; i += 40) {
        for (let from = 0; ; from += 1000) {
          const { data } = await supabase.from("marks").select("assessment_id, student_id, score").in("assessment_id", ids.slice(i, i + 40)).range(from, from + 999);
          marks.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
      }
      // student -> subject -> {sba[], exam[]}
      const acc = new Map<string, Map<string, { sba: number[]; exam: number[] }>>();
      for (const m of marks) {
        const a = aMap.get(m.assessment_id);
        if (!a || m.score == null) continue;
        const subj = a.subjects?.name ?? "Unknown";
        const bySub = acc.get(m.student_id) ?? new Map();
        const b = bySub.get(subj) ?? { sba: [], exam: [] };
        (/exam/i.test(a.type) ? b.exam : b.sba).push((m.score / (a.max_marks || 100)) * 100);
        bySub.set(subj, b); acc.set(m.student_id, bySub);
      }
      const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      setRows((studs ?? []).map((s) => {
        const subjects = [...(acc.get(s.id) ?? new Map()).entries()].map(([subject, b]) => {
          const sba = b.sba.length ? avg(b.sba) : b.exam.length ? avg(b.exam) : null;
          const exam = b.exam.length ? avg(b.exam) : null;
          return { subject, pct: sba == null ? null : finalMark(sba, exam, grade) };
        });
        return { id: s.id, name: `${s.first_name} ${s.last_name}`, adm: s.admission_no, subjects, out: evaluatePromotion(subjects, grade) };
      }));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const on = rows?.filter((r) => r.out.promoted) ?? [];
  const cond = rows?.filter((r) => !r.out.promoted && r.out.condonationPossible) ?? [];
  const rev = rows?.filter((r) => !r.out.promoted && !r.out.condonationPossible) ?? [];
  const exportCsv = () => {
    if (!rows) return;
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = ["Admission No,Learner,Outcome,Subjects,Reasons", ...rows.map((r) => [r.adm, r.name, r.out.promoted ? "Promoted" : r.out.condonationPossible ? "Condonation" : "Not met", r.subjects.map((s) => `${s.subject} ${s.pct ?? "-"}%`).join("; "), r.out.reasons.join("; ")].map((v) => q(String(v))).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "promotion-preview.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <Card title="Promotion & condonation preview (NPPPR)" className="lg:col-span-2">
      <div className="flex flex-wrap gap-2">
        <select className={`${sel} sm:w-56`} value={classId} onChange={(e) => { setClassId(e.target.value); setRows(null); }}>
          <option value="">Choose a class…</option>
          {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="sm" disabled={!classId || busy} onClick={run}>{busy ? "Calculating…" : "Run preview"}</Button>
        {rows && <Button size="sm" variant="outline" onClick={exportCsv}>Download CSV</Button>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Preview only, from published marks (truncated like SA-SAMS). Final decisions rest with the school progression committee.</p>
      {rows && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-success/10 p-2"><b className="text-success">{on.length}</b><br />Meets requirements</div>
            <div className="rounded-md bg-accent p-2"><b>{cond.length}</b><br />Condonation possible</div>
            <div className="rounded-md bg-destructive/10 p-2"><b className="text-destructive">{rev.length}</b><br />Not met</div>
          </div>
          {!rows.length ? <Empty text="No learners in this class." /> : (
            <ul className="mt-3 max-h-96 divide-y overflow-y-auto text-sm">
              {[...rev, ...cond, ...on].map((r) => (
                <li key={r.id} className="py-2">
                  <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <span className="flex-1 truncate font-medium">{r.name} <span className="text-xs text-muted-foreground">{r.adm}</span></span>
                    <span className={`shrink-0 rounded px-2 text-xs ${r.out.promoted ? "bg-success/15 text-success" : r.out.condonationPossible ? "bg-accent text-accent-foreground" : "bg-destructive/15 text-destructive"}`}>{r.out.promoted ? "Meets" : r.out.condonationPossible ? "Condonation" : "Not met"}</span>
                  </button>
                  {open === r.id && (
                    <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <p>{r.subjects.length ? r.subjects.map((s) => `${s.subject}: ${s.pct == null ? "—" : truncatePct(s.pct)}%`).join(" · ") : "No published marks."}</p>
                      {r.out.reasons.map((x) => <p key={x} className="text-destructive">• {x}</p>)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
