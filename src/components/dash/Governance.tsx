import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { assessmentStatus } from "@/lib/governance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty } from "./Shell";

const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };
type Term = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };

export function YearTermManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [yearId, setYearId] = useState("");
  const [y, setY] = useState({ name: "", start_date: "", end_date: "" });
  const [t, setT] = useState({ name: "", start_date: "", end_date: "" });
  const [drafts, setDrafts] = useState<Record<string, { start_date: string; end_date: string }>>({});

  const years = useQuery({
    queryKey: ["gov-years", schoolId],
    queryFn: async () => (await supabase.from("academic_years").select("id, name, start_date, end_date, is_current").eq("school_id", schoolId).order("start_date")).data ?? [],
  });
  const list = (years.data ?? []) as Year[];
  const active = list.find((x) => x.id === yearId) ?? list.find((x) => x.is_current) ?? list[0];

  const terms = useQuery({
    queryKey: ["gov-terms", active?.id],
    enabled: !!active,
    queryFn: async () => (await supabase.from("terms").select("id, name, start_date, end_date, is_current").eq("academic_year_id", active!.id).order("start_date")).data ?? [],
  });
  const termList = ((terms.data ?? []) as Term[]);

  const addYear = async () => {
    if (!y.name || !y.start_date || !y.end_date) { toast.error("Fill in the year name, first and last day"); return; }
    const { error } = await supabase.from("academic_years").insert({ school_id: schoolId, name: y.name, start_date: y.start_date, end_date: y.end_date, is_current: list.length === 0 });
    if (error) { toast.error(error.message); return; }
    toast.success(`Academic year ${y.name} added`);
    setY({ name: "", start_date: "", end_date: "" });
    void qc.invalidateQueries({ queryKey: ["gov-years", schoolId] });
  };

  const addTerm = async () => {
    if (!active || !t.name || !t.start_date || !t.end_date) { toast.error("Fill in the term name, first and last day"); return; }
    const { error } = await supabase.from("terms").insert({ school_id: schoolId, academic_year_id: active.id, name: t.name, start_date: t.start_date, end_date: t.end_date, is_current: false });
    if (error) { toast.error(error.message); return; }
    toast.success(`${t.name} added to ${active.name}`);
    setT({ name: "", start_date: "", end_date: "" });
    void qc.invalidateQueries({ queryKey: ["gov-terms", active.id] });
  };

  const saveTerm = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    const { error } = await supabase.from("terms").update({ start_date: d.start_date, end_date: d.end_date }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Term dates saved");
    void qc.invalidateQueries({ queryKey: ["gov-terms", active?.id] });
  };

  const setCurrent = async (kind: "year" | "term", id: string) => {
    const table = kind === "year" ? "academic_years" : "terms";
    const ids = kind === "year" ? list.map((x) => x.id) : termList.map((x) => x.id);
    const { error: e1 } = await supabase.from(table).update({ is_current: false }).in("id", ids);
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await supabase.from(table).update({ is_current: true }).eq("id", id);
    if (e2) { toast.error(e2.message); return; }
    toast.success(kind === "year" ? "Current academic year updated" : "Current term updated");
    void qc.invalidateQueries({ queryKey: ["gov-years", schoolId] });
    void qc.invalidateQueries({ queryKey: ["gov-terms", active?.id] });
  };

  return (
    <Card title="Academic year & terms">
      <p className="mb-2 text-xs text-muted-foreground">Set the school's academic years and Term 1–4 dates. The current year and term label dashboards while past records stay intact.</p>
      {list.length === 0 ? (
        <Empty text="No academic years yet — add one below." />
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select className={sel} value={active?.id ?? ""} onChange={(e) => setYearId(e.target.value)} aria-label="Academic year">
            {list.map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_current ? " (current)" : ""} · {x.start_date} → {x.end_date}</option>)}
          </select>
          {active && !active.is_current && <Button size="sm" variant="outline" onClick={() => void setCurrent("year", active.id)}>Set as current year</Button>}
        </div>
      )}
      {active && (
        <div className="space-y-1">
          {termList.map((row) => {
            const d = drafts[row.id] ?? row;
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 font-medium">{row.name}</span>
                <Input className="h-8 w-36" type="date" value={d.start_date} onChange={(e) => setDrafts({ ...drafts, [row.id]: { start_date: e.target.value, end_date: d.end_date } })} />
                <Input className="h-8 w-36" type="date" value={d.end_date} onChange={(e) => setDrafts({ ...drafts, [row.id]: { start_date: d.start_date, end_date: e.target.value } })} />
                {row.is_current ? (
                  <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Current</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void setCurrent("term", row.id)}>Set current</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void saveTerm(row.id)}>Save dates</Button>
              </div>
            );
          })}
          {termList.length === 0 && <Empty text="No terms yet for this year." />}
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Input placeholder="e.g. 2027" value={y.name} onChange={(e) => setY({ ...y, name: e.target.value })} />
        <Input type="date" value={y.start_date} onChange={(e) => setY({ ...y, start_date: e.target.value })} />
        <Input type="date" value={y.end_date} onChange={(e) => setY({ ...y, end_date: e.target.value })} />
      </div>
      <Button size="sm" className="mt-2" onClick={addYear}>Add academic year</Button>
      {active && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Input placeholder="e.g. Term 1" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
            <Input type="date" value={t.start_date} onChange={(e) => setT({ ...t, start_date: e.target.value })} />
            <Input type="date" value={t.end_date} onChange={(e) => setT({ ...t, end_date: e.target.value })} />
          </div>
          <Button size="sm" variant="outline" className="mt-2" onClick={addTerm}>Add term to {active.name}</Button>
        </>
      )}
    </Card>
  );
}

