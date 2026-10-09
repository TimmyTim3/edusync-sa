import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Gavel, Printer, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, Empty } from "./Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Json } from "@/integrations/supabase/types";

type NoteRow = {
  id: string;
  category: string;
  is_positive: boolean;
  severity: string;
  note: string;
  points: number;
  created_at: string;
  students: { id: string; first_name: string; last_name: string; class_id: string | null; admission_no: string | null } | null;
};

type Counted = { label: string; count: number; extra?: string };

export type Snapshot = {
  generated_at: string;
  total: number;
  positive: number;
  negative: number;
  offenders: Counted[];
  classes: Counted[];
  categories: Counted[];
  trend: Counted[];
  serious: { student: string; category: string; severity: string; note: string; date: string }[];
  register?: { date: string; admission: string; learner: string; grade: string; cls: string; type: string; category: string; level: string; points: number; note: string }[];
};

const LEVEL = (pts: number) => `Level ${Math.min(5, Math.max(1, Math.ceil(Math.abs(pts) / 5)))}`;

const weekKey = (iso: string) => {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};

const monthsAgo = (n: number) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

function tally(items: string[]): Counted[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function DisciplinaryReports({ schoolId }: { schoolId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ from: monthsAgo(3), to: new Date().toISOString().slice(0, 10), grade: "", category: "" });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const classes = useQuery({
    queryKey: ["disc-classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name, grade").eq("school_id", schoolId!);
      return data ?? [];
    },
  });

  const archive = useQuery({
    queryKey: ["disc-archive", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplinary_reports")
        .select("id, title, prepared_for_hearing, created_at, filters, snapshot")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const generate = async () => {
    if (!schoolId) return;
    setBusy(true);
    try {
      const classMap = new Map((classes.data ?? []).map((c) => [c.id, c]));
      let q = supabase
        .from("behaviour_notes")
        .select("id, category, is_positive, severity, note, points, created_at, students(id, first_name, last_name, class_id, admission_no)")
        .eq("school_id", schoolId)
        .gte("created_at", `${filters.from}T00:00:00Z`)
        .lte("created_at", `${filters.to}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (filters.category) q = q.ilike("category", `%${filters.category}%`);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as NoteRow[];
      if (filters.grade) {
        rows = rows.filter((r) => {
          const c = r.students?.class_id ? classMap.get(r.students.class_id) : undefined;
          return c?.grade === filters.grade;
        });
      }
      const negatives = rows.filter((r) => !r.is_positive);
      const snap: Snapshot = {
        generated_at: new Date().toISOString(),
        total: rows.length,
        positive: rows.length - negatives.length,
        negative: negatives.length,
        offenders: tally(negatives.map((r) => (r.students ? `${r.students.first_name} ${r.students.last_name}` : "Unknown"))).slice(0, 15),
        classes: tally(
          negatives.map((r) => {
            const c = r.students?.class_id ? classMap.get(r.students.class_id) : undefined;
            return c?.name ?? "Unassigned";
          }),
        ).slice(0, 15),
        categories: tally(negatives.map((r) => r.category)).slice(0, 15),
        trend: tally(negatives.map((r) => weekKey(r.created_at))).sort((a, b) => a.label.localeCompare(b.label)),
        serious: negatives
          .filter((r) => r.severity === "high" || r.severity === "serious" || r.points <= -10)
          .slice(0, 50)
          .map((r) => ({
            student: r.students ? `${r.students.first_name} ${r.students.last_name}` : "Unknown",
            category: r.category,
            severity: r.severity,
            note: r.note,
            date: r.created_at.slice(0, 10),
          })),
        register: rows.map((r) => {
          const c = r.students?.class_id ? classMap.get(r.students.class_id) : undefined;
          return {
            date: r.created_at.slice(0, 10), admission: r.students?.admission_no ?? "", learner: r.students ? `${r.students.last_name}, ${r.students.first_name}` : "Unknown",
            grade: c?.grade ?? "", cls: c?.name ?? "", type: r.is_positive ? "Merit" : "Demerit", category: r.category, level: LEVEL(r.points), points: r.points, note: r.note,
          };
        }),
      };
      setSnapshot(snap);
      toast.success(`Report ready — ${rows.length} behaviour notes analysed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the report");
    } finally {
      setBusy(false);
    }
  };

  const save = async (hearing: boolean) => {
    if (!schoolId || !snapshot || !user) return;
    const title = `Disciplinary report ${filters.from} to ${filters.to}${filters.grade ? ` · Grade ${filters.grade}` : ""}`;
    const { error } = await supabase.from("disciplinary_reports").insert({
      school_id: schoolId,
      title,
      filters: filters as unknown as Json,
      snapshot: snapshot as unknown as Json,
      prepared_for_hearing: hearing,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(hearing ? "Saved and marked for a disciplinary hearing" : "Saved to the archive");
    void qc.invalidateQueries({ queryKey: ["disc-archive", schoolId] });
  };

  const csv = async (snap: Snapshot, name: string) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const head = [["DEPARTMENT OF BASIC EDUCATION — LEARNER DISCIPLINE REGISTER"], ["Code of Conduct report (SASA s.8)"], [`Period: ${name}`], [`Generated: ${new Date(snap.generated_at).toLocaleString("en-ZA")}`], []];
    const summary = XLSX.utils.aoa_to_sheet([...head, ["Measure", "Total"], ["Behaviour entries", snap.total], ["Merits", snap.positive], ["Demerits", snap.negative], [], ["Principal signature:", ""], ["Date:", ""]]);
    summary["!cols"] = [{ wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, summary, "Summary");
    const reg = XLSX.utils.aoa_to_sheet([...head, ["No.", "Date", "Admission No", "Learner (Surname, Name)", "Grade", "Class", "Type", "Offence / Merit", "SASA Level", "Points", "Description"],
      ...(snap.register ?? []).map((r, i) => [i + 1, r.date, r.admission, r.learner, r.grade, r.cls, r.type, r.category, r.level, r.points, r.note])]);
    reg["!cols"] = [5, 11, 14, 26, 6, 8, 9, 22, 10, 7, 50].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, reg, "Incident Register");
    const table = (title: string, items: Counted[], h: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...head, [h, "Incidents"], ...items.map((x) => [x.label, x.count])]), title);
    table("Repeat Offenders", snap.offenders, "Learner");
    table("By Class", snap.classes, "Class");
    table("By Offence", snap.categories, "Offence");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...head, ["Date", "Learner", "Offence", "Severity", "Description"], ...snap.serious.map((x) => [x.date, x.student, x.category, x.severity, x.note])]), "Serious - SGB Hearing");
    XLSX.writeFile(wb, `${name.replace(/[^\w-]+/g, "_")}.xlsx`);
  };

  const grades = [...new Set((classes.data ?? []).map((c) => c.grade))].sort();

  return (
    <div className="space-y-4">
      <Card title="Generate disciplinary report">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-muted-foreground">
            From
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">
            Grade
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={filters.grade}
              onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            >
              <option value="">All grades</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Offence type
            <Input placeholder="Any" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
          </label>
          <div className="flex items-end">
            <Button className="w-full" onClick={generate} disabled={busy}>
              <FileText className="mr-2 h-4 w-4" />
              {busy ? "Working…" : "Generate report"}
            </Button>
          </div>
        </div>
      </Card>

      {snapshot && (
        <Card title={`Report · ${filters.from} to ${filters.to}`}>
          <div className="mb-4 flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={() => void save(false)}>
              <Save className="mr-2 h-4 w-4" />Save to archive
            </Button>
            <Button size="sm" variant="outline" onClick={() => void save(true)}>
              <Gavel className="mr-2 h-4 w-4" />Prepare for hearing
            </Button>
            <Button size="sm" variant="outline" onClick={() => void csv(snapshot, `disciplinary-${filters.from}-${filters.to}`)}>
              <Download className="mr-2 h-4 w-4" />Excel register
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />Print / PDF
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs uppercase text-muted-foreground">Total notes</p>
              <p className="font-display text-2xl font-semibold">{snapshot.total}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs uppercase text-muted-foreground">Positive</p>
              <p className="font-display text-2xl font-semibold text-success">+{snapshot.positive}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs uppercase text-muted-foreground">Infractions</p>
              <p className="font-display text-2xl font-semibold text-destructive">−{snapshot.negative}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Section title="Most frequent offenders" items={snapshot.offenders} />
            <Section title="Classes with most incidents" items={snapshot.classes} />
            <Section title="Most common offences" items={snapshot.categories} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Section title="Weekly trend" items={snapshot.trend} />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Serious incidents for hearing</h3>
              {snapshot.serious.length === 0 ? (
                <Empty text="No serious incidents in this period." />
              ) : (
                <ul className="divide-y text-sm">
                  {snapshot.serious.map((s, i) => (
                    <li key={i} className="py-2">
                      <p className="font-medium">
                        {s.student} <span className="text-muted-foreground">· {s.category}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {s.date} — {s.note}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {(snapshot.register ?? []).length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Learner discipline register</h3>
              <div className="max-h-96 overflow-auto rounded-md border print:max-h-none"><table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-muted text-muted-foreground"><tr>{["Date", "Adm No", "Learner", "Gr/Class", "Type", "Offence / Merit", "Level", "Pts", "Description"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
                <tbody>{snapshot.register!.slice(0, 300).map((r, i) => <tr key={i} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{r.date}</td><td className="p-2">{r.admission || "—"}</td><td className="p-2">{r.learner}</td><td className="p-2">{r.cls || r.grade}</td>
                  <td className={`p-2 ${r.type === "Merit" ? "text-success" : "text-destructive"}`}>{r.type}</td><td className="p-2">{r.category}</td><td className="p-2">{r.level}</td><td className="p-2">{r.points}</td><td className="p-2">{r.note}</td>
                </tr>)}</tbody>
              </table></div>
            </div>
          )}
        </Card>
      )}

      <Card title="Disciplinary reports archive">
        {(archive.data ?? []).length === 0 ? (
          <Empty text="No saved reports yet." />
        ) : (
          <ul className="divide-y text-sm">
            {(archive.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">
                    {r.title}
                    {r.prepared_for_hearing && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">For hearing</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSnapshot(r.snapshot as unknown as Snapshot)}>
                    View
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void csv(r.snapshot as unknown as Snapshot, r.title)}>
                    Excel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Counted[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <Empty text="Nothing recorded." />
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.label} className="flex items-center justify-between gap-2">
              <span className="truncate">{i.label}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{i.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
