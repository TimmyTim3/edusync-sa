import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, Empty } from "./Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Plus, Trash2, Users } from "lucide-react";

export function SubjectStreamsManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [grades, setGrades] = useState("10,11,12");
  const [selectedSubjs, setSelectedSubjs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const subjects = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code, grades")
        .eq("school_id", schoolId)
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const streams = useQuery({
    queryKey: ["subject-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_streams")
        .select("*")
        .eq("school_id", schoolId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Please enter a stream package name");
    if (selectedSubjs.length === 0) return toast.error("Select at least one subject for this stream");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("subject_streams").insert({
        school_id: schoolId,
        name: name.trim(),
        grades: grades.trim(),
        subject_ids: selectedSubjs,
      });
      if (error) throw error;
      toast.success("Stream package created");
      setName("");
      setSelectedSubjs([]);
      void qc.invalidateQueries({ queryKey: ["subject-streams", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create stream");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stream package?")) return;
    const { error } = await supabase.from("subject_streams").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Stream package removed");
      void qc.invalidateQueries({ queryKey: ["subject-streams", schoolId] });
    }
  };

  const toggleSubj = (id: string) => {
    setSelectedSubjs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Card title="FET Subject Streams" subtitle="Predefined elective packages (e.g., Pure Sciences, Commerce, Humanities)">
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">Create New Stream Package</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Stream Name (e.g. Pure Science)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Grades (e.g. 10,11,12)" value={grades} onChange={(e) => setGrades(e.target.value)} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">Select Subjects in Package:</p>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border rounded bg-background">
              {subjects.data?.map((s) => {
                const active = selectedSubjs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubj(s.id)}
                    className={`rounded px-2 py-0.5 text-xs font-medium border transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={submitting} className="w-full">
            <Plus className="mr-1 h-3.5 w-3.5" /> Save Stream Package
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Active Packages ({streams.data?.length ?? 0})</p>
          {streams.data?.map((st) => (
            <div key={st.id} className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-xs">
              <div>
                <p className="font-semibold text-foreground">{st.name} <span className="text-[11px] font-normal text-muted-foreground">(Grades {st.grades})</span></p>
                <p className="text-[11px] text-muted-foreground">
                  {st.subject_ids.map((sid) => subjects.data?.find((s) => s.id === sid)?.name || "Subject").join(", ")}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => void handleDelete(st.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {streams.data?.length === 0 && <Empty text="No elective stream packages defined yet." />}
        </div>
      </div>
    </Card>
  );
        }
export function LearnerSubjectAllocation({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const classes = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, grade").eq("school_id", schoolId).order("grade").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subjects = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).eq("archived", false).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const learners = useQuery({
    queryKey: ["learners-for-class", selectedClassId],
    enabled: !!selectedClassId,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, first_name, last_name, admission_number").eq("class_id", selectedClassId).eq("status", "ACTIVE").order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleBulkEnroll = async () => {
    if (!selectedClassId) return toast.error("Please pick a class");
    if (!selectedSubjectId) return toast.error("Please pick a subject");
    const list = learners.data ?? [];
    if (list.length === 0) return toast.error("No active learners in this class");

    setSaving(true);
    try {
      const todayDate = new Date().toISOString().split("T")[0];
      const inserts = list.map((l) => ({
        school_id: schoolId,
        student_id: l.id,
        subject_id: selectedSubjectId,
        effective_from: todayDate,
        status: "ACTIVE",
      }));

      for (let i = 0; i < inserts.length; i += 50) {
        const batch = inserts.slice(i, i + 50);
        const { error } = await supabase.from("learner_subject_allocations").insert(batch);
        if (error) throw error;
      }

      toast.success(`Enrolled ${list.length} learners into subject successfully`);
      void qc.invalidateQueries({ queryKey: ["subject-allocations", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to allocate subject");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Class Subject Allocation" subtitle="Bulk-enroll learners of a class into specific elective subjects">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Select Class:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs"
            >
              <option value="">-- Choose Class --</option>
              {classes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  Grade {c.grade} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Select Subject:</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs"
            >
              <option value="">-- Choose Subject --</option>
              {subjects.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedClassId && (
          <div className="rounded-lg border bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Users className="h-4 w-4 text-primary" />
              {learners.isLoading ? "Loading roll..." : `${learners.data?.length ?? 0} active learners ready for enrollment`}
            </span>
            <Button size="sm" onClick={handleBulkEnroll} disabled={saving || learners.isLoading || (learners.data?.length ?? 0) === 0}>
              {saving ? "Enrolling..." : "Enroll Whole Class"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function SubjectChangeRequests({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();

  const changes = useQuery({
    queryKey: ["subject-changes", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_changes")
        .select(`
          id, student_id, from_subject_id, to_subject_id, reason, status, effective_date, consent_url, created_at,
          students:student_id (id, first_name, last_name, admission_number),
          from_subject:from_subject_id (id, name),
          to_subject:to_subject_id (id, name)
        `)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("subject_changes")
        .update({
          status: decision,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Subject change request ${decision}`);
      void qc.invalidateQueries({ queryKey: ["subject-changes", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update request");
    }
  };

  return (
    <Card title="Subject Change Audit Ledger" subtitle="Formal record of elective changes preserving historical marks">
      <div className="space-y-2.5">
        {changes.data?.map((ch: any) => (
          <div key={ch.id} className="rounded-lg border bg-card p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                {ch.students?.last_name}, {ch.students?.first_name} ({ch.students?.admission_number})
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                ch.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                ch.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
              }`}>
                {ch.status.toUpperCase()}
              </span>
            </div>
            <p className="text-muted-foreground">
              From: <span className="font-medium text-foreground">{ch.from_subject?.name || "Initial Allocation"}</span> ➔ To: <span className="font-medium text-foreground">{ch.to_subject?.name || "Unknown"}</span>
            </p>
            <p className="text-muted-foreground">
              Reason: <span className="text-foreground">{ch.reason}</span> • Effective: {ch.effective_date}
            </p>
            {ch.status === "pending" && (
              <div className="flex gap-2 pt-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700" onClick={() => void handleDecision(ch.id, "approved")}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve Change
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-rose-700" onClick={() => void handleDecision(ch.id, "rejected")}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
        {changes.data?.length === 0 && <Empty text="No elective change records filed yet." />}
      </div>
    </Card>
  );
}

export function SubjectPlanning({ schoolId }: { schoolId: string }) {
  return (
    <div className="space-y-4 col-span-full">
      <div className="grid gap-4 lg:grid-cols-2">
        <SubjectStreamsManager schoolId={schoolId} />
        <LearnerSubjectAllocation schoolId={schoolId} />
      </div>
      <SubjectChangeRequests schoolId={schoolId} />
    </div>
  );
    }
