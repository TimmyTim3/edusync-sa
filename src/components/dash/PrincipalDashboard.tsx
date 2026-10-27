import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSchoolRealtime } from "@/lib/realtime";
import { useFeatureFlags } from "@/lib/features";
import { Shell, Card, Stat, today } from "./Shell";
import { DisciplinaryReports } from "./DisciplinaryReports";
import { ClassGlance } from "./ClassGlance";
import { BehaviourDrawer, ClassTeacherAssign, LearnerSearch, NeedsCompletion, NoticesManager, ParentLinker, ReliefManager, RolloverWizard, StaffIngest, SubjectAllocation, TransferClearance } from "./SchoolTools";
import { PromotionPreview } from "./BundleB";
import { GateRegister, TruancyAlerts } from "./BundleD";
import { TimetablePanel } from "./Timetable";
import { CurriculumManager } from "./Curriculum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PrincipalDashboard() {
  const { user, schoolId } = useAuth();
  const lastUpdate = useSchoolRealtime(schoolId);
  const { data: flags } = useFeatureFlags(schoolId);
  const on = (key: string) => flags?.resolved[key] ?? false;

  const stats = useQuery({
    queryKey: ["principal-stats", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const c = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
      const sid = schoolId;
      if (!sid) throw new Error("No school selected");
      // Independent figures load in parallel with the "which day" lookup.
      const basicsP = Promise.all([
        supabase.from("schools").select("name").eq("id", sid).single(),
        c(supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", sid)),
        c(supabase.from("parents").select("id", { count: "exact", head: true }).eq("school_id", sid)),
        c(supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("role", "teacher")),
        c(supabase.from("behaviour_notes").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("is_positive", true)),
        c(supabase.from("behaviour_notes").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("is_positive", false)),
        supabase.from("classes").select("id, name, grade").eq("school_id", sid).order("grade").order("name"),
        supabase.from("notices").select("id, title, scope, published_at").eq("school_id", sid).order("published_at", { ascending: false }).limit(8),
      ]);
      // most recent full school day: skip days where only a few classes were marked
      const [roll, lastRes] = await Promise.all([
        c(supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", sid).is("deleted_at", null)),
        supabase.from("attendance_records").select("date").eq("school_id", sid).order("date", { ascending: false }).limit(1),
      ]);
      let day = today();
      const d0 = lastRes.data?.[0]?.date as string | undefined;
      if (d0) {
        day = d0;
        const base = new Date(d0 + "T00:00:00Z");
        const candidates = Array.from({ length: 45 }, (_, i) => new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10));
        const counts = await Promise.all(candidates.map((d) => c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", d))));
        const idx = counts.findIndex((n) => n >= roll * 0.5);
        if (idx >= 0) day = candidates[idx] ?? day;
      }
      const [[school, students, parents, teachers, positive, negative, classesRes, noticesRes], marked, present, late] = await Promise.all([
        basicsP,
        c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", day)),
        c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", day).in("status", ["present", "late"])),
        c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", day).eq("status", "late")),
      ]);
      const classes = classesRes.data;
      const notices = noticesRes.data;
      const notPresent: unknown[] = [];
      for (let from = 0; from < 5000; from += 1000) {
        const { data: page } = await supabase
          .from("attendance_records").select("status, students(first_name, last_name), classes(name)")
          .eq("school_id", sid).eq("date", day).in("status", ["absent", "excused", "half_day"]).order("status").range(from, from + 999);
        notPresent.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      const absent = notPresent as { status: string; students: { first_name: string; last_name: string } | null; classes: { name: string } | null }[];
      return { name: school.data?.name ?? "School", day, students, parents, teachers, marked, present, late, positive, negative, classes: classes ?? [], absent, notices: notices ?? [] };
    },
  });

  const [tab, setTab] = useState<"overview" | "discipline" | "timetable" | "staff" | "gate">("overview");
  const [drawer, setDrawer] = useState(false);
  const [glance, setGlance] = useState<{ id: string; name: string } | null>(null);
  const [n, setN] = useState({ title: "", body: "", urgent: false });
  const post = async () => {
    if (!schoolId || !n.title || !on("notices")) return;
    const { error } = await supabase.from("notices").insert({ school_id: schoolId, scope: "school", title: n.title, body: n.body, priority: n.urgent ? "urgent" : "normal", created_by: user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Notice sent to every family");
    setN({ title: "", body: "", urgent: false });
  };

  const s = stats.data;
  const rate = s && s.marked ? Math.round((s.present / s.marked) * 100) : 0;
  const grades = s ? [...new Set(s.classes.map((c) => c.grade))] : [];

  return (
    <Shell title={s?.name ?? "School overview"} subtitle="Principal dashboard" lastUpdate={lastUpdate}>
      <div className="mb-5 flex flex-wrap gap-2 print:hidden">
        <Button size="sm" variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>Overview</Button>
        <Button size="sm" variant={tab === "timetable" ? "default" : "outline"} onClick={() => setTab("timetable")}>Exams & extra classes</Button>
        <Button size="sm" variant={tab === "staff" ? "default" : "outline"} onClick={() => setTab("staff")}>Staff & year-end</Button>
        <Button size="sm" variant={tab === "gate" ? "default" : "outline"} onClick={() => setTab("gate")}>Gate & truancy</Button>
        {on("behaviour") && (
          <Button size="sm" variant={tab === "discipline" ? "default" : "outline"} onClick={() => setTab("discipline")}>
            Disciplinary reports
          </Button>
        )}
      </div>
      {tab === "timetable" && schoolId ? (
        <TimetablePanel schoolId={schoolId} />
      ) : tab === "gate" && schoolId ? (
        <div className="grid gap-4 lg:grid-cols-2"><GateRegister schoolId={schoolId} /><TruancyAlerts schoolId={schoolId} /></div>
      ) : tab === "staff" && schoolId ? (
        <div className="grid gap-4 lg:grid-cols-2"><StaffIngest schoolId={schoolId} /><ClassTeacherAssign schoolId={schoolId} /><CurriculumManager schoolId={schoolId} /><SubjectAllocation schoolId={schoolId} /><ReliefManager schoolId={schoolId} /><RolloverWizard schoolId={schoolId} /><PromotionPreview schoolId={schoolId} /><TransferClearance schoolId={schoolId} /></div>
      ) : tab === "discipline" ? (
        <DisciplinaryReports schoolId={schoolId} />
      ) : glance ? (
        <ClassGlance classId={glance.id} className={glance.name} onClose={() => setGlance(null)} />
      ) : (
      <>
      <div className="mb-4"><LearnerSearch schoolId={schoolId} /></div>
      <p className="mb-3 text-xs text-muted-foreground">Tip: tap any class below to open its Class at a Glance, or tap Behaviour to see every merit and concern.</p>
      <details className="mb-4 rounded-md border bg-card p-3 text-xs">
        <summary className="cursor-pointer font-medium" aria-label="How marks are calculated">ⓘ Marks follow SA-SAMS &amp; NPPPR rules</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Final marks are <b>truncated, never rounded up</b> — 49.6% shows as 49%, exactly like SA-SAMS, so a parent never sees a pass that SA-SAMS records as a fail.</li>
          <li>Weighting (SBA / exam): Grades 4–6 75/25 · Grades 7–9 40/60 · Grades 10–12 25/75 · Grades R–3 100% SBA.</li>
          <li>Achievement levels use the DBE 7-point scale (Level 4 = 50–59%).</li>
          <li>Promotion and condonation decisions stay with the school's official SA-SAMS schedule.</li>
        </ul>
      </details>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Learners" value={s?.students.toLocaleString() ?? "…"} />
        <Stat label="Parents" value={s?.parents.toLocaleString() ?? "…"} />
        <Stat label="Teachers" value={s?.teachers ?? "…"} />
        {on("attendance") && <Stat label="Attendance" value={`${rate}%`} hint={s ? `${s.present.toLocaleString()} of ${s.marked.toLocaleString()} at school (${s.late} late) · ${s.marked - s.present} not at school · ${s.day}` : ""} />}
        {on("behaviour") && <button type="button" onClick={() => setDrawer(true)} className="rounded-md border bg-card p-4 text-left transition hover:border-primary"><p className="text-xs uppercase text-muted-foreground">Behaviour</p><p className="mt-1 font-display text-2xl font-semibold"><span className="text-success">+{s?.positive ?? "…"}</span><span className="text-muted-foreground"> / </span><span className="text-destructive">−{s?.negative ?? "…"}</span></p><p className="text-xs text-muted-foreground">merits / concerns · tap for details</p></button>}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Classes by grade" className="lg:col-span-2">
          <div className="space-y-3">
            {grades.map((g) => (
              <div key={g}>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Grade {g}</p>
                <div className="flex flex-wrap gap-1">
                  {s?.classes.filter((c) => c.grade === g).map((c) => (
                    <button key={c.id} onClick={() => { setGlance({ id: c.id, name: c.name }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:bg-primary hover:text-primary-foreground">{c.name.replace("Grade ", "")}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        {on("notices") && <Card title="School-wide notice">
          <div className="space-y-2">
            <Input placeholder="Title" value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} />
            <Textarea placeholder="Message to all parents" value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={n.urgent} onChange={(e) => setN({ ...n, urgent: e.target.checked })} /> Urgent</label>
            <Button className="w-full" onClick={post}>Publish</Button>
          </div>
        </Card>}
        {on("attendance") && <Card title={`Not at school on ${s?.day ?? ""} (${s?.absent.length ?? 0})`}>
          <ul className="max-h-96 space-y-1 overflow-y-auto pr-1 text-sm">
            {(s?.absent ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2"><span className="truncate">{a.students?.first_name} {a.students?.last_name}</span><span className="shrink-0 text-xs text-muted-foreground">{a.classes?.name} · <span className={a.status === "absent" ? "text-destructive" : "text-primary"}>{a.status.replace("_", " ")}</span></span></li>
            ))}
          </ul>
        </Card>}
        {on("notices") && schoolId && <NoticesManager schoolId={schoolId} />}
        {schoolId && <NeedsCompletion schoolId={schoolId} />}
        {schoolId && <ParentLinker schoolId={schoolId} />}
        {schoolId && <ClassTeacherAssign schoolId={schoolId} />}
      </div>
      </>
      )}
      {drawer && schoolId && <BehaviourDrawer schoolId={schoolId} onClose={() => setDrawer(false)} />}
    </Shell>
  );
}
