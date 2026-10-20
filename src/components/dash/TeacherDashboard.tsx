import { SASA_LEVELS, levelPoints } from "@/lib/import-normalize";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useSchoolRealtime } from "@/lib/realtime";
import { useFeatureFlags } from "@/lib/features";
import { Shell, Card, Stat, Empty, today } from "./Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClassGlance, StudentRecord } from "./ClassGlance";
import { LearnerSearch } from "./SchoolTools";
import { TimetablePanel } from "./Timetable";
import { HomeworkCheckoff } from "./HomeworkCheckoff";

const REASONS = ["Sick / medical", "Doctor or clinic", "Transport problem", "Family emergency", "Bereavement", "Weather", "Religious / cultural", "Unexplained"];

type Status = Database["public"]["Enums"]["attendance_status"];
type Assign = { class_id: string; subject_id: string; classes: { name: string; grade: string } | null; subjects: { name: string } | null };
const STATUSES: Status[] = ["present", "absent", "late", "excused"];
const gradeNum = (g: string) => (/^r$/i.test(g) ? 0 : Number(g) || 99);
const gradeLabel = (g: string) => (/^grade/i.test(g) ? g : `Grade ${g.toUpperCase()}`);

export function TeacherDashboard() {
  const { user, schoolId } = useAuth();
  const lastUpdate = useSchoolRealtime(schoolId);
  const qc = useQueryClient();
  const { data: flags } = useFeatureFlags(schoolId);
  const on = (key: string) => flags?.resolved[key] ?? false;

  const assigns = useQuery({
    queryKey: ["assigns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("class_subject_teachers").select("class_id, subject_id, classes(name, grade), subjects(name)").eq("teacher_id", user!.id);
      return ((data ?? []) as unknown as Assign[]).sort((a, b) => Number(a.classes?.grade) - Number(b.classes?.grade) || (a.classes?.name ?? "").localeCompare(b.classes?.name ?? ""));
    },
  });
  const list = assigns.data ?? [];
  const [idx, setIdx] = useState(0);
  const [glance, setGlance] = useState(false);
  const cur = list[idx];
  const [browse, setBrowse] = useState(false);
  const [browseGrade, setBrowseGrade] = useState("");
  const [browseClass, setBrowseClass] = useState("");
  const allClasses = useQuery({
    queryKey: ["all-classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name, grade").eq("school_id", schoolId!).order("name");
      return data ?? [];
    },
  });

  const students = useQuery({
    queryKey: ["class-students", cur?.class_id],
    enabled: !!cur,
    queryFn: async () => {
      const [s, a] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", cur!.class_id).is("deleted_at", null).order("last_name"),
        supabase.from("attendance_records").select("student_id, status, note").eq("class_id", cur!.class_id).eq("date", today()),
      ]);
      return { students: s.data ?? [], att: a.data ?? [] };
    },
  });
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tt, setTt] = useState(false);
  useEffect(() => {
    const m: Record<string, Status> = {}; const n: Record<string, string> = {};
    for (const a of students.data?.att ?? []) { m[a.student_id] = a.status; if (a.note) n[a.student_id] = a.note; }
    setMarks(m); setNotes(n);
  }, [students.data]);
  const setStatus = (id: string, x: Status) => { setMarks((m) => ({ ...m, [id]: x })); setReasonFor(x === "absent" || x === "excused" ? id : null); };

  const saveAttendance = async () => {
    if (!cur || !schoolId || !on("attendance") || saving) return;
    const wasSaved = !!students.data?.att.length;
    const rows = (students.data?.students ?? []).map((s) => {
      const status = marks[s.id] ?? ("present" as Status);
      return { school_id: schoolId, student_id: s.id, class_id: cur.class_id, date: today(), status, note: status === "absent" || status === "excused" || status === "late" ? (notes[s.id] ?? null) : null, marked_by: user!.id };
    });
    setSaving(true);
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "student_id,date" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setReasonFor(null);
    toast.success(wasSaved ? "Saved register updated — parents see the new reasons" : `Attendance saved for ${rows.length} learners — parents updated`);
    void qc.invalidateQueries({ queryKey: ["class-students"] });
  };

  const [hw, setHw] = useState({ title: "", due: today(), desc: "" });
  const addHomework = async () => {
    if (!cur || !schoolId || !hw.title || !on("homework")) return;
    const { error } = await supabase.from("homework").insert({ school_id: schoolId, class_id: cur.class_id, subject_id: cur.subject_id, title: hw.title, description: hw.desc, due_date: hw.due, created_by: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Homework posted");
    setHw({ title: "", due: today(), desc: "" });
  };

  const [notice, setNotice] = useState({ title: "", body: "" });
  const postNotice = async () => {
    if (!cur || !schoolId || !notice.title || !on("notices")) return;
    const { error } = await supabase.from("notices").insert({ school_id: schoolId, scope: "class", class_id: cur.class_id, title: notice.title, body: notice.body, created_by: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Class notice sent");
    setNotice({ title: "", body: "" });
  };

  const [assess, setAssess] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const publishMarks = async () => {
    if (!on("marks")) return;
    if (!cur || !schoolId || !assess) { toast.error("Enter an assessment title"); return; }
    const { data: a, error } = await supabase.from("assessments").insert({ school_id: schoolId, class_id: cur.class_id, subject_id: cur.subject_id, title: assess, type: "test", max_marks: 100, date: today(), published: true, created_by: user!.id }).select("id").single();
    if (error || !a) { toast.error(error?.message ?? "Failed"); return; }
    const rows = Object.entries(scores).filter(([, v]) => v !== "").map(([sid, v]) => ({ school_id: schoolId, assessment_id: a.id, student_id: sid, score: Number(v) }));
    if (rows.length) {
      const { error: e2 } = await supabase.from("marks").insert(rows);
      if (e2) { toast.error(e2.message); return; }
    }
    toast.success(`Published ${rows.length} marks`);
    setAssess(""); setScores({});
  };

  const [beh, setBeh] = useState({ student: "", note: "", positive: true, level: 1 });
  const addBehaviour = async () => {
    if (!schoolId || !beh.student || !beh.note || !on("behaviour")) return;
    const { error } = await supabase.from("behaviour_notes").insert({ school_id: schoolId, student_id: beh.student, category: beh.positive ? "Merit" : "Concern", is_positive: beh.positive, severity: SASA_LEVELS[beh.level - 1]!.severity, note: beh.note, points: levelPoints(beh.level, beh.positive), parent_visible: true, created_by: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Behaviour note shared");
    setBeh({ student: "", note: "", positive: true, level: 1 });
  };

  const st = students.data?.students ?? [];
  const [profile, setProfile] = useState<{ id: string; first_name: string; last_name: string; admission_no: string } | null>(null);
  const [stFilter, setStFilter] = useState<"all" | "absent" | "late" | "excused">("all");
  const [stTerm, setStTerm] = useState("");
  const present = st.filter((s) => (marks[s.id] ?? "present") === "present").length;

  const schoolPicker = (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!browse ? "default" : "outline"} onClick={() => setBrowse(false)} disabled={!list.length}>My classes</Button>
        <Button size="sm" variant={browse ? "default" : "outline"} onClick={() => setBrowse(true)}>Whole school · all grades</Button>
      </div>
      <LearnerSearch schoolId={schoolId} />
    </div>
  );

  if (browse || (!assigns.isLoading && !list.length)) {
    const all = allClasses.data ?? [];
    const grades = [...new Set(all.map((c) => c.grade))].sort((a, b) => gradeNum(a) - gradeNum(b));
    const g = browseGrade || grades[0] || "";
    const inGrade = all.filter((c) => c.grade === g);
    const cls = inGrade.find((c) => c.id === browseClass) ?? inGrade[0];
    return (
      <Shell title="Teacher dashboard" subtitle="Browse any grade and class" lastUpdate={lastUpdate}>
        {schoolPicker}
        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Grade
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={g} onChange={(e) => { setBrowseGrade(e.target.value); setBrowseClass(""); }}>
              {grades.map((x) => <option key={x} value={x}>{gradeLabel(x)}</option>)}
            </select></label>
          <label className="text-xs text-muted-foreground">Class
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={cls?.id ?? ""} onChange={(e) => setBrowseClass(e.target.value)}>
              {inGrade.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        </div>
        {cls ? <ClassGlance classId={cls.id} className={cls.name} /> : <Card><Empty text="No classes found for this school yet." /></Card>}
      </Shell>
    );
  }

  return (
    <Shell title="Teacher dashboard" subtitle={cur ? `${cur.classes?.name} · ${cur.subjects?.name}` : ""} lastUpdate={lastUpdate}>
      {schoolPicker}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="text-xs text-muted-foreground sm:w-40">Grade
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={cur?.classes?.grade ?? ""}
            onChange={(e) => { const i = list.findIndex((a) => a.classes?.grade === e.target.value); if (i >= 0) setIdx(i); }}>
            {[...new Set(list.map((a) => a.classes?.grade ?? ""))].sort((a, b) => gradeNum(a) - gradeNum(b)).map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
          </select></label>
        <label className="flex-1 text-xs text-muted-foreground">Class · subject
          <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
            {list.map((a, i) => a.classes?.grade === cur?.classes?.grade && <option key={a.class_id + a.subject_id} value={i}>{a.classes?.name} · {a.subjects?.name}</option>)}
          </select></label>
        {cur && <Button size="sm" variant="secondary" className="shrink-0" onClick={() => { setGlance(!glance); setTt(false); }}>{glance ? "Back to marking" : "Class at a glance"}</Button>}
        {schoolId && <Button size="sm" variant={tt ? "default" : "outline"} className="shrink-0" onClick={() => { setTt(!tt); setGlance(false); }}>Exams & extra classes</Button>}
      </div>
      {tt && schoolId ? <TimetablePanel schoolId={schoolId} /> : glance && cur ? <ClassGlance classId={cur.class_id} className={cur.classes?.name ?? "Class"} /> : <>
      {cur && <ClassRisk classId={cur.class_id} onPick={setProfile} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Learners" value={st.length} />
        {on("attendance") && <Stat label="Present (today)" value={present} />}
        {on("attendance") && <Stat label="Marked today" value={students.data?.att.length ? "Yes" : "No"} />}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(on("attendance") || on("marks")) && <Card title="Attendance & marks" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-2">
            {on("attendance") && <Button size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(st.map((s) => [s.id, "present" as Status])))}>All present</Button>}
            {on("attendance") && <Button size="sm" disabled={saving} onClick={saveAttendance}>{saving ? "Saving…" : students.data?.att.length ? "Update saved register" : "Save attendance"}</Button>}
            {on("marks") && <Input className="h-9 w-48" placeholder="New assessment title" value={assess} onChange={(e) => setAssess(e.target.value)} />}
            {on("marks") && <Button size="sm" variant="secondary" onClick={publishMarks}>Publish marks</Button>}
          </div>
          {on("attendance") && !!students.data?.att.length && <p className="mb-2 rounded bg-success/10 px-2 py-1 text-xs text-success">Today's register is saved. A parent phoned later? Tap A or E on the learner, choose a reason, then “Update saved register”.</p>}
          {on("attendance") && <div className="mb-3 flex flex-wrap items-center gap-2">
            {(["all", "absent", "late", "excused"] as const).map((f) => {
              const n = f === "all" ? st.length : st.filter((s) => (marks[s.id] ?? "present") === f).length;
              return <Button key={f} size="sm" variant={stFilter === f ? "default" : "outline"} onClick={() => setStFilter(f)} className="capitalize">{f} ({n})</Button>;
            })}
            <Input className="h-9 min-w-40 flex-1" placeholder="Find learner in this class…" value={stTerm} onChange={(e) => setStTerm(e.target.value)} />
          </div>}
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {st.filter((s) => (stFilter === "all" || (marks[s.id] ?? "present") === stFilter) && (!stTerm.trim() || `${s.first_name} ${s.last_name} ${s.admission_no}`.toLowerCase().includes(stTerm.trim().toLowerCase()))).map((s) => (
                  <tr key={s.id} className="border-b align-top">
                    <td className="py-1.5"><button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setProfile(s)}>{s.last_name}, {s.first_name}</button> <span className="text-xs text-muted-foreground">{s.admission_no}</span>
                      {notes[s.id] && reasonFor !== s.id && ["absent", "excused", "late"].includes(marks[s.id] ?? "") && <button type="button" className="block text-xs text-muted-foreground hover:text-primary" onClick={() => setReasonFor(s.id)}>Reason: {notes[s.id]} ✎</button>}
                      {reasonFor === s.id && <div className="mt-1 flex flex-wrap gap-1">
                        {REASONS.map((r) => <button key={r} type="button" className={`rounded border px-1.5 py-0.5 text-xs ${notes[s.id] === r ? "border-primary bg-primary/15 text-primary" : "hover:bg-muted"}`} onClick={() => { setNotes((n) => ({ ...n, [s.id]: r })); setReasonFor(null); }}>{r}</button>)}
                        <Input className="h-7 w-44 text-xs" placeholder="Other reason…" maxLength={200} value={REASONS.includes(notes[s.id] ?? "") ? "" : (notes[s.id] ?? "")} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && setReasonFor(null)} />
                        <button type="button" className="rounded px-1.5 py-0.5 text-xs text-muted-foreground underline" onClick={() => setReasonFor(null)}>Skip</button>
                      </div>}
                    </td>
                     {on("attendance") && <td className="whitespace-nowrap">
                      {STATUSES.map((x) => (
                         <Button key={x} size="sm" variant={(marks[s.id] ?? "present") === x ? "default" : "ghost"} title={x} aria-label={`${s.first_name} ${s.last_name}: ${x}`} onClick={() => setStatus(s.id, x)}
                           className="mr-1 h-7 w-7 p-0 uppercase">{x[0]}</Button>
                      ))}
                     </td>}
                     {on("marks") && <td className="w-20"><Input className="h-7" type="number" min={0} max={100} placeholder="%" value={scores[s.id] ?? ""} onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>}
        <div className="space-y-4">
          {on("homework") && <Card title="Set homework">
            <div className="space-y-2">
              <Input placeholder="Title" value={hw.title} onChange={(e) => setHw({ ...hw, title: e.target.value })} />
              <Input type="date" value={hw.due} onChange={(e) => setHw({ ...hw, due: e.target.value })} />
              <Textarea placeholder="Instructions" value={hw.desc} onChange={(e) => setHw({ ...hw, desc: e.target.value })} />
              <Button className="w-full" onClick={addHomework}>Post homework</Button>
            </div>
          </Card>}
          {on("homework") && cur && schoolId && user && <HomeworkCheckoff schoolId={schoolId} classId={cur.class_id} students={st} userId={user.id} />}
          {on("behaviour") && <Card title="Behaviour note">
            <div className="space-y-2">
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={beh.student} onChange={(e) => setBeh({ ...beh, student: e.target.value })}>
                <option value="">Choose learner…</option>
                {st.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
              <div className="flex gap-2">
                <Button size="sm" variant={beh.positive ? "default" : "outline"} className={beh.positive ? "bg-success text-success-foreground hover:bg-success/90" : ""} onClick={() => setBeh({ ...beh, positive: true })}>Merit</Button>
                <Button size="sm" variant={!beh.positive ? "destructive" : "outline"} onClick={() => setBeh({ ...beh, positive: false })}>Concern</Button>
              </div>
              <select aria-label="SASA level" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={beh.level} onChange={(e) => setBeh({ ...beh, level: Number(e.target.value) })}>
                {SASA_LEVELS.map((l) => <option key={l.level} value={l.level}>{beh.positive ? l.merit : l.demerit} ({beh.positive ? "+" : "−"}{l.points})</option>)}
              </select>
              <Textarea placeholder="Note visible to parents" value={beh.note} onChange={(e) => setBeh({ ...beh, note: e.target.value })} />
              <Button className="w-full" onClick={addBehaviour}>Share with parents</Button>
            </div>
          </Card>}
          {on("notices") && <Card title="Class notice">
            <div className="space-y-2">
              <Input placeholder="Title" value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} />
              <Textarea placeholder="Message" value={notice.body} onChange={(e) => setNotice({ ...notice, body: e.target.value })} />
              <Button className="w-full" onClick={postNotice}>Send notice</Button>
            </div>
          </Card>}
        </div>
      </div>
      </>}
      {profile && <StudentRecord student={profile} onClose={() => setProfile(null)} />}
    </Shell>
  );
}

type Lite = { id: string; first_name: string; last_name: string; admission_no: string };
/** My Classes: one-tap lists of chronic absentees, late-comers and good attenders this term. */
function ClassRisk({ classId, onPick }: { classId: string; onPick: (s: Lite) => void }) {
  const [mode, setMode] = useState<"absent" | "late" | "good" | null>(null);
  const q = useQuery({
    queryKey: ["class-risk", classId],
    queryFn: async () => {
      const from = new Date(Date.now() - 92 * 86400000).toISOString().slice(0, 10);
      const [{ data: st }, att] = await Promise.all([
        supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId).is("deleted_at", null),
        (async () => { const out: { student_id: string; status: string }[] = []; for (let f = 0; f < 20000; f += 1000) { const { data } = await supabase.from("attendance_records").select("student_id, status").eq("class_id", classId).gte("date", from).order("id").range(f, f + 999); out.push(...(data ?? [])); if (!data || data.length < 1000) break; } return out; })(),
      ]);
      return (st ?? []).map((s) => { const a = att.filter((r) => r.student_id === s.id); const abs = a.filter((r) => r.status === "absent").length; const late = a.filter((r) => r.status === "late").length; const pct = a.length ? Math.round(((a.length - abs) / a.length) * 100) : 100; return { s, abs, late, pct, n: a.length }; });
    },
  });
  const rows = q.data ?? [];
  const lists = {
    absent: rows.filter((r) => r.abs >= 3).sort((a, b) => b.abs - a.abs).map((r) => ({ r, t: `${r.abs} days absent` })),
    late: rows.filter((r) => r.late >= 2).sort((a, b) => b.late - a.late).map((r) => ({ r, t: `${r.late}× late` })),
    good: rows.filter((r) => r.n > 0 && r.pct >= 95).sort((a, b) => b.pct - a.pct).map((r) => ({ r, t: `${r.pct}%` })),
  };
  const btn = (k: "absent" | "late" | "good", label: string, cls: string) => (
    <Button size="sm" variant={mode === k ? "default" : "outline"} className={mode === k ? "" : cls} onClick={() => setMode(mode === k ? null : k)}>{label} ({q.isLoading ? "…" : lists[k].length})</Button>
  );
  return (
    <div className="mb-4 rounded-2xl border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">This term in this class</p>
      <div className="flex flex-wrap gap-2">{btn("absent", "Most absent (3+)", "text-destructive")}{btn("late", "Late-coming", "text-warning")}{btn("good", "Good attendance 95%+", "text-success")}</div>
      {mode && <ul className="mt-2 max-h-60 divide-y overflow-y-auto text-sm">{lists[mode].length ? lists[mode].map(({ r, t }) => (
        <li key={r.s.id}><button className="flex w-full justify-between py-1.5 text-left hover:text-primary" onClick={() => onPick(r.s)}><span className="truncate">{r.s.last_name}, {r.s.first_name} <span className="text-xs text-muted-foreground">{r.s.admission_no}</span></span><span className="shrink-0 text-xs">{t}</span></button></li>
      )) : <li className="py-2 text-muted-foreground">Nobody in this list.</li>}</ul>}
    </div>
  );
}
