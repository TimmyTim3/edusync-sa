import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty } from "./Shell";
import { StudentRecord } from "./ClassGlance";

type Learner = { id: string; first_name: string; last_name: string; admission_no: string; classes?: { name: string } | null };

function useDebounced<T>(v: T, ms = 200) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function useLearnerSearch(schoolId: string | null, term: string) {
  const q = useDebounced(term.trim());
  return useQuery({
    queryKey: ["learner-search", schoolId, q],
    enabled: !!schoolId && q.length >= 2,
    staleTime: 60_000,
    queryFn: async () => {
      const safe = q.replace(/[,%()]/g, " ");
      const parts = safe.split(/\s+/).filter(Boolean);
      let query = supabase.from("students").select("id, first_name, last_name, admission_no, classes(name)").eq("school_id", schoolId!).is("deleted_at", null);
      for (const p of parts) query = query.or(`first_name.ilike.%${p}%,last_name.ilike.%${p}%,admission_no.ilike.%${p}%`);
      const { data } = await query.order("last_name").limit(15);
      return (data ?? []) as unknown as Learner[];
    },
  });
}

/** Search any learner by name, surname or admission number; tap to open the full record. */
export function LearnerSearch({ schoolId, onPick }: { schoolId: string | null; onPick?: (l: Learner) => void }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<Learner | null>(null);
  const r = useLearnerSearch(schoolId, term);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search any learner — name, surname or admission no." value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search learners" />
      </div>
      {term.trim().length >= 2 && (
        <ul className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-md border bg-popover text-sm shadow-lg">
          {r.isFetching && !r.data && <li className="p-2 text-muted-foreground">Searching…</li>}
          {r.data?.length === 0 && <li className="p-2 text-muted-foreground">No learner found.</li>}
          {r.data?.map((l) => (
            <li key={l.id}><button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-accent" onClick={() => { if (onPick) onPick(l); else setOpen(l); setTerm(""); }}>
              <span>{l.last_name}, {l.first_name}</span><span className="text-xs text-muted-foreground">{l.admission_no} · {l.classes?.name ?? "No class"}</span>
            </button></li>
          ))}
        </ul>
      )}
      {open && <StudentRecord student={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Principal: full merits & concerns drilldown. */
export function BehaviourDrawer({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const [mode, setMode] = useState<"concerns" | "merits">("concerns");
  const [open, setOpen] = useState<Learner | null>(null);
  const q = useQuery({
    queryKey: ["behaviour-drill", schoolId, mode],
    queryFn: async () => {
      const { data } = await supabase.from("behaviour_notes")
        .select("id, category, note, points, severity, created_at, students(id, first_name, last_name, admission_no, classes(name))")
        .eq("school_id", schoolId).eq("is_positive", mode === "merits").order("created_at", { ascending: false }).limit(1000);
      return (data ?? []) as unknown as { id: string; category: string; note: string; points: number; severity: string; created_at: string; students: (Learner & { classes: { name: string } | null }) | null }[];
    },
  });
  const rows = q.data ?? [];
  const byLearner = new Map<string, { l: Learner; n: number; pts: number }>();
  const byClass = new Map<string, number>();
  for (const r of rows) {
    if (!r.students) continue;
    const e = byLearner.get(r.students.id) ?? { l: r.students, n: 0, pts: 0 };
    e.n++; e.pts += Math.abs(r.points); byLearner.set(r.students.id, e);
    const c = r.students.classes?.name ?? "No class"; byClass.set(c, (byClass.get(c) ?? 0) + 1);
  }
  const top = [...byLearner.values()].sort((a, b) => b.n - a.n).slice(0, 15);
  const classes = [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const neg = mode === "concerns";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant={neg ? "destructive" : "outline"} onClick={() => setMode("concerns")}>Concerns</Button>
            <Button size="sm" variant={!neg ? "default" : "outline"} className={!neg ? "bg-success text-success-foreground hover:bg-success/90" : ""} onClick={() => setMode("merits")}>Merits</Button>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !rows.length ? <Empty text={`No ${mode} recorded yet.`} /> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={neg ? "Repeat concerns — learners" : "Top merit earners"}>
              <ul className="divide-y text-sm">{top.map((t) => (
                <li key={t.l.id}><button className="flex w-full justify-between py-1.5 text-left hover:text-primary" onClick={() => setOpen(t.l)}>
                  <span className="truncate">{t.l.last_name}, {t.l.first_name}</span><span className={neg ? "text-destructive" : "text-success"}>{t.n}× · {neg ? "−" : "+"}{t.pts}</span>
                </button></li>))}</ul>
            </Card>
            <Card title="By class">
              <ul className="divide-y text-sm">{classes.map(([c, n]) => <li key={c} className="flex justify-between py-1.5"><span>{c}</span><span className="text-muted-foreground">{n}</span></li>)}</ul>
            </Card>
            <Card title={`Latest ${mode} (${rows.length})`}>
              <ul className="max-h-96 divide-y overflow-y-auto text-sm">{rows.slice(0, 100).map((r) => (
                <li key={r.id} className="py-1.5"><button className="w-full text-left hover:text-primary" onClick={() => r.students && setOpen(r.students)}>
                  <div className="flex justify-between gap-2"><span className="truncate font-medium">{r.students?.first_name} {r.students?.last_name}</span><span className={neg ? "text-destructive" : "text-success"}>{neg ? "−" : "+"}{Math.abs(r.points)}</span></div>
                  <p className="truncate text-xs text-muted-foreground">{r.category} · {new Date(r.created_at).toLocaleDateString()}</p>
                </button></li>))}</ul>
            </Card>
          </div>
        )}
      </div>
      {open && <StudentRecord student={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Principal: notice history with edit and delete. */
export function NoticesManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<{ id: string; title: string; body: string; urgent: boolean } | null>(null);
  const q = useQuery({
    queryKey: ["notices-all", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("notices").select("id, title, body, scope, priority, published_at, classes(name)").eq("school_id", schoolId).order("published_at", { ascending: false }).limit(300);
      return (data ?? []) as unknown as { id: string; title: string; body: string; scope: string; priority: string; published_at: string; classes: { name: string } | null }[];
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["notices-all"] }); void qc.invalidateQueries({ queryKey: ["principal-stats"] }); };
  const save = async () => {
    if (!edit) return;
    const { error } = await supabase.from("notices").update({ title: edit.title, body: edit.body, priority: edit.urgent ? "urgent" : "normal" }).eq("id", edit.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Notice updated"); setEdit(null); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this notice for all families?")) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Notice removed"); refresh();
  };
  const f = filter.toLowerCase();
  const rows = (q.data ?? []).filter((n) => !f || n.title.toLowerCase().includes(f) || n.body.toLowerCase().includes(f));
  return (
    <Card title={`Notice history (${q.data?.length ?? 0})`} className="lg:col-span-2">
      <Input className="mb-2" placeholder="Search notices…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ul className="max-h-[480px] divide-y overflow-y-auto text-sm">
        {rows.map((n) => edit?.id === n.id ? (
          <li key={n.id} className="space-y-2 py-2">
            <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <Textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={edit.urgent} onChange={(e) => setEdit({ ...edit, urgent: e.target.checked })} /> Urgent</label>
            <div className="flex gap-2"><Button size="sm" onClick={save}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
          </li>
        ) : (
          <li key={n.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="truncate font-medium">{n.priority === "urgent" && <span className="mr-1 rounded bg-destructive/15 px-1 text-xs text-destructive">Urgent</span>}{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.scope === "class" ? n.classes?.name ?? "Class" : n.scope} · {new Date(n.published_at).toLocaleString()}</p></div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={() => setEdit({ id: n.id, title: n.title, body: n.body, urgent: n.priority === "urgent" })}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(n.id)}>Remove</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function useTeachers(schoolId: string) {
  return useQuery({
    queryKey: ["school-teachers", schoolId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("school_id", schoolId).in("role", ["teacher", "school_admin"]);
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });
}

/** Principal: assign the official class teacher for each class. */
export function ClassTeacherAssign({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const t = useTeachers(schoolId);
  const c = useQuery({
    queryKey: ["classes-teachers", schoolId],
    queryFn: async () => (await supabase.from("classes").select("id, name, grade, class_teacher_id").eq("school_id", schoolId).order("grade").order("name")).data ?? [],
  });
  const set = async (id: string, teacher: string) => {
    const { error } = await supabase.from("classes").update({ class_teacher_id: teacher || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Class teacher saved"); void qc.invalidateQueries({ queryKey: ["classes-teachers"] });
  };
  return (
    <Card title="Class teachers">
      <ul className="max-h-[480px] divide-y overflow-y-auto text-sm">
        {(c.data ?? []).map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="shrink-0">{k.name}</span>
            <select aria-label={`Class teacher for ${k.name}`} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm sm:max-w-56" value={k.class_teacher_id ?? ""} onChange={(e) => set(k.id, e.target.value)}>
              <option value="">— Not assigned —</option>
              {(t.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Staff: link a parent to a learner. */
export function ParentLinker({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [learner, setLearner] = useState<Learner | null>(null);
  const [pTerm, setPTerm] = useState("");
  const pq = useDebounced(pTerm.trim());
  const [form, setForm] = useState({ parent: "", relationship: "Mother", primary: true, newName: "", newPhone: "", newEmail: "" });
  const parents = useQuery({
    queryKey: ["parent-search", schoolId, pq],
    enabled: pq.length >= 2,
    queryFn: async () => {
      const s = pq.replace(/[,%()]/g, " ");
      return (await supabase.from("parents").select("id, full_name, phone, email").eq("school_id", schoolId).or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`).limit(10)).data ?? [];
    },
  });
  const links = useQuery({
    queryKey: ["learner-links", learner?.id],
    enabled: !!learner,
    queryFn: async () => (await supabase.from("parent_student").select("id, relationship, is_primary, parents(full_name, phone)").eq("student_id", learner!.id)).data as unknown as { id: string; relationship: string; is_primary: boolean; parents: { full_name: string; phone: string | null } | null }[] ?? [],
  });
  const link = async () => {
    if (!learner) return;
    let pid = form.parent;
    if (!pid) {
      if (!form.newName) { toast.error("Pick a parent or type a new parent's name"); return; }
      const { data, error } = await supabase.from("parents").insert({ school_id: schoolId, full_name: form.newName, phone: form.newPhone || null, whatsapp_number: form.newPhone || null, email: form.newEmail || null }).select("id").single();
      if (error || !data) { toast.error(error?.message ?? "Could not add parent"); return; }
      pid = data.id;
    }
    const { error } = await supabase.from("parent_student").insert({ school_id: schoolId, parent_id: pid, student_id: learner.id, relationship: form.relationship, is_primary: form.primary });
    if (error) { toast.error(error.message.includes("duplicate") ? "Already linked" : error.message); return; }
    toast.success("Parent linked"); setForm({ ...form, parent: "", newName: "", newPhone: "", newEmail: "" }); setPTerm("");
    void qc.invalidateQueries({ queryKey: ["learner-links"] });
  };
  const unlink = async (id: string) => {
    const { error } = await supabase.from("parent_student").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["learner-links"] });
  };
  return (
    <Card title="Link parent to learner">
      <div className="space-y-2 text-sm">
        {learner ? (
          <div className="flex items-center justify-between rounded-md bg-secondary px-2 py-1.5"><span>{learner.first_name} {learner.last_name} · {learner.admission_no}</span><Button size="sm" variant="ghost" onClick={() => setLearner(null)}>Change</Button></div>
        ) : <LearnerSearch schoolId={schoolId} onPick={setLearner} />}
        {learner && <>
          {!!links.data?.length && <ul className="text-xs text-muted-foreground">{links.data.map((l) => <li key={l.id} className="flex justify-between"><span>{l.parents?.full_name} ({l.relationship}{l.is_primary ? ", primary" : ""})</span><button className="text-destructive" onClick={() => unlink(l.id)}>Unlink</button></li>)}</ul>}
          <Input placeholder="Find parent by name, cell or email" value={pTerm} onChange={(e) => { setPTerm(e.target.value); setForm({ ...form, parent: "" }); }} />
          {pq.length >= 2 && <select className="h-9 w-full rounded-md border bg-background px-2" value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
            <option value="">{parents.data?.length ? "Choose parent…" : "No match — add new below"}</option>
            {(parents.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.phone ?? p.email ?? ""}</option>)}
          </select>}
          {!form.parent && <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="New parent name" value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} />
            <Input placeholder="Cell / WhatsApp" value={form.newPhone} onChange={(e) => setForm({ ...form, newPhone: e.target.value })} />
            <Input placeholder="Email" value={form.newEmail} onChange={(e) => setForm({ ...form, newEmail: e.target.value })} />
          </div>}
          <div className="flex items-center gap-2">
            <select className="h-9 flex-1 rounded-md border bg-background px-2" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
              {["Mother", "Father", "Guardian", "Grandparent", "Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-1"><input type="checkbox" checked={form.primary} onChange={(e) => setForm({ ...form, primary: e.target.checked })} /> Primary</label>
          </div>
          <Button className="w-full" onClick={link}>Link parent</Button>
        </>}
      </div>
    </Card>
  );
}
