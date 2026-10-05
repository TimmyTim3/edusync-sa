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
      // most recent date with attendance
      const { data: last } = await supabase.from("attendance_records").select("date").eq("school_id", sid).order("date", { ascending: false }).limit(1);
      const day = last?.[0]?.date ?? today();
      const [school, students, parents, teachers, marked, present, positive, negative] = await Promise.all([
        supabase.from("schools").select("name").eq("id", sid).single(),
        c(supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", sid)),
        c(supabase.from("parents").select("id", { count: "exact", head: true }).eq("school_id", sid)),
        c(supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("role", "teacher")),
        c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", day)),
        c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", day).in("status", ["present", "late"])),
        c(supabase.from("behaviour_notes").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("is_positive", true)),
        c(supabase.from("behaviour_notes").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("is_positive", false)),
      ]);
      const { data: classes } = await supabase.from("classes").select("id, name, grade").eq("school_id", sid).order("grade").order("name");
      const notPresent: unknown[] = [];
      for (let from = 0; from < 5000; from += 1000) {
        const { data: page } = await supabase
          .from("attendance_records").select("status, students(first_name, last_name), classes(name)")
          .eq("school_id", sid).eq("date", day).in("status", ["absent", "excused", "half_day"]).order("status").range(from, from + 999);
        notPresent.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      const absent = notPresent as { status: string; students: { first_name: string; last_name: string } | null; classes: { name: string } | null }[];
      const late = await c(supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("school_id", sid).eq("date", day).eq("status", "late"));
      const { data: notices } = await supabase.from("notices").select("id, title, scope, published_at").eq("school_id", sid).order("published_at", { ascending: false }).limit(8);
      return { name: school.data?.name ?? "School", day, students, parents, teachers, marked, present, late, positive, negative, classes: classes ?? [], absent, notices: notices ?? [] };
    },
  });

  const [tab, setTab] = useState<"overview" | "discipline">("overview");
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
      <div className="mb-5 flex gap-2 print:hidden">
        <Button size="sm" variant={tab === "overview" ? "default" : "outline"} onClick={() => setTab("overview")}>Overview</Button>
        {on("behaviour") && (
          <Button size="sm" variant={tab === "discipline" ? "default" : "outline"} onClick={() => setTab("discipline")}>
            Disciplinary reports
          </Button>
        )}
      </div>
      {tab === "discipline" ? (
        <DisciplinaryReports schoolId={schoolId} />
      ) : glance ? (
        <ClassGlance classId={glance.id} className={glance.name} onClose={() => setGlance(null)} />
      ) : (
      <>
      <p className="mb-3 text-xs text-muted-foreground">Tip: tap any class below to open its Class at a Glance.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Learners" value={s?.students.toLocaleString() ?? "…"} />
        <Stat label="Parents" value={s?.parents.toLocaleString() ?? "…"} />
        <Stat label="Teachers" value={s?.teachers ?? "…"} />
        {on("attendance") && <Stat label="Attendance" value={`${rate}%`} hint={s ? `${s.present} of ${s.marked} at school (${s.late} late) · ${s.marked - s.present} not at school · ${s.day}` : ""} />}
        {on("behaviour") && <div className="rounded-md border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">Behaviour</p><p className="mt-1 font-display text-2xl font-semibold"><span className="text-success">+{s?.positive ?? "…"}</span><span className="text-muted-foreground"> / </span><span className="text-destructive">−{s?.negative ?? "…"}</span></p><p className="text-xs text-muted-foreground">merits / concerns</p></div>}
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
        {on("notices") && <Card title="Recent notices" className="lg:col-span-2">
          <ul className="divide-y text-sm">
            {(s?.notices ?? []).map((x) => (
              <li key={x.id} className="flex justify-between py-2"><span>{x.title}</span><span className="text-muted-foreground">{x.scope} · {new Date(x.published_at).toLocaleDateString()}</span></li>
            ))}
          </ul>
        </Card>}
      </div>
      </>
      )}
    </Shell>
  );
}
