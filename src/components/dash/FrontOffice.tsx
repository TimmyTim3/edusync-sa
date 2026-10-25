import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shell, Card, Empty } from "./Shell";
import { LearnerSearch, ParentLinker } from "./SchoolTools";
import { GateRegister } from "./BundleD";

type L = { id: string; first_name: string; last_name: string; admission_no: string; classes?: { name: string } | null };
const REASONS = ["Sick", "Medical appointment", "Family emergency", "Funeral", "Transport problem", "Other"];

/** Clerk / receptionist: lookup, guardian contacts, absence calls and gate register only — no marks or behaviour. */
export function FrontOfficeDashboard() {
  const { schoolId } = useAuth();
  const [learner, setLearner] = useState<L | null>(null);
  if (!schoolId) return <Shell title="Front office" lastUpdate={null}><Card><Empty text="Your account is not linked to a school yet." /></Card></Shell>;
  return (
    <Shell title="Front office" subtitle="Learner lookup, parent contacts, absence calls and gate register" lastUpdate={null}>
      <div className="space-y-4">
        <Card title="Find a learner"><LearnerSearch schoolId={schoolId} onPick={(l) => setLearner(l as L)} />
          {learner && <LearnerContacts learner={learner} onClose={() => setLearner(null)} />}
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <AbsenceCall schoolId={schoolId} />
          <GateRegister schoolId={schoolId} />
        </div>
        <ParentLinker schoolId={schoolId} />
      </div>
    </Shell>
  );
}

function LearnerContacts({ learner, onClose }: { learner: L; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["fo-contacts", learner.id],
    queryFn: async () => (await supabase.from("parent_student").select("id, relationship, is_primary, parents(full_name, phone, email)").eq("student_id", learner.id)).data as unknown as { id: string; relationship: string; is_primary: boolean; parents: { full_name: string; phone: string | null; email: string | null } | null }[] ?? [],
  });
  return (
    <div className="mt-3 rounded-xl border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold">{learner.first_name} {learner.last_name}</p><p className="text-xs text-muted-foreground">{learner.admission_no} · {learner.classes?.name ?? "No class"}</p></div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <p className="mt-2 text-xs font-medium uppercase text-muted-foreground">Parents / guardians</p>
      {q.data?.length === 0 && <p className="text-muted-foreground">No guardian on record — add one below.</p>}
      <ul className="mt-1 space-y-1">
        {q.data?.map((p) => (
          <li key={p.id} className="flex flex-wrap justify-between gap-2">
            <span>{p.parents?.full_name} <span className="text-muted-foreground">({p.relationship}{p.is_primary ? ", primary" : ""})</span></span>
            <span className="text-muted-foreground">{p.parents?.phone ? <a className="underline" href={`tel:${p.parents.phone}`}>{p.parents.phone}</a> : "No phone"}{p.parents?.email ? ` · ${p.parents.email}` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AbsenceCall({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [who, setWho] = useState<L | null>(null);
  const [f, setF] = useState({ date: today, reason: REASONS[0]!, by: "", channel: "phone" });
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["absence-reports", schoolId],
    queryFn: async () => (await supabase.from("absence_reports").select("id, absence_date, reason, reported_by, channel, students(first_name, last_name, admission_no)").eq("school_id", schoolId).gte("absence_date", today).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const save = async () => {
    if (!who || busy) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("absence_reports").insert({ school_id: schoolId, student_id: who.id, absence_date: f.date, reason: f.reason, reported_by: f.by.trim() || null, channel: f.channel, logged_by: u.user?.id ?? null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Absence reason saved for ${who.first_name}`);
    setWho(null); setF({ ...f, by: "" });
    void qc.invalidateQueries({ queryKey: ["absence-reports", schoolId] });
  };
  const rows = (list.data ?? []) as unknown as { id: string; absence_date: string; reason: string; reported_by: string | null; channel: string; students: { first_name: string; last_name: string; admission_no: string } | null }[];
  return (
    <Card title="Absence calls & notes">
      {who ? <p className="mb-2 text-sm">Learner: <b>{who.first_name} {who.last_name}</b> ({who.admission_no}) <button className="ml-2 text-xs underline" onClick={() => setWho(null)}>change</button></p>
        : <LearnerSearch schoolId={schoolId} onPick={(l) => setWho(l as L)} />}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Absence date" />
        <select className="rounded-md border bg-background px-2 py-2 text-sm" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} aria-label="Reason">{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        <Input placeholder="Reported by (e.g. Mother)" value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} />
        <select className="rounded-md border bg-background px-2 py-2 text-sm" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} aria-label="How reported"><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="letter">Letter / note</option><option value="walk_in">Walk-in</option></select>
      </div>
      <Button className="mt-2 w-full" disabled={!who || busy} onClick={() => void save()}>Save absence reason</Button>
      <p className="mt-3 text-xs font-medium uppercase text-muted-foreground">Logged today and ahead</p>
      {rows.length === 0 ? <Empty text="No absence calls logged yet." /> : (
        <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto text-sm">
          {rows.map((r) => <li key={r.id} className="flex justify-between gap-2 border-b py-1"><span>{r.students?.first_name} {r.students?.last_name}</span><span className="text-muted-foreground">{r.absence_date} · {r.reason}{r.reported_by ? ` · ${r.reported_by}` : ""}</span></li>)}
        </ul>
      )}
    </Card>
  );
}
