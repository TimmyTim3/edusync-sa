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
        supabase.from("attendance_records").select("student_id, status").eq("class_id", cur!.class_id).eq("date", today()),
      ]);
      return { students: s.data ?? [], att: a.data ?? [] };
    },
  });
  const [marks, setMarks] = useState<Record<string, Status>>({});
  useEffect(() => {
    const m: Record<string, Status> = {};
    for (const a of students.data?.att ?? []) m[a.student_id] = a.status;
    setMarks(m);
  }, [students.data]);

  const saveAttendance = async () => {
    if (!cur || !schoolId || !on("attendance")) return;
    const rows = (students.data?.students ?? []).map((s) => ({
      school_id: schoolId, student_id: s.id, class_id: cur.class_id, date: today(), status: marks[s.id] ?? ("present" as Status), marked_by: user!.id,
    }));
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "student_id,date" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Attendance saved for ${rows.length} learners — parents updated`);
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
        {cur && <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setGlance(!glance)}>{glance ? "Back to marking" : "Class at a glance"}</Button>}
      </div>
      {glance && cur ? <ClassGlance classId={cur.class_id} className={cur.classes?.name ?? "Class"} /> : <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Learners" value={st.length} />
        {on("attendance") && <Stat label="Present (today)" value={present} />}
        {on("attendance") && <Stat label="Marked today" value={students.data?.att.length ? "Yes" : "No"} />}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {(on("attendance") || on("marks")) && <Card title="Attendance & marks" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-2">
            {on("attendance") && <Button size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(st.map((s) => [s.id, "present" as Status])))}>All present</Button>}
            {on("attendance") && <Button size="sm" onClick={saveAttendance}>Save attendance</Button>}
            {on("marks") && <Input className="h-9 w-48" placeholder="New assessment title" value={assess} onChange={(e) => setAssess(e.target.value)} />}
            {on("marks") && <Button size="sm" variant="secondary" onClick={publishMarks}>Publish marks</Button>}
          </div>
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
                  <tr key={s.id} className="border-b">
                    <td className="py-1.5"><button type="button" className="text-left hover:text-primary hover:underline" onClick={() => setProfile(s)}>{s.last_name}, {s.first_name}</button> <span className="text-xs text-muted-foreground">{s.admission_no}</span></td>
                     {on("attendance") && <td className="whitespace-nowrap">
                      {STATUSES.map((x) => (
                         <Button key={x} size="sm" variant={(marks[s.id] ?? "present") === x ? "default" : "ghost"} title={x} aria-label={`${s.first_name} ${s.last_name}: ${x}`} onClick={() => setMarks({ ...marks, [s.id]: x })}
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
