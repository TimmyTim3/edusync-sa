import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFeatureFlags } from "@/lib/features";
import { useSchoolRealtime } from "@/lib/realtime";
import { Shell, Card, Stat, Empty, today } from "./Shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { ChildSchedule } from "./Timetable";
import { ClaimChild, ReportAbsence } from "./BundleB";

type Child = { id: string; first_name: string; last_name: string; admission_no: string; photo_url: string | null; class_id: string | null; classes: { name: string; grade: string } | null };

const statusColor: Record<string, string> = {
  present: "bg-primary/15 text-primary",
  late: "bg-accent text-accent-foreground",
  absent: "bg-destructive/15 text-destructive",
  excused: "bg-muted text-muted-foreground",
  half_day: "bg-muted text-muted-foreground",
};

export function ParentDashboard() {
  const { user, schoolId } = useAuth();
  const lastUpdate = useSchoolRealtime(schoolId);
  const { data: ff } = useFeatureFlags(schoolId);
  const on = (k: string) => ff?.resolved[k] ?? false;

  const children = useQuery({
    queryKey: ["children", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: p } = await supabase.from("parents").select("id").eq("user_id", user!.id);
      const ids = (p ?? []).map((x) => x.id);
      if (!ids.length) return [] as Child[];
      const { data: links } = await supabase.from("parent_student").select("student_id").in("parent_id", ids);
      const sids = (links ?? []).map((l) => l.student_id);
      if (!sids.length) return [] as Child[];
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_no, photo_url, class_id, classes(name, grade)")
        .in("id", sids)
        .order("first_name");
      return (data ?? []) as unknown as Child[];
    },
  });
  const [sel, setSel] = useState<string | null>(null);
  const kids = children.data ?? [];
  const child = kids.find((k) => k.id === sel) ?? kids[0];

  const detail = useQuery({
    queryKey: ["child-detail", child?.id],
    enabled: !!child,
    queryFn: async () => {
      const [att, marks, beh, hw, notices] = await Promise.all([
        supabase.from("attendance_records").select("date, status").eq("student_id", child!.id).order("date", { ascending: false }).limit(400),
        supabase.from("marks").select("score, assessments(title, max_marks, date, subjects(name))").eq("student_id", child!.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("behaviour_notes").select("id, category, is_positive, note, points, created_at").eq("student_id", child!.id).order("created_at", { ascending: false }).limit(200),
        child!.class_id
          ? supabase.from("homework").select("id, title, due_date, subjects(name)").eq("class_id", child!.class_id).order("due_date").limit(40)
          : Promise.resolve({ data: [] }),
        (async () => {
          const base = () => supabase.from("notices").select("id, title, body, priority, published_at, scope, grade, class_id").eq("school_id", schoolId!);
          const [schoolNotices, gradeNotices, classNotices] = await Promise.all([
            base().eq("scope", "school").order("published_at", { ascending: false }).limit(6),
            child!.classes?.grade ? base().eq("scope", "grade").eq("grade", child!.classes.grade).order("published_at", { ascending: false }).limit(6) : Promise.resolve({ data: [], error: null }),
            child!.class_id ? base().eq("scope", "class").eq("class_id", child!.class_id).order("published_at", { ascending: false }).limit(6) : Promise.resolve({ data: [], error: null }),
          ]);
          const error = schoolNotices.error ?? gradeNotices.error ?? classNotices.error;
          if (error) throw error;
          return { data: [...(schoolNotices.data ?? []), ...(gradeNotices.data ?? []), ...(classNotices.data ?? [])]
            .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "")).slice(0, 6), error: null };
        })(),
      ]);
      return { att: att.data ?? [], marks: marks.data ?? [], beh: beh.data ?? [], hw: (hw.data ?? []) as { id: string; title: string; due_date: string; subjects: { name: string } | null }[], notices: notices.data ?? [] };
    },
  });

  const seen = (detail.data?.notices ?? []).map((n) => n.id).join(",");
  useEffect(() => {
    if (!user || !seen) return;
    void supabase.from("notice_reads").upsert(seen.split(",").map((notice_id) => ({ notice_id, user_id: user.id })), { onConflict: "notice_id,user_id", ignoreDuplicates: true });
  }, [seen, user]);

  if (children.isLoading) return <Shell title="Family dashboard" lastUpdate={null}><Skeleton className="h-40 w-full" /></Shell>;
  if (!kids.length)
    return <Shell title="Family dashboard" lastUpdate={lastUpdate}><div className="space-y-4"><Card><Empty text="No children are linked to your account yet. Link your child below with their school details, or ask the school office." /></Card>{user && <ClaimChild userId={user.id} />}</div></Shell>;

  const d = detail.data;

  const att = d?.att ?? [];
  const pct = att.length ? Math.round((att.filter((a) => a.status === "present" || a.status === "late").length / att.length) * 100) : 0;
  const todayRec = att.find((a) => a.date === today());
  const marks = (d?.marks ?? []) as unknown as { score: number | null; assessments: { title: string; max_marks: number; date: string; subjects: { name: string } | null } | null }[];
  const avg = marks.length ? Math.floor(1e-9 + marks.reduce((s, m) => s + ((m.score ?? 0) / (m.assessments?.max_marks ?? 100)) * 100, 0) / marks.length) : 0;
  const hw = d?.hw ?? [];
  const upcoming = hw.filter((h) => h.due_date >= today());
  const overdue = hw.filter((h) => h.due_date < today()).slice(-5);

  return (
    <Shell title="Family dashboard" subtitle={`${kids.length} ${kids.length === 1 ? "child" : "children"} linked`} lastUpdate={lastUpdate}>
      <div className="mb-6 flex min-w-0 gap-2 overflow-x-auto pb-1">
        {kids.map((k, i) => {
          const color = `var(--chart-${(i % 5) + 1})`;
          const active = k.id === child?.id;
          return (
            <Button
              key={k.id}
              variant="outline"
              size="sm"
              onClick={() => setSel(k.id)}
              className="min-h-11 shrink-0 gap-2 border-2"
              style={{ borderColor: color, ...(active ? { backgroundColor: color, color: "var(--background)" } : {}) }}
            >
              {k.photo_url ? <img src={k.photo_url} alt="" className="h-6 w-6 rounded-full" /> : <span className="h-3 w-3 rounded-full" style={{ backgroundColor: active ? "var(--background)" : color }} />}
              {k.first_name} · {k.classes?.name}
            </Button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {child && on("attendance") && <ReportAbsence key={child.id} studentId={child.id} name={child.first_name} />}
        {user && <ClaimChild userId={user.id} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {on("attendance") && <Stat label="Today" value={todayRec ? todayRec.status.replace("_", " ") : "Not marked"} />}
        {on("attendance") && <Stat label="Attendance" value={`${pct}%`} hint="last 60 school days" />}
        {on("marks") && <Stat label="Average mark" value={`${avg}%`} hint={`${marks.length} results`} />}
        {on("homework") && <Stat label="Homework due" value={upcoming.length} hint={`${overdue.length} past due`} />}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {on("attendance") && (
          <Card title="Attendance history" className="lg:col-span-3">
            <AttendanceCalendar records={att} />
          </Card>
        )}
        {child && (
          <Card title="Exams & extra classes" className="lg:col-span-3">
            <ChildSchedule studentId={child.id} classId={child.class_id} />
          </Card>
        )}
        {on("marks") && (
          <Card title="Latest marks" className="lg:col-span-2">
            {marks.length ? (
              <ul className="divide-y text-sm">
                {marks.slice(0, 10).map((m, i) => {
                  const p = Math.floor(1e-9 + ((m.score ?? 0) / (m.assessments?.max_marks ?? 100)) * 100);
                  return (
                    <li key={i} className="flex items-center gap-3 py-2">
                      <span className="w-40 truncate font-medium">{m.assessments?.subjects?.name}</span>
                      <span className="flex-1 truncate text-muted-foreground">{m.assessments?.title}</span>
                      <div className="hidden h-2 w-32 rounded bg-muted sm:block"><div className="h-2 rounded bg-primary" style={{ width: `${p}%` }} /></div>
                      <span className="w-12 text-right font-semibold">{p}%</span>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty text="No published marks yet." />}
          </Card>
        )}
        {on("homework") && (
          <Card title="Homework">
            {upcoming.length || overdue.length ? (
              <ul className="space-y-2 text-sm">
                {upcoming.slice(0, 8).map((h) => (
                  <li key={h.id} className="flex justify-between gap-2"><span className="truncate">{h.title}</span><span className="shrink-0 text-muted-foreground">{h.due_date}</span></li>
                ))}
                {overdue.map((h) => (
                  <li key={h.id} className="flex justify-between gap-2 text-destructive"><span className="truncate">{h.title}</span><span className="shrink-0">past due</span></li>
                ))}
              </ul>
            ) : <Empty text="No homework set." />}
          </Card>
        )}
        {on("behaviour") && (
          <Card title="Behaviour">
            {d?.beh.length ? (
              <ul className="space-y-2 text-sm">
                {d.beh.map((b) => (
                   <li key={b.id} className={`rounded-md border-l-4 p-3 ${b.is_positive ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}`}>
                     <span className={`font-semibold ${b.is_positive ? "text-success" : "text-destructive"}`}>{b.is_positive ? "+" : "−"}{Math.abs(b.points)} · {b.category}</span>
                    <p className="text-muted-foreground">{b.note}</p>
                  </li>
                ))}
              </ul>
            ) : <Empty text="No behaviour notes." />}
          </Card>
        )}
        {on("notices") && (
          <Card title="Notices">
            <ul className="space-y-3 text-sm">
              {(d?.notices ?? []).map((n) => (
                <li key={n.id}>
                  <p className="font-medium">{n.priority === "urgent" && <span className="mr-1 rounded bg-destructive/15 px-1 text-xs text-destructive">Urgent</span>}{n.title}</p>
                  <p className="text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Shell>
  );
}
