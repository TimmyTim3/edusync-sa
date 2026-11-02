import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { assessmentStatus } from "@/lib/governance";
import { truncatePct, achievementLevel } from "@/lib/caps-marks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty } from "./Shell";

const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };
type Term = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };

export type Asm = {
  id: string;
  title: string;
  type: string;
  date: string;
  max_marks: number;
  checked_at: string | null;
  locked_at: string | null;
  subject_id: string;
  subjects: { name: string } | null;
  marks: { count: number }[];
};

export type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  admission_no: string;
};

export type MarkRecord = {
  student_id: string;
  score: number | null;
};

const chip: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border px-2 py-0.5 rounded text-xs",
  checked: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 px-2 py-0.5 rounded text-xs",
  locked: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 px-2 py-0.5 rounded text-xs",
};

const label: Record<string, string> = {
  draft: "Draft · Editable",
  checked: "Checked by HOD",
  locked: "Locked · Read-only",
};

const LEVEL_DESCRIPTIONS: Record<number, { label: string; badge: string }> = {
  7: { label: "Level 7 · Outstanding (80–100%)", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  6: { label: "Level 6 · Meritorious (70–79%)", badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" },
  5: { label: "Level 5 · Substantial (60–69%)", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  4: { label: "Level 4 · Adequate (50–59%)", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
  3: { label: "Level 3 · Moderate (40–49%)", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  2: { label: "Level 2 · Elementary (30–39%)", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  1: { label: "Level 1 · Not Achieved (0–29%)", badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
};

export function YearTermManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [yearId, setYearId] = useState("");
  const [newYear, setNewYear] = useState({ name: "", start_date: "", end_date: "" });
  const [t, setT] = useState({ name: "", start_date: "", end_date: "" });

  const years = useQuery({
    queryKey: ["gov-years", schoolId],
    queryFn: async () => (await supabase.from("academic_years").select("*").eq("school_id", schoolId).order("start_date", { ascending: false })).data as Year[] ?? [],
  });

  const active = years.data?.find((y) => y.id === yearId) ?? years.data?.find((y) => y.is_current) ?? years.data?.[0];

  const terms = useQuery({
    queryKey: ["gov-terms", active?.id],
    enabled: !!active?.id,
    queryFn: async () => (await supabase.from("terms").select("*").eq("academic_year_id", active!.id).order("start_date")).data as Term[] ?? [],
  });

  const createYear = async () => {
    if (!newYear.name || !newYear.start_date || !newYear.end_date) {
      toast.error("Fill in year name, start, and end date");
      return;
    }
    const { error } = await supabase.from("academic_years").insert({ school_id: schoolId, ...newYear, is_current: (years.data?.length ?? 0) === 0 });
    if (error) { toast.error(error.message); return; }
    toast.success(`Academic year ${newYear.name} created`);
    setNewYear({ name: "", start_date: "", end_date: "" });
    void qc.invalidateQueries({ queryKey: ["gov-years", schoolId] });
  };

  const addTerm = async () => {
    if (!active) return;
    if (!t.name || !t.start_date || !t.end_date) {
      toast.error("Fill in term name and date range");
      return;
    }
    const { error } = await supabase.from("terms").insert({ academic_year_id: active.id, ...t, is_current: (terms.data?.length ?? 0) === 0 });
    if (error) { toast.error(error.message); return; }
    toast.success(`${t.name} added to ${active.name}`);
    setT({ name: "", start_date: "", end_date: "" });
    void qc.invalidateQueries({ queryKey: ["gov-terms", active.id] });
  };

  const setCurrent = async (kind: "year" | "term", id: string) => {
    if (kind === "year") {
      await supabase.from("academic_years").update({ is_current: false }).eq("school_id", schoolId);
      const { error } = await supabase.from("academic_years").update({ is_current: true }).eq("id", id);
      if (error) { toast.error(error.message); return; }
      toast.success("Current academic year updated");
      void qc.invalidateQueries({ queryKey: ["gov-years", schoolId] });
    } else {
      if (!active) return;
      await supabase.from("terms").update({ is_current: false }).eq("academic_year_id", active.id);
      const { error } = await supabase.from("terms").update({ is_current: true }).eq("id", id);
      if (error) { toast.error(error.message); return; }
      toast.success("Active term updated");
      void qc.invalidateQueries({ queryKey: ["gov-terms", active.id] });
    }
  };

  const saveTerm = async (id: string) => {
    const row = terms.data?.find((x) => x.id === id);
    if (!row) return;
    const { error } = await supabase.from("terms").update({ start_date: row.start_date, end_date: row.end_date }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Term dates saved");
  };

  return (
    <Card title="Academic Years & Terms" description="Configure the current school year and active term for attendance, marks, and reports.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Academic Year</label>
          <select className={sel} value={active?.id ?? ""} onChange={(e) => setYearId(e.target.value)}>
            {years.data?.map((y) => (
              <option key={y.id} value={y.id}>{y.name} {y.is_current ? "(Current)" : ""}</option>
            ))}
          </select>
          {active && !active.is_current && (
            <Button size="sm" variant="outline" onClick={() => void setCurrent("year", active.id)}>Set as current year</Button>
          )}
        </div>
        <div className="rounded-md border p-3 space-y-2">
          <span className="text-xs font-semibold">New Academic Year</span>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="e.g. 2026" value={newYear.name} onChange={(e) => setNewYear({ ...newYear, name: e.target.value })} />
            <Input type="date" value={newYear.start_date} onChange={(e) => setNewYear({ ...newYear, start_date: e.target.value })} />
            <Input type="date" value={newYear.end_date} onChange={(e) => setNewYear({ ...newYear, end_date: e.target.value })} />
          </div>
          <Button size="sm" onClick={createYear}>Create year</Button>
        </div>
      </div>

      {active && (
        <>
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Terms for {active.name}</label>
            <div className="space-y-1.5">
              {terms.data?.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                  <span className="w-24 font-medium">{row.name}</span>
                  <Input type="date" className="h-8 w-36 text-xs" value={row.start_date} onChange={(e) => {
                    const next = (terms.data ?? []).map((x) => x.id === row.id ? { ...x, start_date: e.target.value } : x);
                    qc.setQueryData(["gov-terms", active.id], next);
                  }} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" className="h-8 w-36 text-xs" value={row.end_date} onChange={(e) => {
                    const next = (terms.data ?? []).map((x) => x.id === row.id ? { ...x, end_date: e.target.value } : x);
                    qc.setQueryData(["gov-terms", active.id], next);
                  }} />
                  {row.is_current ? (
                    <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Current</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => void setCurrent("term", row.id)}>Set current</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void saveTerm(row.id)}>Save dates</Button>
                </div>
              ))}
              {terms.data?.length === 0 && <Empty label="No terms recorded for this academic year yet." />}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
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

export function HodMarkReview({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [classId, setClassId] = useState("");
  const [selectedAsmId, setSelectedAsmId] = useState<string | null>(null);

  const classes = useQuery({
    queryKey: ["hod-classes", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("grade").order("name")).data ?? [],
  });

  const list = useQuery({
    queryKey: ["hod-assessments", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("assessments").select("id, title, type, date, max_marks, checked_at, locked_at, subject_id, subjects(name), marks(count)").eq("class_id", classId).order("date", { ascending: false }).limit(200)).data ?? [],
  });
  const rows = ((list.data ?? []) as unknown as Asm[]);
  const lockedCount = rows.filter((r) => r.locked_at).length;
  const currentAsm = rows.find((r) => r.id === selectedAsmId);

  const setStatus = async (
    asm: Asm,
    patch: { checked_at?: string; checked_by?: string; locked_at?: string | null },
    successMsg: string
  ) => {
    const { error } = await supabase.from("assessments").update(patch).eq("id", asm.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(successMsg);
    void qc.invalidateQueries({ queryKey: ["hod-assessments", classId] });
  };

  return (
    <Card
      title="HOD & Principal Mark Review"
      description="Inspect learner mark sheets, verify CAPS distributions, and lock assessments against unauthorized teacher edits."
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-full sm:w-72">
          <select
            className={sel}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSelectedAsmId(null);
            }}
          >
            <option value="">Select a class to review...</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {classId && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{rows.length} total assessments</span>
            <span>·</span>
            <span className="font-semibold text-amber-600">{lockedCount} locked</span>
          </div>
        )}
      </div>

      {!classId && (
        <div className="mt-4">
          <Empty label="Choose a class above to inspect its assessment mark sheets." />
        </div>
      )}

      {classId && !selectedAsmId && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
          {rows.map((a) => {
            const st = assessmentStatus(a.checked_at, a.locked_at);
            const entered = a.marks?.[0]?.count ?? 0;
            const subjectName = a.subjects?.name ?? "General";
            return (
              <div key={a.id} className="rounded-md border bg-card p-3 text-sm transition hover:border-primary/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{a.title}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {subjectName}
                      </span>
                      <span className={chip[st]}>{label[st]}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.date} · {a.type} · Max {a.max_marks} marks · {entered} mark{entered === 1 ? "" : "s"} entered
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setSelectedAsmId(a.id)}
                    >
                      <span>Inspect marks</span>
                      <span>→</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span>{st === "locked" ? "Read-only for subject teachers" : "Editable by teacher until locked"}</span>
                  <span className="italic">{entered === 0 ? "No marks captured yet" : `${entered} learners marked`}</span>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <Empty label="No assessments created for this class yet." />
          )}
        </div>
      )}

      {classId && selectedAsmId && currentAsm && (
        <div className="mt-4">
          <AssessmentInspectionSheet
            asm={currentAsm}
            classId={classId}
            onClose={() => setSelectedAsmId(null)}
            onStatusChange={setStatus}
            currentUserId={user?.id ?? ""}
          />
        </div>
      )}
    </Card>
  );
}

// ========== END OF PART 1 — PASTE PART 2 DIRECTLY BELOW THIS LINE ==========
    // ========== START OF PART 2 ==========

function AssessmentInspectionSheet({
  asm,
  classId,
  onClose,
  onStatusChange,
  currentUserId,
}: {
  asm: Asm;
  classId: string;
  onClose: () => void;
  onStatusChange: (asm: Asm, patch: { checked_at?: string; checked_by?: string; locked_at?: string | null }, msg: string) => Promise<void>;
  currentUserId: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["hod-class-students", classId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_no")
        .eq("class_id", classId)
        .is("deleted_at", null)
        .order("last_name")
        .order("first_name");
      return (data ?? []) as StudentRow[];
    },
  });

  const marksQuery = useQuery({
    queryKey: ["hod-assessment-marks", asm.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("marks")
        .select("student_id, score")
        .eq("assessment_id", asm.id);
      return (data ?? []) as MarkRecord[];
    },
  });

  const marksMap = useMemo(() => {
    const map = new Map<string, number | null>();
    (marksQuery.data ?? []).forEach((m) => map.set(m.student_id, m.score));
    return map;
  }, [marksQuery.data]);

  const students = studentsQuery.data ?? [];
  const status = assessmentStatus(asm.checked_at, asm.locked_at);

  const overview = useMemo(() => {
    let enteredCount = 0;
    let missingCount = 0;
    let sumScores = 0;
    let highest: number | null = null;
    let lowest: number | null = null;
    let passCount = 0;

    students.forEach((s) => {
      const sc = marksMap.get(s.id);
      if (sc !== undefined && sc !== null) {
        enteredCount++;
        sumScores += sc;
        if (highest === null || sc > highest) highest = sc;
        if (lowest === null || sc < lowest) lowest = sc;
        const pct = asm.max_marks > 0 ? (sc / asm.max_marks) * 100 : 0;
        if (pct >= 40) passCount++;
      } else {
        missingCount++;
      }
    });

    const avgScore = enteredCount > 0 ? sumScores / enteredCount : null;
    const avgPct = avgScore !== null && asm.max_marks > 0 ? truncatePct((avgScore / asm.max_marks) * 100) : null;
    const passRate = enteredCount > 0 ? truncatePct((passCount / enteredCount) * 100) : null;

    return {
      totalStudents: students.length,
      enteredCount,
      missingCount,
      avgPct,
      highest,
      lowest,
      passRate,
    };
  }, [students, marksMap, asm.max_marks]);

  const levelCounts = useMemo(() => {
    const counts: Record<number, number> = { 7: 0, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    students.forEach((s) => {
      const sc = marksMap.get(s.id);
      if (sc !== undefined && sc !== null && asm.max_marks > 0) {
        const pct = truncatePct((sc / asm.max_marks) * 100);
        const lvl = achievementLevel(pct);
        counts[lvl] = (counts[lvl] || 0) + 1;
      }
    });
    return counts;
  }, [students, marksMap, asm.max_marks]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      s.admission_no?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            ← Back to assessment list
          </Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground text-base sm:text-lg">{asm.title}</h3>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {asm.subjects?.name ?? "General"}
            </span>
            <span className={chip[status]}>{label[status]}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {asm.date} · Type: {asm.type} · Maximum: {asm.max_marks} marks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
              onClick={() =>
                void onStatusChange(
                  asm,
                  { checked_at: new Date().toISOString(), checked_by: currentUserId },
                  "Assessment verified & stamped as Checked"
                )
              }
            >
              ✓ Approve & Mark Checked
            </Button>
          )}

          {status !== "locked" ? (
            <Button
              size="sm"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() =>
                void onStatusChange(
                  asm,
                  { locked_at: new Date().toISOString() },
                  "Assessment locked (read-only for teachers)"
                )
              }
            >
              🔒 Lock Assessment
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() =>
                void onStatusChange(
                  asm,
                  { locked_at: null },
                  "Assessment unlocked — logged in audit journal"
                )
              }
            >
              🔓 Unlock Assessment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border bg-card p-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">Class Average</span>
          <p className="text-lg font-bold text-foreground">
            {overview.avgPct !== null ? `${overview.avgPct}%` : "—"}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {overview.enteredCount} of {overview.totalStudents} learners captured
          </span>
        </div>

        <div className="rounded-md border bg-card p-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">High / Low Score</span>
          <p className="text-lg font-bold text-foreground">
            {overview.highest !== null ? `${overview.highest}` : "—"} / {overview.lowest !== null ? `${overview.lowest}` : "—"}
          </p>
          <span className="text-[10px] text-muted-foreground">Out of {asm.max_marks} marks</span>
        </div>

        <div className="rounded-md border bg-card p-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">Pass Rate (≥ 40%)</span>
          <p className="text-lg font-bold text-foreground">
            {overview.passRate !== null ? `${overview.passRate}%` : "—"}
          </p>
          <span className="text-[10px] text-muted-foreground">CAPS official pass threshold</span>
        </div>

        <div className="rounded-md border bg-card p-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">Missing Marks</span>
          <p className={`text-lg font-bold ${overview.missingCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
            {overview.missingCount}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {overview.missingCount === 0 ? "All learners recorded" : "Uncaptured scores"}
          </span>
        </div>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            CAPS 7-Point Achievement Distribution
          </span>
          <span className="text-[11px] text-muted-foreground">Official DBE Scale</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
          {([7, 6, 5, 4, 3, 2, 1] as const).map((lvl) => {
            const count = levelCounts[lvl] || 0;
            const pct = overview.enteredCount > 0 ? Math.round((count / overview.enteredCount) * 100) : 0;
            return (
              <div key={lvl} className={`rounded border p-1.5 text-center ${LEVEL_DESCRIPTIONS[lvl].badge}`}>
                <div className="text-[11px] font-bold">L{lvl}</div>
                <div className="text-sm font-extrabold">{count}</div>
                <div className="text-[9px] opacity-80">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Learner Moderation Sheet ({filteredStudents.length} of {students.length})
          </h4>
          <Input
            type="search"
            placeholder="Search learner by name or admission no..."
            className="h-8 w-full sm:w-64 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-md border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
              <tr>
                <th className="py-2 px-2.5 font-medium text-muted-foreground">#</th>
                <th className="py-2 px-2.5 font-medium text-muted-foreground">Admission No</th>
                <th className="py-2 px-2.5 font-medium text-muted-foreground">Learner Name</th>
                <th className="py-2 px-2.5 font-medium text-muted-foreground text-right">Raw Mark</th>
                <th className="py-2 px-2.5 font-medium text-muted-foreground text-right">Percentage</th>
                <th className="py-2 px-2.5 font-medium text-muted-foreground text-center">CAPS Level</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredStudents.map((s, idx) => {
                const sc = marksMap.get(s.id);
                const hasScore = sc !== undefined && sc !== null;
                const pct = hasScore && asm.max_marks > 0 ? truncatePct((sc / asm.max_marks) * 100) : null;
                const lvl = pct !== null ? achievementLevel(pct) : null;

                return (
                  <tr key={s.id} className="hover:bg-muted/40 transition">
                    <td className="py-2 px-2.5 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-mono text-muted-foreground">{s.admission_no}</td>
                    <td className="py-2 px-2.5 font-medium text-foreground">
                      {s.last_name}, {s.first_name}
                    </td>
                    <td className="py-2 px-2.5 text-right font-semibold">
                      {hasScore ? (
                        <span className="text-foreground">{sc} <span className="text-[10px] text-muted-foreground">/ {asm.max_marks}</span></span>
                      ) : (
                        <span className="italic text-destructive">Unrecorded</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      {pct !== null ? (
                        <span className={pct >= 40 ? "text-foreground font-medium" : "text-destructive font-semibold"}>
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {lvl !== null ? (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${LEVEL_DESCRIPTIONS[lvl].badge}`}>
                          Level {lvl}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No learners found matching &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          Done inspecting
        </Button>

        <div className="flex items-center gap-2">
          {status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-emerald-600 border-emerald-500/40"
              onClick={() =>
                void onStatusChange(
                  asm,
                  { checked_at: new Date().toISOString(), checked_by: currentUserId },
                  "Assessment marks verified & marked as Checked"
                )
              }
            >
              ✓ Approve & Mark Checked
            </Button>
          )}

          {status !== "locked" ? (
            <Button
              size="sm"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() =>
                void onStatusChange(
                  asm,
                  { locked_at: new Date().toISOString() },
                  "Assessment locked"
                )
              }
            >
              🔒 Lock Marks (Read-only)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-destructive border-destructive/40"
              onClick={() =>
                void onStatusChange(
                  asm,
                  { locked_at: null },
                  "Assessment unlocked — recorded in audit log"
                )
              }
            >
              🔓 Unlock Marks
            </Button>
          )}
        </div>
      </div>
    </div>
  );
                                             }
                    
