import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, Empty } from "./Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Lock, ShieldAlert, CheckCircle2, Clock, Search } from "lucide-react";

export function AttendanceLockSettingsCard({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [cutoffTime, setCutoffTime] = useState("09:30");
  const [autoLock, setAutoLock] = useState(true);
  const [lockPastDays, setLockPastDays] = useState(1);
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ["attendance-lock-settings", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_lock_settings")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setCutoffTime(data.register_cutoff_time.slice(0, 5));
        setAutoLock(data.auto_lock_after_submission);
        setLockPastDays(data.lock_past_days);
      }
      return data;
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("attendance_lock_settings").upsert(
        {
          school_id: schoolId,
          register_cutoff_time: `${cutoffTime}:00`,
          auto_lock_after_submission: autoLock,
          lock_past_days: lockPastDays,
          principal_override_required: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id" }
      );
      if (error) throw error;
      toast.success("Attendance lockdown policy updated");
      void qc.invalidateQueries({ queryKey: ["attendance-lock-settings", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save lock settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Register Lockdown Policy" subtitle="Enforce official DBE register cutoffs & teacher edit restrictions">
      <div className="space-y-3.5 text-xs">
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Daily Morning Cutoff Time
            </span>
            <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} className="w-28 h-8 text-xs font-mono" />
          </div>
          <p className="text-[11px] text-muted-foreground">Class teachers cannot edit registers after this morning cutoff.</p>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-primary" /> Lock Past Days
            </span>
            <select
              value={lockPastDays}
              onChange={(e) => setLockPastDays(Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-xs font-medium"
            >
              <option value={0}>Same-day lock only</option>
              <option value={1}>Lock registers older than 1 day</option>
              <option value={2}>Lock registers older than 2 days</option>
              <option value={7}>Lock registers older than 7 days</option>
            </select>
          </div>
          <p className="text-[11px] text-muted-foreground">Historical registers cannot be changed by class teachers without Principal approval.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
          <div>
            <p className="font-medium text-foreground">Auto-Lock Upon Teacher Submission</p>
            <p className="text-[11px] text-muted-foreground">Immediately freezes register once teacher marks all learners present/absent.</p>
          </div>
          <input type="checkbox" checked={autoLock} onChange={(e) => setAutoLock(e.target.checked)} className="h-4 w-4 accent-primary rounded" />
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Save Lockdown Policy
        </Button>
      </div>
    </Card>
  );
  }
export function PrincipalOverrideCard({ schoolId }: { schoolId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [targetStudent, setTargetStudent] = useState<any>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<"PRESENT" | "ABSENT" | "LATE" | "EXCUSED">("EXCUSED");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const searchResults = useQuery({
    queryKey: ["search-students-override", schoolId, searchTerm],
    enabled: searchTerm.trim().length >= 2,
    queryFn: async () => {
      const q = searchTerm.trim();
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_number, class_id, classes:class_id(name, grade)")
        .eq("school_id", schoolId)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_number.ilike.%${q}%`)
        .limit(6);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const existingRecord = useQuery({
    queryKey: ["student-attendance-date", targetStudent?.id, date],
    enabled: !!targetStudent?.id && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, status, note, marked_by, created_at")
        .eq("student_id", targetStudent.id)
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const presets = [
    "Medical certificate verified",
    "Bereavement / Family emergency",
    "District sports / Olympiad",
    "Transport breakdown / strike",
    "Principal approved administrative discretion",
  ];

  const handleApplyOverride = async () => {
    if (!targetStudent) return toast.error("Please search and select a learner");
    if (!reason.trim()) return toast.error("Justification note is mandatory for DBE audit trail");
    if (!user?.id) return toast.error("User session missing");

    setSubmitting(true);
    try {
      const payload: any = {
        school_id: schoolId,
        student_id: targetStudent.id,
        date,
        status,
        note: reason.trim(),
        marked_by: user.id,
        class_id: targetStudent.class_id,
        updated_at: new Date().toISOString(),
      };

      if (existingRecord.data?.id) {
        payload.id = existingRecord.data.id;
      }

      const { error } = await supabase.from("attendance_records").upsert(payload, { onConflict: "student_id,date" });
      if (error) throw error;

      toast.success("Attendance override authorized & recorded in DBE audit ledger");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["student-attendance-date"] });
      void qc.invalidateQueries({ queryKey: ["attendance-audit-ledger", schoolId] });
      void qc.invalidateQueries({ queryKey: ["principal-stats", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to authorize override");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Authorize Attendance Override" subtitle="Principal / Deputy sign-off to retrospectively amend marked register">
      <div className="space-y-3.5 text-xs">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Find Learner (Name or Admission No):</label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="e.g. Dlamini or 2024-001"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
          {searchResults.data && searchResults.data.length > 0 && !targetStudent && (
            <div className="mt-1 divide-y rounded-md border bg-popover shadow-sm">
              {searchResults.data.map((st: any) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setTargetStudent(st);
                    setSearchTerm("");
                  }}
                  className="w-full p-2 text-left hover:bg-muted text-xs flex justify-between"
                >
                  <span className="font-semibold text-foreground">{st.last_name}, {st.first_name}</span>
                  <span className="text-muted-foreground">Adm: {st.admission_number} • Gr {st.classes?.grade}-{st.classes?.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {targetStudent && (
          <div className="rounded-lg border bg-primary/5 p-2.5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{targetStudent.last_name}, {targetStudent.first_name} ({targetStudent.admission_number})</p>
              <p className="text-[11px] text-muted-foreground">
                Current record for {date}: <span className="font-semibold text-foreground">{existingRecord.data?.status || "Unmarked / Not recorded"}</span>
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setTargetStudent(null)}>Change</Button>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Register Date:</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-8 text-xs" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Authorized New Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-1 w-full h-8 rounded-md border bg-background px-2 text-xs font-semibold"
            >
              <option value="PRESENT">PRESENT (Attended)</option>
              <option value="EXCUSED">EXCUSED (Valid Doctor / Official)</option>
              <option value="LATE">LATE (Arrival after cutoff)</option>
              <option value="ABSENT">ABSENT (Unexcused)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Mandatory Audit Justification (DBE SGB Compliance):</label>
          <div className="flex flex-wrap gap-1 mt-1 mb-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className="rounded border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                + {p}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="State exact legal or medical justification for this override..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="text-xs h-16"
          />
        </div>

        <Button size="sm" onClick={handleApplyOverride} disabled={submitting || !targetStudent} className="w-full">
          <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Authorize & Sign Attendance Override
        </Button>
      </div>
    </Card>
  );
}

export function AuditedOverrideLedger({ schoolId }: { schoolId: string }) {
  const ledger = useQuery({
    queryKey: ["attendance-audit-ledger", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, actor_email, action, details, created_at")
        .eq("school_id", schoolId)
        .eq("action", "attendance_override")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card title="Attendance Override Audit Trail" subtitle="Immutable ledger of all Principal / SGB authorized register edits">
      <div className="space-y-2 text-xs">
        {ledger.data?.map((entry) => {
          const d = (entry.details as any) || {};
          return (
            <div key={entry.id} className="rounded-lg border bg-card p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{d.reason || "Override signed"}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{new Date(entry.created_at).toLocaleDateString("en-ZA")}</span>
              </div>
              <p className="text-muted-foreground">
                Date: <span className="font-medium text-foreground">{d.date}</span> • Changed from <span className="font-medium text-rose-600">{d.previous_status || "None"}</span> ➔ <span className="font-medium text-emerald-600">{d.status}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Authorized by: <span className="font-mono text-foreground">{entry.actor_email}</span></p>
            </div>
          );
        })}
        {ledger.data?.length === 0 && <Empty text="No attendance override entries recorded in ledger." />}
      </div>
    </Card>
  );
}

export function AttendanceLockdown({ schoolId }: { schoolId: string }) {
  return (
    <div className="space-y-4 col-span-full">
      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceLockSettingsCard schoolId={schoolId} />
        <PrincipalOverrideCard schoolId={schoolId} />
      </div>
      <AuditedOverrideLedger schoolId={schoolId} />
    </div>
  );
                }
