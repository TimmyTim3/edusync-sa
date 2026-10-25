import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty, today } from "./Shell";
import { ATT_STYLES, AttendanceCalendar, AttendanceLegend } from "./AttendanceCalendar";

const RANGES = { week: 7, month: 31, term: 92 } as const;
type Range = keyof typeof RANGES;

async function pageAll<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data } = await make(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function ClassGlance({ classId, className, onClose }: { classId: string; className: string; onClose?: () => void }) {
  const [range, setRange] = useState<Range>("month");
  const [day, setDay] = useState(today());
  const [studentId, setStudentId] = useState<string | null>(null);
  const cutoff = new Date(Date.now() - RANGES[range] * 86400000).toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ["class-glance", classId, cutoff],
    queryFn: async () => {
      const { data: students } = await supabase.from("students").select("id, first_name, last_name, admission_no").eq("class_id", classId).is("deleted_at", null).order("last_name");
      const ids = (students ?? []).map((s) => s.id);
      const [att, marks, beh, hw, cls] = await Promise.all([
        pageAll<{ student_id: string; date: string; status: string }>((a, b) => supabase.from("attendance_records").select("student_id, date, status").eq("class_id", classId).gte("date", cutoff).order("date").range(a, b)),
        pageAll<{ student_id: string; score: number | null; assessments: { max_marks: number; date: string } | null }>((a, b) => supabase.from("marks").select("student_id, score, assessments!inner(max_marks, date, class_id)").eq("assessments.class_id", classId).order("id").range(a, b) as never),
        ids.length ? pageAll<{ student_id: string; is_positive: boolean; category: string; created_at: string }>((a, b) => supabase.from("behaviour_notes").select("student_id, is_positive, category, created_at").in("student_id", ids).gte("created_at", cutoff).order("created_at").range(a, b)) : Promise.resolve([]),
        supabase.from("homework").select("id, title, due_date").eq("class_id", classId).order("due_date", { ascending: false }).limit(20),
        supabase.from("classes").select("class_teacher_id").eq("id", classId).single(),
      ]);
      let teacher = "";
      if (cls.data?.class_teacher_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", cls.data.class_teacher_id).maybeSingle();
        teacher = p?.full_name ?? "";
      }
      return { students: students ?? [], att, marks, beh, hw: hw.data ?? [], teacher };
    },
  });

  // Day register lookup (independent of range)
  const dayQ = useQuery({
    queryKey: ["class-day", classId, day],
    queryFn: async () => (await supabase.from("attendance_records").select("student_id, status").eq("class_id", classId).eq("date", day)).data ?? [],
  });

  const d = q.data;
  const rows = (d?.students ?? []).map((s) => {
    const a = d!.att.filter((r) => r.student_id === s.id);
    const atPct = a.length ? Math.round((a.filter((r) => r.status === "present" || r.status === "late").length / a.length) * 100) : null;
    const late = a.filter((r) => r.status === "late").length;
    const m = d!.marks.filter((r) => r.student_id === s.id && r.score != null);
    const avg = m.length ? Math.round(m.reduce((t, r) => t + (Number(r.score) / (r.assessments?.max_marks ?? 100)) * 100, 0) / m.length) : null;
    const b = d!.beh.filter((r) => r.student_id === s.id);
    const neg = b.filter((r) => !r.is_positive).length;
    const pos = b.length - neg;
    const flags = [atPct != null && atPct < 85 && "attendance", avg != null && avg < 50 && "marks", neg >= 2 && "behaviour"].filter(Boolean) as string[];
    return { ...s, atPct, late, avg, pos, neg, flags };
  });
  const needing = rows.filter((r) => r.flags.length).sort((a, b) => b.flags.length - a.flags.length);
  const top = rows.filter((r) => r.avg != null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)).slice(0, 5);
  const lateComers = rows.filter((r) => r.late > 0).sort((a, b) => b.late - a.late).slice(0, 5);
  const offenders = rows.filter((r) => r.neg > 0).sort((a, b) => b.neg - a.neg).slice(0, 5);
  const allAtt = d?.att ?? [];
  const classPct = allAtt.length ? Math.round((allAtt.filter((r) => r.status === "present" || r.status === "late").length / allAtt.length) * 100) : 0;
  const classAvg = rows.filter((r) => r.avg != null).length ? Math.round(rows.reduce((t, r) => t + (r.avg ?? 0), 0) / rows.filter((r) => r.avg != null).length) : 0;
  const offences = Object.entries((d?.beh ?? []).filter((b) => !b.is_positive).reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.category]: (acc[b.category] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const overdue = (d?.hw ?? []).filter((h) => h.due_date < today());
  const doneQ = useQuery({
    queryKey: ["class-hw-done", classId, overdue.map((h) => h.id).join(",")],
    enabled: overdue.length > 0,
    queryFn: async () => (await supabase.from("homework_completions").select("homework_id, student_id").in("homework_id", overdue.slice(0, 6).map((h) => h.id))).data ?? [],
  });
  const missing = (hwId: string) => {
    const done = new Set((doneQ.data ?? []).filter((c) => c.homework_id === hwId).map((c) => c.student_id));
    return rows.filter((r) => !done.has(r.id));
  };
  const dayMap = new Map((dayQ.data ?? []).map((r) => [r.student_id, r.status]));
  type Tone = "good" | "warn" | "bad";
  const health = (r: (typeof rows)[number]): Tone => (r.flags.length >= 2 ? "bad" : r.flags.length ? "warn" : "good");
  const TONE: Record<Tone, string> = { good: "bg-success", warn: "bg-warning", bad: "bg-destructive" };
  const TEXT: Record<Tone, string> = { good: "text-success", warn: "text-warning", bad: "text-destructive" };
  const selected = rows.find((r) => r.id === studentId);
  const [hwOpen, setHwOpen] = useState<string | null>(null);
  const nameCount = new Map<string, number>();
  for (const r of rows) { const k = `${r.first_name} ${r.last_name}`; nameCount.set(k, (nameCount.get(k) ?? 0) + 1); }
  const label = (r: { first_name: string; last_name: string; admission_no: string }) => { const k = `${r.first_name} ${r.last_name}`; return (nameCount.get(k) ?? 0) > 1 ? `${k} · #${r.admission_no.slice(-4)}` : k; };

  // Each list sets its own tone so the dot always matches what the list is about:
  // top performers = green, late arrivals = amber/red, concerns = red.
  const Person = ({ r, right, tone }: { r: (typeof rows)[number]; right: string; tone?: Tone }) => {
    const t = tone ?? health(r);
    return (
      <li><button className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted" onClick={() => setStudentId(r.id)}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE[t]}`} /><span className="flex-1 truncate">{label(r)}</span><span className={`shrink-0 text-xs ${tone ? TEXT[t] : "text-muted-foreground"}`}>{right}</span>
      </button></li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto"><h2 className="font-display text-xl font-semibold">{className} · Class at a glance</h2>
          <p className="text-xs text-muted-foreground">Register controlled by class teacher: {d?.teacher || "not assigned"}</p></div>
        {(Object.keys(RANGES) as Range[]).map((r) => <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>This {r}</Button>)}
        {onClose && <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>}
      </div>
      {q.isLoading ? <Card><Empty text="Loading class…" /></Card> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Learners", rows.length], ["Attendance", `${classPct}%`], ["Average mark", `${classAvg}%`], ["Need attention", needing.length]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{l}</p><p className="font-display text-2xl font-semibold">{v}</p></div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card title={`Needing attention (${needing.length})`}><ul className="max-h-72 overflow-y-auto text-sm">{needing.length ? needing.map((r) => <Person key={r.id} r={r} right={r.flags.join(", ")} />) : <Empty text="Everyone is on track." />}</ul></Card>
            <Card title="Top performers"><ul className="text-sm">{top.map((r) => <Person key={r.id} r={r} tone="good" right={`${r.avg}%`} />)}</ul></Card>
            <Card title="Behaviour"><p className="mb-2 text-sm"><span className="text-success">+{(d?.beh ?? []).filter((b) => b.is_positive).length} merits</span> · <span className="text-destructive">−{(d?.beh ?? []).filter((b) => !b.is_positive).length} concerns</span></p>
              <p className="text-xs text-muted-foreground">Common offences</p><ul className="mb-2 text-sm">{offences.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="text-destructive">{v}</span></li>)}</ul>
              <p className="text-xs text-muted-foreground">Most concerns</p><ul className="text-sm">{offenders.map((r) => <Person key={r.id} r={r} tone="bad" right={`−${r.neg} concern${r.neg === 1 ? "" : "s"}`} />)}</ul></Card>
            <Card title="Most late arrivals"><ul className="text-sm">{lateComers.length ? lateComers.map((r) => <Person key={r.id} r={r} tone={r.late >= 3 ? "bad" : "warn"} right={`${r.late}× late`} />) : <Empty text="No late arrivals." />}</ul></Card>
            <Card title={`Overdue homework (${overdue.length})`}><ul className="space-y-3 text-sm">{overdue.length ? overdue.slice(0, 6).map((h) => { const m = missing(h.id); return (
              <li key={h.id}><div className="flex justify-between gap-2"><span className="truncate font-medium">{h.title}</span><span className="shrink-0 text-xs text-destructive">due {h.due_date}</span></div>
                <p className="text-xs text-muted-foreground">{doneQ.isLoading ? "Checking…" : m.length ? `Not handed in (${m.length}):` : "Everyone handed in."}</p>
                {m.length > 0 && <div className="mt-1 flex max-h-28 flex-wrap gap-1 overflow-y-auto">{(hwOpen === h.id ? m : m.slice(0, 8)).map((r) => <button key={r.id} onClick={() => setStudentId(r.id)} className="rounded border border-destructive/40 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10">{label(r)}</button>)}{m.length > 8 && <button className="px-1.5 text-xs text-primary underline" onClick={() => setHwOpen(hwOpen === h.id ? null : h.id)}>{hwOpen === h.id ? "show less" : `+${m.length - 8} more`}</button>}</div>}
              </li>); }) : <Empty text="No overdue homework." />}</ul></Card>
            <Card title="Register for a date">
              <Input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
              {dayQ.data && !dayQ.data.length ? <Empty text="No register for this date (weekend, holiday or not yet marked)." /> : (
                <>
                  <div className="mt-2 flex flex-wrap gap-1 text-xs">{Object.entries(ATT_STYLES).map(([k, s]) => <span key={k} className={`rounded border px-2 py-0.5 ${s.cls}`}>{s.symbol} {s.label}: {(dayQ.data ?? []).filter((r) => r.status === k).length}</span>)}</div>
                  <ul className="mt-2 max-h-56 overflow-y-auto text-sm">{rows.map((r) => { const st = dayMap.get(r.id); const s = st ? ATT_STYLES[st] : undefined; return <li key={r.id} className="flex justify-between py-0.5"><button className="truncate text-left hover:text-primary" onClick={() => setStudentId(r.id)}>{label(r)}</button><span className={`rounded border px-1.5 text-xs ${s?.cls ?? ""}`}>{s ? `${s.symbol} ${s.label}` : "—"}</span></li>; })}</ul>
                </>
              )}
              <AttendanceLegend />
            </Card>
          </div>
          {selected && <StudentRecord student={selected} onClose={() => setStudentId(null)} />}
        </>
      )}
    </div>
  );
}

