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
import { ClassGlance } from "./ClassGlance";

type Status = Database["public"]["Enums"]["attendance_status"];
type Assign = { class_id: string; subject_id: string; classes: { name: string } | null; subjects: { name: string } | null };
const STATUSES: Status[] = ["present", "absent", "late", "excused"];

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
      const { data } = await supabase.from("class_subject_teachers").select("class_id, subject_id, classes(name), subjects(name)").eq("teacher_id", user!.id);
      return (data ?? []) as unknown as Assign[];
    },
  });
  const list = assigns.data ?? [];
  const [idx, setIdx] = useState(0);
  const [glance, setGlance] = useState(false);
  const cur = list[idx];

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

  const [beh, setBeh] = useState({ student: "", note: "", positive: true });
  const addBehaviour = async () => {
    if (!schoolId || !beh.student || !beh.note || !on("behaviour")) return;
    const { error } = await supabase.from("behaviour_notes").insert({ school_id: schoolId, student_id: beh.student, category: beh.positive ? "Merit" : "Concern", is_positive: beh.positive, severity: "low", note: beh.note, points: beh.positive ? 5 : -5, parent_visible: true, created_by: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Behaviour note shared");
    setBeh({ student: "", note: "", positive: true });
  };

  if (!assigns.isLoading && !list.length)
    return <Shell title="Teacher dashboard" lastUpdate={lastUpdate}><Card><Empty text="You have no classes assigned yet." /></Card></Shell>;

  const st = students.data?.students ?? [];
  const present = st.filter((s) => (marks[s.id] ?? "present") === "present").length;

  return (
    <Shell title="Teacher dashboard" subtitle={cur ? `${cur.classes?.name} · ${cur.subjects?.name}` : ""} lastUpdate={lastUpdate}>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {list.map((a, i) => (
          <Button key={a.class_id + a.subject_id} size="sm" className="shrink-0" variant={i === idx ? "default" : "outline"} onClick={() => setIdx(i)}>
            {a.classes?.name} · {a.subjects?.name}
          </Button>
        ))}
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
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {st.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-1.5">{s.last_name}, {s.first_name} <span className="text-xs text-muted-foreground">{s.admission_no}</span></td>
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
                <Button size="sm" variant={beh.positive ? "default" : "outline"} className={beh.positive ? "bg-success text-success-foreground hover:bg-success/90" : ""} onClick={() => setBeh({ ...beh, positive: true })}>Merit +5</Button>
                <Button size="sm" variant={!beh.positive ? "destructive" : "outline"} onClick={() => setBeh({ ...beh, positive: false })}>Concern −5</Button>
              </div>
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
    </Shell>
  );
}
