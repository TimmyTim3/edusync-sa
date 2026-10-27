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
import { DbeReport, DBE_LOGO_URL, registerCsv, reportHtml, useSchoolName } from "./DbeReport";

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

export type Offender = {
  admission: string;
  learner: string;
  grade: string;
  cls: string;
  count: number;
  highestLevel: string;
};

export type SeriousIncident = {
  date: string;
  admission: string;
  student: string;
  grade: string;
  cls: string;
  category: string;
  severity: string;
  level: string;
  points: number;
  note: string;
};

export type Snapshot = {
  generated_at: string;
  total: number;
  positive: number;
  negative: number;
  offenders: Offender[];
  classes: Counted[];
  categories: Counted[];
  trend: Counted[];
  serious: SeriousIncident[];
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
  const school = useSchoolName(schoolId);

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

      // Repeat offenders grouped by unique student
      const offenderMap = new Map<string, { admission: string; learner: string; grade: string; cls: string; count: number; maxPts: number }>();
      for (const r of negatives) {
        if (!r.students) continue;
        const sid = r.students.id;
        const c = r.students.class_id ? classMap.get(r.students.class_id) : undefined;
        const pts = Math.abs(r.points);
        const existing = offenderMap.get(sid);
        if (existing) {
          existing.count++;
          if (pts > existing.maxPts) existing.maxPts = pts;
        } else {
          offenderMap.set(sid, {
            admission: r.students.admission_no ?? "—",
            learner: `${r.students.last_name}, ${r.students.first_name}`,
            grade: c?.grade ?? "",
            cls: c?.name ?? "Unassigned",
            count: 1,
            maxPts: pts,
          });
        }
      }
      const offenders: Offender[] = [...offenderMap.values()]
        .map((o) => ({
          admission: o.admission,
          learner: o.learner,
          grade: o.grade,
          cls: o.cls,
          count: o.count,
          highestLevel: LEVEL(-o.maxPts),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const serious: SeriousIncident[] = negatives
        .filter((r) => r.severity === "high" || r.severity === "serious" || r.points <= -10)
        .slice(0, 50)
        .map((r) => {
          const c = r.students?.class_id ? classMap.get(r.students.class_id) : undefined;
          return {
            date: r.created_at.slice(0, 10),
            admission: r.students?.admission_no ?? "—",
            student: r.students ? `${r.students.last_name}, ${r.students.first_name}` : "Unknown",
            grade: c?.grade ?? "",
            cls: c?.name ?? "Unassigned",
            category: r.category,
            severity: r.severity,
            level: LEVEL(r.points),
            points: r.points,
            note: r.note,
          };
        });

      const snap: Snapshot = {
        generated_at: new Date().toISOString(),
        total: rows.length,
        positive: rows.length - negatives.length,
        negative: negatives.length,
        offenders,
        classes: tally(
          negatives.map((r) => {
            const c = r.students?.class_id ? classMap.get(r.students.class_id) : undefined;
            return c?.name ?? "Unassigned";
          }),
        ).slice(0, 15),
        categories: tally(negatives.map((r) => r.category)).slice(0, 15),
        trend: tally(negatives.map((r) => weekKey(r.created_at))).sort((a, b) => a.label.localeCompare(b.label)),
        serious,
        register: rows.map((r) => {
          const c = r.students?.class_id ? classMap.get(r.students.class_id) : undefined;
          return {
            date: r.created_at.slice(0, 10),
            admission: r.students?.admission_no ?? "",
            learner: r.students ? `${r.students.last_name}, ${r.students.first_name}` : "Unknown",
            grade: c?.grade ?? "",
            cls: c?.name ?? "",
            type: r.is_positive ? "Merit" : "Demerit",
            category: r.category,
            level: LEVEL(r.points),
            points: r.points,
            note: r.note,
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
      created_by: user.id,
      title,
      period_start: filters.from,
      period_end: filters.to,
      filters: filters as unknown as Json,
      snapshot: snapshot as unknown as Json,
      prepared_for_hearing: hearing,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(hearing ? "Report tagged for SGB hearing" : "Saved to archive");
    void qc.invalidateQueries({ queryKey: ["disc-archive", schoolId] });
  };

  const csv = async (snap: Snapshot, name: string) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const head = [[school.data?.name ?? "School"], ["DBE Learner Discipline Register"], [`Period: ${filters.from} to ${filters.to}`], [`Generated: ${new Date(snap.generated_at).toLocaleString("en-ZA")}`], []];
    const levels = [1, 2, 3, 4, 5].map((lvl) => {
      const reg = snap.register ?? [];
      const m = reg.filter((r) => r.level === `Level ${lvl}` && r.type === "Merit").length;
      const d = reg.filter((r) => r.level === `Level ${lvl}` && r.type === "Demerit").length;
      return [`Level ${lvl}`, { m, d }] as const;
    });
    const summary = XLSX.utils.aoa_to_sheet([
      ...head,
      ["1. SUMMARY OF INCIDENTS"], ["Measure", "Total"],
      ["Total behaviour entries", snap.total], ["Merits", snap.positive], ["Demerits / concerns", snap.negative], [],
      ["2. SASA LEVEL BREAKDOWN"], ["Level", "Merits", "Demerits"], ...levels.map(([k, v]) => [k, v.m, v.d]), [],
      ["3. TOP REPEAT OFFENDERS"], ["Admission No", "Learner", "Class", "Incidents", "Highest SASA Level"], ...snap.offenders.slice(0, 10).map((x) => [x.admission, x.learner, x.cls, x.count, x.highestLevel]), [],
      ["4. SIGN-OFF"], ["Principal (name & signature):", ""], ["Chairperson, SGB Disciplinary Committee:", ""], ["Date:", ""], ["School stamp:", ""],
    ]);
    summary["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, summary, "Summary");

    const reg = XLSX.utils.aoa_to_sheet([
      ...head,
      ["No.", "Date", "Admission No", "Learner (Surname, Name)", "Grade", "Class", "Type", "Offence / Merit", "SASA Level", "Points", "Description"],
      ...(snap.register ?? []).map((r, i) => [i + 1, r.date, r.admission, r.learner, r.grade, r.cls, r.type, r.category, r.level, r.points, r.note]),
    ]);
    reg["!cols"] = [5, 11, 14, 26, 6, 8, 9, 22, 10, 7, 50].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, reg, "Incident Register");

    const table = (title: string, items: Counted[], h: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...head, [h, "Incidents"], ...items.map((x) => [x.label, x.count])]), title);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ...head,
      ["Admission No", "Learner", "Class", "Incidents", "Highest SASA Level"],
      ...snap.offenders.map((x) => [x.admission, x.learner, x.cls, x.count, x.highestLevel]),
    ]), "Repeat Offenders");
    table("By Class", snap.classes, "Class");
    table("By Offence", snap.categories, "Offence");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ...head,
      ["Date", "Admission No", "Learner", "Class", "Offence", "SASA Level", "Severity", "Description"],
      ...snap.serious.map((x) => [x.date, x.admission, x.student, x.cls, x.category, x.level, x.severity, x.note]),
    ]), "Serious - SGB Hearing");

    XLSX.writeFile(wb, `${name.replace(/[^\w-]+/g, "_")}.xlsx`);
  };

  const grades = [...new Set((classes.data ?? []).map((c) => c.grade))].sort();
  const schoolName = school.data?.name ?? "School";
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

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
        <Card title={`Official register · ${filters.from} to ${filters.to}`}>
          <div className="mb-4 flex flex-wrap gap-2 print:hidden">
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />PDF / Print
            </Button>
            <Button size="sm" variant="outline" onClick={() => void csv(snapshot, `disciplinary-${filters.from}-${filters.to}`)}>
              <Download className="mr-2 h-4 w-4" />Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => download(new Blob([reportHtml(snapshot, `${filters.from} to ${filters.to}`, schoolName, `${window.location.origin}${DBE_LOGO_URL}`)], { type: "application/msword" }), `disciplinary-${filters.from}-${filters.to}.doc`)}>
              <Download className="mr-2 h-4 w-4" />Word
            </Button>
            <Button size="sm" variant="outline" onClick={() => download(new Blob([registerCsv(snapshot)], { type: "text/csv;charset=utf-8" }), `disciplinary-${filters.from}-${filters.to}.csv`)}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void save(false)}>
              <Save className="mr-2 h-4 w-4" />Save to archive
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void save(true)}>
              <Gavel className="mr-2 h-4 w-4" />Prepare for hearing
            </Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground print:hidden">For PDF: tap "PDF / Print", then choose "Save as PDF".</p>
          <DbeReport snapshot={snapshot} period={`${filters.from} to ${filters.to}`} school={schoolName} />
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
    