export function StudentRecord({ student, onClose }: { student: { id: string; first_name: string; last_name: string; admission_no: string }; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["student-record", student.id],
    queryFn: async () => {
      const [att, beh] = await Promise.all([
        supabase.from("attendance_records").select("date, status").eq("student_id", student.id).order("date", { ascending: false }).limit(400),
        supabase.from("behaviour_notes").select("id, category, is_positive, note, points, created_at").eq("student_id", student.id).order("created_at", { ascending: false }).limit(200),
      ]);
      return { att: att.data ?? [], beh: beh.data ?? [] };
    },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><div><h3 className="font-display text-lg font-semibold">{student.first_name} {student.last_name}</h3><p className="text-xs text-muted-foreground">{student.admission_no} · full record</p></div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button></div>
        <ChangeClass studentId={student.id} />
        <AttendanceCalendar records={q.data?.att ?? []} />
        {(() => { const b = q.data?.beh ?? []; const pos = b.filter((x) => x.is_positive).length; return (
        <details className="mt-5 rounded-lg border">
          <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 font-semibold"><span>Behaviour notes ({b.length})</span><span className="text-xs font-normal"><span className="text-success">+{pos} merits</span> · <span className="text-destructive">−{b.length - pos} concerns</span> · tap to open</span></summary>
          <ul className="max-h-80 divide-y overflow-y-auto border-t px-3 text-sm">{b.length === 0 && <li className="py-2 text-muted-foreground">No behaviour notes.</li>}{b.map((n) => <li key={n.id} className="py-2"><div className="flex justify-between"><span className="font-medium">{n.category}</span><span className={n.is_positive ? "text-success" : "text-destructive"}>{n.is_positive ? "+" : "−"}{Math.abs(n.points)}</span></div><p className="text-muted-foreground">{n.note}</p><p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p></li>)}</ul>
        </details>); })()}      </div>
    </div>
  );
}