type Asm = { id: string; title: string; type: string; date: string; max_marks: number; checked_at: string | null; locked_at: string | null; marks: { count: number }[] };

export function HodMarkReview({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [classId, setClassId] = useState("");
  const classes = useQuery({
    queryKey: ["hod-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("grade").order("name")).data ?? [],
  });
  const list = useQuery({
    queryKey: ["hod-assessments", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("assessments").select("id, title, type, date, max_marks, checked_at, locked_at, marks(count)").eq("class_id", classId).order("date", { ascending: false }).limit(200)).data ?? [],
  });
  const rows = ((list.data ?? []) as unknown as Asm[]);
  const lockedCount = rows.filter((r) => r.locked_at).length;

  const setStatus = async (a: Asm, patch: { checked_at?: string | null; checked_by?: string | null; locked_at?: string | null }, msg: string) => {
    const { error } = await supabase.from("assessments").update(patch).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ["hod-assessments", classId] });
  };

  const chip = {
    draft: "rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground",
    checked: "rounded bg-success/15 px-2 py-0.5 text-xs text-success",
    locked: "rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive",
  };
  const label = { draft: "Draft", checked: "Checked", locked: "Locked" };

  return (
    <Card title="HOD / Principal: mark check & lock">
      <p className="mb-2 text-xs text-muted-foreground">Review each assessment, then check and lock it. Locked marks can no longer be changed by teachers, and every check, lock and unlock is written to the audit log.</p>
      <select className={sel} value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class">
        <option value="">Choose a class…</option>
        {((classes.data ?? []) as { id: string; name: string }[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {classId && rows.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{rows.length} assessment{rows.length === 1 ? "" : "s"} · {lockedCount} locked</p>}
      {classId && rows.length === 0 && <Empty text="No assessments captured for this class yet." />}
      <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
        {rows.map((a) => {
          const st = assessmentStatus(a.checked_at, a.locked_at);
          const entered = a.marks?.[0]?.count ?? 0;
          return (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.date} · {a.type} · out of {a.max_marks} · {entered} mark{entered === 1 ? "" : "s"} entered</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={chip[st]}>{label[st]}</span>
                {st === "draft" && <Button size="sm" variant="outline" onClick={() => void setStatus(a, { checked_at: new Date().toISOString(), checked_by: user!.id }, "Marks checked")}>Check</Button>}
                {st !== "locked" && <Button size="sm" onClick={() => void setStatus(a, { locked_at: new Date().toISOString() }, "Assessment locked")}>Lock</Button>}
                {st === "locked" && <Button size="sm" variant="outline" onClick={() => void setStatus(a, { locked_at: null }, "Assessment unlocked — recorded in audit log")}>Unlock</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
