import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty, today } from "./Shell";

type Status = "present" | "absent" | "late" | "excused";
const STATUSES: Status[] = ["present", "absent", "late", "excused"];
type Session = { id: string; kind: string; title: string; grade: string | null; class_id: string | null; date: string; start_time: string; end_time: string; venue: string | null; classes?: { name: string } | null };

const kindLabel = (k: string) => (k === "exam" ? "Exam" : "Extra class");
const t5 = (t: string) => t.slice(0, 5);

/** Staff: create exam / extra-class sessions and take a register of only the expected learners. */
export function TimetablePanel({ schoolId }: { schoolId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPast, setShowPast] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [f, setF] = useState({ kind: "exam", title: "", grade: "", class_id: "", date: today(), start: "08:30", end: "11:30", venue: "" });

  const classes = useQuery({
    queryKey: ["tt-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name, grade").eq("school_id", schoolId).order("grade").order("name")).data ?? [],
  });
  const grades = [...new Set((classes.data ?? []).map((c) => c.grade))];

  const sessions = useQuery({
    queryKey: ["tt-sessions", schoolId, showPast],
    queryFn: async () => {
      let q = supabase.from("timetable_sessions").select("*, classes(name)").eq("school_id", schoolId);
      q = showPast ? q.lt("date", today()).order("date", { ascending: false }) : q.gte("date", today()).order("date").order("start_time");
      return ((await q.limit(100)).data ?? []) as unknown as Session[];
    },
  });

  const add = async () => {
    if (!f.title || (!f.grade && !f.class_id)) { toast.error("Add a subject/paper and choose a grade or class"); return; }
    const { error } = await supabase.from("timetable_sessions").insert({
      school_id: schoolId, kind: f.kind, title: f.title, grade: f.class_id ? null : f.grade, class_id: f.class_id || null,
      date: f.date, start_time: f.start, end_time: f.end, venue: f.venue || null, created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Session added to the timetable");
    setF({ ...f, title: "", venue: "" });
    void qc.invalidateQueries({ queryKey: ["tt-sessions"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this session from the timetable?")) return;
    const { error } = await supabase.from("timetable_sessions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["tt-sessions"] });
  };

  const sel = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Add exam or extra class">
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            {["exam", "extra_class"].map((k) => <Button key={k} size="sm" variant={f.kind === k ? "default" : "outline"} onClick={() => setF({ ...f, kind: k })}>{kindLabel(k)}</Button>)}
          </div>
          <Input placeholder={f.kind === "exam" ? "e.g. Mathematics P1" : "e.g. Saturday Physical Sciences"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className={sel} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value, class_id: "" })} aria-label="Grade">
              <option value="">Grade…</option>
              {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <select className={sel} value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })} aria-label="Class (optional)">
              <option value="">Whole grade</option>
              {(classes.data ?? []).filter((c) => !f.grade || c.grade === f.grade).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} aria-label="Start" />
            <Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} aria-label="End" />
          </div>
          <Input placeholder="Venue, e.g. School Hall" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} />
          <Button className="w-full" onClick={add}>Add to timetable</Button>
        </div>
      </Card>
      <Card title={showPast ? "Past sessions" : "Upcoming exams & extra classes"} className="lg:col-span-2">
        <div className="mb-2 flex gap-2">
          <Button size="sm" variant={!showPast ? "default" : "outline"} onClick={() => setShowPast(false)}>Upcoming</Button>
          <Button size="sm" variant={showPast ? "default" : "outline"} onClick={() => setShowPast(true)}>Past</Button>
        </div>
        {!sessions.data?.length ? <Empty text="No sessions yet." /> : (
          <ul className="divide-y text-sm">
            {sessions.data.map((s) => (
              <li key={s.id} className="py-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium"><span className={`mr-1 rounded px-1 text-xs ${s.kind === "exam" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{kindLabel(s.kind)}</span>{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.date} · {t5(s.start_time)}–{t5(s.end_time)} · {s.classes?.name ?? `Grade ${s.grade}`}{s.venue ? ` · ${s.venue}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant={openId === s.id ? "default" : "outline"} onClick={() => setOpenId(openId === s.id ? null : s.id)}>Register</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s.id)}>Remove</Button>
                  </div>
                </div>
                {openId === s.id && <SessionRegister schoolId={schoolId} session={s} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SessionRegister({ schoolId, session }: { schoolId: string; session: Session }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [filter, setFilter] = useState<"all" | Status>("all");
  const q = useQuery({
    queryKey: ["tt-register", session.id],
    queryFn: async () => {
      let classIds: string[] = [];
      if (session.class_id) classIds = [session.class_id];
      else classIds = ((await supabase.from("classes").select("id").eq("school_id", schoolId).eq("grade", session.grade ?? "")).data ?? []).map((c) => c.id);
      const out: { id: string; first_name: string; last_name: string; admission_no: string; classes: { name: string } | null }[] = [];
      for (let from = 0; from < 5000 && classIds.length; from += 1000) {
        const { data } = await supabase.from("students").select("id, first_name, last_name, admission_no, classes(name)").in("class_id", classIds).is("deleted_at", null).order("last_name").range(from, from + 999);
        out.push(...((data ?? []) as unknown as typeof out));
        if (!data || data.length < 1000) break;
      }
      const { data: att } = await supabase.from("session_attendance").select("student_id, status").eq("session_id", session.id);
      return { students: out, att: att ?? [] };
    },
  });
  const saved = Object.fromEntries((q.data?.att ?? []).map((a) => [a.student_id, a.status as Status]));
  const st = (id: string) => marks[id] ?? saved[id] ?? "present";
  const list = q.data?.students ?? [];
  const count = (s: Status) => list.filter((l) => st(l.id) === s).length;
  const save = async () => {
    const rows = list.map((l) => ({ school_id: schoolId, session_id: session.id, student_id: l.id, status: st(l.id), marked_by: user?.id ?? null }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("session_attendance").upsert(rows.slice(i, i + 500), { onConflict: "session_id,student_id" });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`Register saved · ${count("present") + count("late")} of ${list.length} in the room`);
    setMarks({});
    void qc.invalidateQueries({ queryKey: ["tt-register", session.id] });
  };
  if (q.isLoading) return <p className="py-2 text-xs text-muted-foreground">Loading candidates…</p>;
  return (
    <div className="mt-2 rounded-md border p-2">
      <p className="mb-2 text-xs text-muted-foreground">{list.length} expected · {count("present") + count("late")} in the room · {count("absent")} missing {q.data?.att.length ? "" : "· not saved yet"}</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {(["all", ...STATUSES] as const).map((x) => <Button key={x} size="sm" variant={filter === x ? "default" : "outline"} className="capitalize" onClick={() => setFilter(x)}>{x} ({x === "all" ? list.length : count(x)})</Button>)}
        <Button size="sm" onClick={save}>Save register</Button>
      </div>
      <ul className="max-h-80 divide-y overflow-y-auto text-sm">
        {list.filter((l) => filter === "all" || st(l.id) === filter).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 py-1">
            <span className="truncate">{l.last_name}, {l.first_name} <span className="text-xs text-muted-foreground">{l.classes?.name}</span></span>
            <span className="shrink-0">{STATUSES.map((x) => <Button key={x} size="sm" variant={st(l.id) === x ? "default" : "ghost"} className="mr-1 h-7 w-7 p-0 uppercase" aria-label={`${l.first_name}: ${x}`} onClick={() => setMarks({ ...marks, [l.id]: x })}>{x[0]}</Button>)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Parent: the child's upcoming exams and extra classes with their attendance status. */
export function ChildSchedule({ studentId, classId }: { studentId: string; classId: string | null }) {
  const q = useQuery({
    queryKey: ["child-schedule", studentId, classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data: cls } = await supabase.from("classes").select("grade").eq("id", classId).maybeSingle();
      const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("timetable_sessions").select("*").or(`class_id.eq.${classId},grade.eq.${cls?.grade ?? "-"}`).gte("date", from).order("date").order("start_time").limit(40);
      const ids = (data ?? []).map((s) => s.id);
      const att = ids.length ? (await supabase.from("session_attendance").select("session_id, status").eq("student_id", studentId).in("session_id", ids)).data ?? [] : [];
      const m = Object.fromEntries(att.map((a) => [a.session_id, a.status]));
      return (data ?? []).map((s) => ({ ...s, status: m[s.id] as string | undefined }));
    },
  });
  return (
    <Card title="Exams & extra classes">
      {!q.data?.length ? <Empty text="Nothing scheduled." /> : (
        <ul className="space-y-2 text-sm">
          {q.data.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-medium">{kindLabel(s.kind)} · {s.title}</p><p className="text-xs text-muted-foreground">{s.date} · {t5(s.start_time)}–{t5(s.end_time)}{s.venue ? ` · ${s.venue}` : ""}</p></div>
              <span className={`shrink-0 rounded px-1.5 text-xs capitalize ${s.status === "absent" ? "bg-destructive/15 text-destructive" : s.status ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{s.status ?? (s.date >= today() ? "upcoming" : "not marked")}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
