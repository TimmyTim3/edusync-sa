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
  students: { id: string; first_name: string; last_name: string; class_id: string | null } | null;
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
};

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
        .select("id, category, is_positive, severity, note, points, created_at, students(id, first_name, last_name, class_id)")
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

  const csv = (snap: Snapshot, name: string) => {
    const lines: string[] = [["Section", "Item", "Count"].join(",")];
    const push = (section: string, items: Counted[]) =>
      items.forEach((i) => lines.push([section, `"${i.label.replace(/"/g, '""')}"`, String(i.count)].join(",")));
    lines.push(["Summary", "Total notes", String(snap.total)].join(","));
    lines.push(["Summary", "Positive", String(snap.positive)].join(","));
    lines.push(["Summary", "Negative", String(snap.negative)].join(","));
    push("Frequent offenders", snap.offenders);
    push("Classes", snap.classes);
    push("Offence types", snap.categories);
    push("Weekly trend", snap.trend);
    snap.serious.forEach((s) =>
      lines.push(["Serious incident", `"${s.date} ${s.student} — ${s.category}: ${s.note.replace(/"/g, '""')}"`, "1"].join(",")),
    );
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <Button size="sm" variant="outline" onClick={() => csv(snapshot, `disciplinary-${filters.from}-${filters.to}`)}>
              <Download className="mr-2 h-4 w-4" />CSV
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
                  <Button size="sm" variant="ghost" onClick={() => csv(r.snapshot as unknown as Snapshot, r.title)}>
                    CSV
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