const MOVE_REASONS = ["Subject stream change", "Remedial / learning support", "Class rebalance", "Behaviour separation", "Parent request", "Admin correction"];

/** Move a learner to another class. Past registers, marks and behaviour stay exactly where they were. */
function ChangeClass({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState(MOVE_REASONS[0]!);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["change-class", studentId],
    queryFn: async () => {
      const { data: s } = await supabase.from("students").select("school_id, class_id, classes(name, grade)").eq("id", studentId).single();
      const { data: cls } = s ? await supabase.from("classes").select("id, name, grade").eq("school_id", s.school_id).order("grade").order("name") : { data: [] };
      return { s: s as unknown as { school_id: string; class_id: string | null; classes: { name: string; grade: string } | null } | null, cls: cls ?? [] };
    },
  });
  const cur = q.data?.s;
  const save = async () => {
    if (!to || busy || !cur) return;
    setBusy(true);
    const { error } = await supabase.from("students").update({ class_id: to }).eq("id", studentId);
    if (!error) {
      const dest = q.data?.cls.find((c) => c.id === to)?.name ?? "new class";
      await supabase.from("audit_logs").insert({ school_id: cur.school_id, action: "change_class", details: { student_id: studentId, from: cur.classes?.name ?? null, to: dest, reason } });
      toast.success(`Moved to ${dest}. Earlier records stay unchanged.`);
      setOpen(false); setTo(""); void qc.invalidateQueries();
    } else toast.error(error.message);
    setBusy(false);
  };
  return (
    <div className="mb-4 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2"><span>Class: <b>{cur?.classes?.name ?? "—"}</b></span><Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Cancel" : "Change class"}</Button></div>
      {open && <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <select className="h-9 rounded-md border bg-background px-2" value={to} onChange={(e) => setTo(e.target.value)} aria-label="New class">
          <option value="">Move to…</option>
          {(q.data?.cls ?? []).filter((c) => c.id !== cur?.class_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">{MOVE_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        <Button size="sm" disabled={!to || busy} onClick={save}>{busy ? "Moving…" : "Confirm move"}</Button>
      </div>}
    </div>
  );
}
