import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Empty } from "./Shell";
import { LearnerSearch } from "./SchoolTools";

type Pick = { id: string; first_name: string; last_name: string; admission_no: string; classes?: { name: string } | null };
const LATE = ["Transport delay", "Medical appointment", "Weather", "Family matter", "No reason given"];
const EARLY = ["Sick / sick bay", "Medical appointment", "Family emergency", "Funeral", "Sport / school event"];

/** Front-gate register: late arrivals and early sign-outs with collector verification. */
export function GateRegister({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"late_arrival" | "early_departure">("late_arrival");
  const [who, setWho] = useState<Pick | null>(null);
  const [reason, setReason] = useState(LATE[0]!);
  const [col, setCol] = useState({ name: "", rel: "Mother", checked: false });
  const [busy, setBusy] = useState(false);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const list = useQuery({
    queryKey: ["gate", schoolId],
    queryFn: async () => (await supabase.from("gate_logs").select("id, kind, reason, collected_by, collector_relationship, collector_id_checked, logged_at, students(first_name, last_name, admission_no)").eq("school_id", schoolId).gte("logged_at", start.toISOString()).order("logged_at", { ascending: false }).limit(200)).data ?? [],
  });
  const switchKind = (k: typeof kind) => { setKind(k); setReason((k === "late_arrival" ? LATE : EARLY)[0]!); };
  const save = async () => {
    if (!who || busy) return;
    if (kind === "early_departure" && (!col.name.trim() || !col.checked)) { toast.error("Enter who is collecting and confirm you checked their ID"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("gate_logs").insert({ school_id: schoolId, student_id: who.id, kind, reason, logged_by: u.user?.id, ...(kind === "early_departure" ? { collected_by: col.name.trim(), collector_relationship: col.rel, collector_id_checked: true } : {}) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${who.first_name} ${kind === "late_arrival" ? "logged as late" : "signed out"}`);
    setWho(null); setCol({ name: "", rel: "Mother", checked: false });
    void qc.invalidateQueries({ queryKey: ["gate", schoolId] });
  };
  const rows = list.data ?? [];
  return (
    <Card title={`Gate register — today (${rows.filter((r) => r.kind === "late_arrival").length} late · ${rows.filter((r) => r.kind === "early_departure").length} signed out)`}>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={kind === "late_arrival" ? "default" : "outline"} onClick={() => switchKind("late_arrival")}>Late arrival</Button>
        <Button size="sm" variant={kind === "early_departure" ? "default" : "outline"} onClick={() => switchKind("early_departure")}>Early sign-out / sick bay</Button>
      </div>
      {who ? <div className="mb-2 flex items-center justify-between rounded-md border p-2 text-sm"><span><b>{who.first_name} {who.last_name}</b> · {who.admission_no} {who.classes?.name ? `· ${who.classes.name}` : ""}</span><Button size="sm" variant="ghost" onClick={() => setWho(null)}>Change</Button></div>
        : <LearnerSearch schoolId={schoolId} onPick={(l) => setWho(l as Pick)} />}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select aria-label="Reason" className="h-9 rounded-md border bg-background px-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>{(kind === "late_arrival" ? LATE : EARLY).map((r) => <option key={r}>{r}</option>)}</select>
        {kind === "early_departure" && <>
          <Input placeholder="Full name of adult collecting" value={col.name} onChange={(e) => setCol({ ...col, name: e.target.value })} />
          <select aria-label="Relationship" className="h-9 rounded-md border bg-background px-2 text-sm" value={col.rel} onChange={(e) => setCol({ ...col, rel: e.target.value })}>{["Mother", "Father", "Legal guardian", "Grandparent", "Aunt / Uncle", "Adult sibling", "Authorised driver", "Other"].map((r) => <option key={r}>{r}</option>)}</select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={col.checked} onChange={(e) => setCol({ ...col, checked: e.target.checked })} /> I checked their ID document</label>
        </>}
      </div>
      <Button className="mt-2" size="sm" disabled={!who || busy} onClick={save}>{busy ? "Saving…" : kind === "late_arrival" ? "Log late arrival" : "Sign out learner"}</Button>
      <ul className="mt-4 max-h-72 divide-y overflow-y-auto text-sm">
        {rows.length === 0 && <Empty text="No gate entries today." />}
        {rows.map((r) => { const s = r.students as unknown as { first_name: string; last_name: string; admission_no: string } | null; return (
          <li key={r.id} className="py-2"><div className="flex justify-between gap-2"><span className="font-medium">{s?.first_name} {s?.last_name} <span className="text-xs text-muted-foreground">{s?.admission_no}</span></span><span className="text-xs text-muted-foreground">{new Date(r.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
            <p className="text-xs text-muted-foreground">{r.kind === "late_arrival" ? "Late" : "Signed out"} · {r.reason}{r.collected_by ? ` · collected by ${r.collected_by} (${r.collector_relationship}${r.collector_id_checked ? ", ID checked" : ""})` : ""}</p></li>); })}
      </ul>
    </Card>
  );
}

/** Flags learners with 3+ unexcused absences in the last 14 days (DBE early-warning). */
export function TruancyAlerts({ schoolId }: { schoolId: string }) {
  const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ["truancy", schoolId, from],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_records").select("student_id, date, students(first_name, last_name, admission_no, classes(name))").eq("school_id", schoolId).eq("status", "absent").gte("date", from).order("date", { ascending: false }).limit(5000);
      const m = new Map<string, { name: string; adm: string; cls: string; days: string[] }>();
      for (const r of data ?? []) {
        const s = r.students as unknown as { first_name: string; last_name: string; admission_no: string; classes: { name: string } | null } | null;
        const e = m.get(r.student_id) ?? { name: `${s?.first_name ?? ""} ${s?.last_name ?? ""}`, adm: s?.admission_no ?? "", cls: s?.classes?.name ?? "", days: [] };
        e.days.push(r.date); m.set(r.student_id, e);
      }
      return [...m.values()].filter((e) => e.days.length >= 3).sort((a, b) => b.days.length - a.days.length);
    },
  });
  const rows = q.data ?? [];
  return (
    <Card title={`Truancy alerts — ${rows.length} learner${rows.length === 1 ? "" : "s"} (3+ unexcused absences, last 14 days)`}>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Checking registers…</p> : rows.length === 0 ? <Empty text="No learners at risk right now." /> : (
        <ul className="max-h-80 divide-y overflow-y-auto text-sm">{rows.map((r) => (
          <li key={r.adm} className="flex justify-between gap-2 py-2"><span><b>{r.name}</b> <span className="text-xs text-muted-foreground">{r.adm} · {r.cls}</span></span><span className={r.days.length >= 5 ? "font-semibold text-destructive" : "text-warning"}>{r.days.length} days</span></li>
        ))}</ul>)}
      <p className="mt-2 text-xs text-muted-foreground">5+ days: contact parents and refer to the school-based support team. Excused absences are not counted.</p>
    </Card>
  );
}
