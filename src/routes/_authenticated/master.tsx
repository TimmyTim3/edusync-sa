import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Building2, Check, Copy, Download, LogOut, Palette, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clearDemoData, deleteSchool, manageSchoolRemotely, platformStats, seedDemoSchool, type Credential } from "@/lib/master.functions";
import { LearnerImport } from "@/components/LearnerImport";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({ meta: [
    { title: "Master Control Centre — EduSync" },
    { name: "description", content: "Manage EduSync schools, features, plans and platform branding." },
    { property: "og:title", content: "Master Control Centre — EduSync" },
    { property: "og:description", content: "Manage EduSync schools, features, plans and platform branding." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Master,
});

function downloadCredentials(credentials: Credential[]) {
  const lines = [["Role", "Name", "Email", "Password"], ...credentials.map(c => [c.role, c.label, c.email, c.password])];
  const csv = lines.map(row => row.map(v => `"${v.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "edusync-demo-credentials.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function Master() {
  const { isPlatformAdmin, loading, signOut, refresh: refreshRoles } = useAuth();
  const navigate = useNavigate();
  const manageRemote = useServerFn(manageSchoolRemotely);
  const removeSchool = useServerFn(deleteSchool);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const qc = useQueryClient();
  const seed = useServerFn(seedDemoSchool);
  const clear = useServerFn(clearDemoData);
  const getStats = useServerFn(platformStats);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [summary, setSummary] = useState<Record<string, string | number> | null>(null);
  const [flagName, setFlagName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [newFlagSchool, setNewFlagSchool] = useState("");

  const enabled = !loading && isPlatformAdmin;
  const stats = useQuery({ queryKey: ["master-stats"], enabled, queryFn: () => getStats() });
  const flags = useQuery({ queryKey: ["master-flags"], enabled, queryFn: async () => {
    const { data, error } = await supabase.from("feature_flags").select("*").order("category").order("name");
    if (error) throw error;
    return data;
  } });
  const schools = useQuery({ queryKey: ["master-schools"], enabled, queryFn: async () => {
    const { data, error } = await supabase.from("schools").select("id,name,status,is_demo,plan_id,slug,primary_color,secondary_color,logo_url,contact_email,trial_ends_at,plans(name)").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } });
  const plans = useQuery({ queryKey: ["master-plans"], enabled, queryFn: async () => {
    const { data, error } = await supabase.from("plans").select("*").order("price_monthly");
    if (error) throw error;
    return data;
  } });
  const branding = useQuery({ queryKey: ["master-branding"], enabled, queryFn: async () => {
    const { data, error } = await supabase.from("platform_settings").select("*").eq("id", true).single();
    if (error) throw error;
    return data;
  } });
  const jobs = useQuery({ queryKey: ["master-jobs"], enabled, queryFn: async () => {
    const { data, error } = await supabase.from("seed_jobs").select("id,status,size,summary,credentials,created_at,error").order("created_at", { ascending: false }).limit(8);
    if (error) throw error;
    return data;
  } });
  const overrides = useQuery({ queryKey: ["master-overrides", selectedSchool], enabled: enabled && !!selectedSchool, queryFn: async () => {
    const { data, error } = await supabase.from("tenant_feature_overrides").select("flag_key,enabled").eq("school_id", selectedSchool);
    if (error) throw error;
    return data;
  } });

  const refresh = () => { void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("master-") }); };
  const done = (message: string) => { toast.success(message); refresh(); };
  const fail = (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not save changes");

  const run = async (size: "small" | "large") => {
    setBusy(true);
    try {
      setProgress("Creating classes and learners…");
      const started = await seed({ data: { size, phase: "start" } });
      const schoolId = started.schoolId;
      const jobId = started.jobId;
      for (let i = 0; i < (size === "large" ? 14 : 10); i++) {
        setProgress(`Adding attendance history · ${i + 1}/${size === "large" ? 14 : 10}`);
        await seed({ data: { size, phase: "attendance", schoolId, jobId, chunk: i } });
      }
      for (let i = 0; i < (size === "large" ? 14 : 4); i++) {
        setProgress(`Adding assessment results · ${i + 1}/${size === "large" ? 14 : 4}`);
        await seed({ data: { size, phase: "marks", schoolId, jobId, chunk: i } });
      }
      setProgress("Preparing demo accounts…");
      const result = await seed({ data: { size, phase: "finish", schoolId, jobId } });
      setCredentials(result.credentials);
      setSummary(result.summary);
      done(`${result.summary["students"]} learners created`);
    } catch (error) { fail(error); }
    finally { setBusy(false); setProgress(""); }
  };

  if (loading) return <div className="dark min-h-screen bg-background p-8 text-foreground">Loading…</div>;
  if (!isPlatformAdmin) return <p className="p-8 text-destructive">Access restricted to authorised platform administrator only</p>;

  const activeCredentials = credentials.length ? credentials : (jobs.data?.find(j => j.status === "complete")?.credentials as unknown as Credential[] | undefined) ?? [];
  const activeSummary = summary ?? (jobs.data?.find(j => j.status === "complete")?.summary as Record<string, string | number> | undefined);
  const demoSchool = schools.data?.find(s => s.is_demo && s.name.includes("Ogwini"));

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div><h1 className="font-display text-lg font-semibold">Master Control Centre</h1><p className="text-xs text-muted-foreground">EduSync · Platform administration</p></div>
          <Button className="ml-auto" variant="ghost" size="icon" title="Refresh data" aria-label="Refresh data" onClick={refresh}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Schools", stats.data?.schools, Building2], ["Learners", stats.data?.students, Users], ["Attendance records", stats.data?.attendance, Activity], ["Marks recorded", stats.data?.marks, Check]].map(([label, value, Icon]) => {
            const Symbol = Icon as typeof Activity;
            return <div key={label as string} className="rounded-md border bg-card p-4"><Symbol className="mb-3 h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground">{label as string}</p><p className="font-display text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString() : "—"}</p></div>;
          })}
        </div>
        <Tabs defaultValue="demo" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted p-1">
            <TabsTrigger value="demo">Demo data</TabsTrigger><TabsTrigger value="import">Import learners</TabsTrigger><TabsTrigger value="features">Features</TabsTrigger><TabsTrigger value="schools">Schools</TabsTrigger><TabsTrigger value="plans">Plans</TabsTrigger><TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>
          <TabsContent value="import"><LearnerImport schools={(schools.data ?? []).map((s) => ({ id: s.id, name: s.name }))} /></TabsContent>
          <TabsContent value="demo" className="space-y-6">
            <section className="border-b pb-6"><h2 className="font-display text-xl font-semibold">Demo schools</h2><p className="mt-1 text-sm text-muted-foreground">Generate a complete school and use the accounts below to explore each dashboard.</p>
              <div className="mt-5 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void run("large")}>{busy ? "Generating school…" : "Seed full demo school · 3,220 learners"}</Button><Button variant="outline" disabled={busy} onClick={() => void run("small")}>Seed smaller school · 600 learners</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (!window.confirm("Delete all demo schools and their login accounts? This cannot be undone.")) return; setBusy(true); try { const result = await clear(); setCredentials([]); setSummary(null); done(`${result.removed} demo schools removed`); } catch (error) { fail(error); } finally { setBusy(false); } }}>Clear all demo data</Button></div>
              {busy && <p role="status" className="mt-3 text-sm text-primary">{progress} Keep this page open.</p>}
            </section>
            {activeSummary && <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{["students", "parents", "teachers", "classes", "attendance_records", "marks"].map(key => <div key={key} className="rounded-md border bg-card p-3"><p className="text-xs capitalize text-muted-foreground">{key.replaceAll("_", " ")}</p><p className="mt-1 text-xl font-semibold">{Number(activeSummary[key] ?? 0).toLocaleString()}</p></div>)}</div>}
            {demoSchool && <p className="text-sm text-muted-foreground">Full demo school: {demoSchool.name}. <Link to="/app" className="text-primary underline">Open your dashboard</Link></p>}
            {activeCredentials.length > 0 && <section><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-display text-lg font-semibold">Demo login credentials</h2><Button variant="outline" size="sm" onClick={() => downloadCredentials(activeCredentials)}><Download className="mr-2 h-4 w-4" /> Download CSV</Button></div><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">Role</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Password</th><th className="p-3">Copy</th></tr></thead><tbody>{activeCredentials.map(c => <tr key={c.email} className="border-t"><td className="p-3">{c.role}</td><td className="p-3">{c.label}</td><td className="p-3 font-mono text-xs">{c.email}</td><td className="p-3 font-mono text-xs">{c.password}</td><td className="p-3"><Button size="icon" variant="ghost" title={`Copy ${c.email} credentials`} aria-label={`Copy ${c.email} credentials`} onClick={() => { void navigator.clipboard.writeText(`${c.email}\n${c.password}`); toast.success("Credentials copied"); }}><Copy className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></section>}
            {jobs.data?.[0]?.status === "failed" && <p className="text-sm text-destructive">Last demo attempt failed: {jobs.data[0].error}</p>}
          </TabsContent>
          <TabsContent value="features" className="space-y-7">
            <div><h2 className="font-display text-xl font-semibold">Feature switches</h2><p className="text-sm text-muted-foreground">Global switches apply to all schools. School overrides apply only to the selected school.</p></div>
            <div className="flex flex-wrap items-end gap-2"><div><Label htmlFor="override-school">School overrides</Label><select id="override-school" className="mt-2 block h-9 min-w-56 rounded-md border bg-background px-2 text-sm" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}><option value="">Global settings</option>{schools.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>{selectedSchool && <Button variant="outline" onClick={() => setSelectedSchool("")}>Back to global</Button>}</div>
            <div className="grid gap-3 md:grid-cols-2">{flags.data?.map(flag => { const override = overrides.data?.find(o => o.flag_key === flag.key); const checked = selectedSchool && override ? override.enabled : flag.enabled; return <div key={flag.key} className="flex min-h-20 items-center justify-between gap-4 rounded-md border bg-card p-4"><div><p className="font-semibold">{flag.name} <span className="ml-1 text-xs font-normal text-muted-foreground">{flag.category}</span></p><p className="text-xs text-muted-foreground">{flag.description || flag.key}{selectedSchool && override && " · School override"}</p></div><Switch aria-label={`Enable ${flag.name}`} checked={checked} onCheckedChange={async value => { const result = selectedSchool ? await supabase.from("tenant_feature_overrides").upsert({ school_id: selectedSchool, flag_key: flag.key, enabled: value }, { onConflict: "school_id,flag_key" }) : await supabase.from("feature_flags").update({ enabled: value }).eq("id", flag.id); if (result.error) fail(result.error); else { done(`${flag.name} ${value ? "enabled" : "disabled"}`); void qc.invalidateQueries({ queryKey: ["feature-flags"] }); } }} /></div>; })}</div>
            <form className="flex flex-wrap items-end gap-2 border-t pt-5" onSubmit={async e => { e.preventDefault(); const name = flagName.trim(); const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); if (!key) return; const { error } = await supabase.from("feature_flags").insert({ key, name, category: "Custom", enabled: false }); if (error) fail(error); else { setFlagName(""); done("Feature added"); } }}><div className="min-w-56 flex-1"><Label htmlFor="new-flag">New feature</Label><Input id="new-flag" className="mt-2" value={flagName} onChange={e => setFlagName(e.target.value)} placeholder="Feature name" required /></div><Button><Plus className="mr-2 h-4 w-4" /> Add feature</Button></form>
          </TabsContent>
          <TabsContent value="schools" className="space-y-6"><div><h2 className="font-display text-xl font-semibold">Schools</h2><p className="text-sm text-muted-foreground">Activate, suspend, and assign plans to schools.</p></div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={async e => { e.preventDefault(); const name = schoolName.trim(); if (!name) return; const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`; const { error } = await supabase.from("schools").insert({ name, slug, status: "trial", plan_id: plans.data?.[0]?.id ?? null, trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString() }); if (error) fail(error); else { setSchoolName(""); done("School created"); } }}><div className="min-w-56 flex-1"><Label htmlFor="school-name">School name</Label><Input id="school-name" className="mt-2" value={schoolName} onChange={e => setSchoolName(e.target.value)} required /></div><Button><Plus className="mr-2 h-4 w-4" /> Create school</Button></form>
            <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">School</th><th className="p-3">Status</th><th className="p-3">Plan</th><th className="p-3">Action</th></tr></thead><tbody>{schools.data?.map(s => <tr key={s.id} className="border-t"><td className="p-3 font-medium">{s.name}{s.is_demo && <span className="ml-2 text-xs text-muted-foreground">Demo</span>}</td><td className="p-3 capitalize">{s.status}</td><td className="p-3"><select aria-label={`Plan for ${s.name}`} className="h-9 rounded-md border bg-background px-2" value={s.plan_id ?? ""} onChange={async e => { const { error } = await supabase.from("schools").update({ plan_id: e.target.value || null }).eq("id", s.id); if (error) fail(error); else done("School plan updated"); }}><option value="">No plan</option>{plans.data?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td><td className="p-3"><Button variant={s.status === "suspended" ? "outline" : "destructive"} size="sm" onClick={async () => { const status = s.status === "suspended" ? "active" : "suspended"; if (status === "suspended" && !window.confirm(`Suspend ${s.name}?`)) return; const { error } = await supabase.from("schools").update({ status }).eq("id", s.id); if (error) fail(error); else done(`School ${status}`); }}>{s.status === "suspended" ? "Activate" : "Suspend"}</Button><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={async () => { try { await manageRemote({ data: { schoolId: s.id } }); await refreshRoles(); toast.success(`Managing ${s.name} as principal`); void navigate({ to: "/app" }); } catch (error) { fail(error); } }}>Manage school</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setConfirmEmail(""); setToDelete({ id: s.id, name: s.name }); }}>Delete school</Button></div></td></tr>)}</tbody></table></div>
          </TabsContent>
          <TabsContent value="plans" className="space-y-5"><div><h2 className="font-display text-xl font-semibold">Plans & pricing</h2><p className="text-sm text-muted-foreground">Prices are stored in cents. Changes apply to schools on each plan.</p></div><div className="grid gap-4 lg:grid-cols-3">{plans.data?.map(p => <PlanEditor key={p.id} plan={p} flagKeys={flags.data?.map(f => f.key) ?? []} onSaved={refresh} />)}</div></TabsContent>
          <TabsContent value="branding" className="space-y-6"><div><h2 className="font-display text-xl font-semibold">Platform branding</h2><p className="text-sm text-muted-foreground">Set your public identity and announcement.</p></div>{branding.data && <BrandEditor key={String(branding.data.id)} settings={branding.data} onSaved={refresh} />}
            <div className="border-t pt-5"><h3 className="mb-3 font-semibold">School branding</h3><select className="mb-3 h-9 min-w-56 rounded-md border bg-background px-2" aria-label="School to brand" value={newFlagSchool} onChange={e => setNewFlagSchool(e.target.value)}><option value="">Choose a school</option>{schools.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{schools.data?.find(s => s.id === newFlagSchool) && <SchoolBrandEditor key={newFlagSchool} school={schools.data.find(s => s.id === newFlagSchool) as NonNullable<typeof schools.data>[number]} onSaved={refresh} />}</div>
          </TabsContent>
        </Tabs>
        {toDelete && <div role="dialog" aria-modal="true" aria-labelledby="del-title" className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4"><div className="w-full max-w-md rounded-xl border border-destructive/50 bg-card p-6 shadow-lg"><h2 id="del-title" className="font-display text-lg font-semibold text-destructive">Delete {toDelete.name}?</h2><p className="mt-2 text-sm text-muted-foreground">This permanently removes the school and all its learners, parents, staff links, attendance, marks, behaviour notes and notices. It cannot be undone.</p><Label htmlFor="del-confirm" className="mt-4 block">Type your administrator email to confirm</Label><Input id="del-confirm" className="mt-2" autoComplete="off" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} placeholder="timmytim691@gmail.com" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => setToDelete(null)}>Cancel</Button><Button variant="destructive" disabled={deleting || confirmEmail.trim().toLowerCase() !== "timmytim691@gmail.com"} onClick={async () => { setDeleting(true); try { await removeSchool({ data: { schoolId: toDelete.id, confirmEmail } }); setToDelete(null); done(`${toDelete.name} deleted`); } catch (error) { fail(error); } finally { setDeleting(false); } }}>{deleting ? "Deleting…" : "Delete permanently"}</Button></div></div></div>}
      </main>
    </div>
  );
}

function PlanEditor({ plan, flagKeys, onSaved }: { plan: { id: string; name: string; price_monthly: number; price_annual: number; student_limit: number; trial_days: number; features: Json; is_active: boolean }; flagKeys: string[]; onSaved: () => void }) {
  const [form, setForm] = useState({ price_monthly: plan.price_monthly / 100, price_annual: plan.price_annual / 100, student_limit: plan.student_limit, trial_days: plan.trial_days, is_active: plan.is_active, features: Array.isArray(plan.features) ? plan.features.filter((f): f is string => typeof f === "string") : [] as string[] });
  return <form className="space-y-4 rounded-md border bg-card p-5" onSubmit={async e => { e.preventDefault(); const { error } = await supabase.from("plans").update({ price_monthly: Math.round(form.price_monthly * 100), price_annual: Math.round(form.price_annual * 100), student_limit: form.student_limit, trial_days: form.trial_days, is_active: form.is_active, features: form.features }).eq("id", plan.id); if (error) toast.error(error.message); else { toast.success(`${plan.name} saved`); onSaved(); } }}><h3 className="font-display text-lg font-semibold">{plan.name}</h3><div className="grid grid-cols-2 gap-3">{([ ["Monthly (R)", "price_monthly"], ["Annual (R)", "price_annual"], ["Learner limit", "student_limit"], ["Trial days", "trial_days"] ] as const).map(([label, field]) => <div key={field}><Label htmlFor={`${plan.id}-${field}`}>{label}</Label><Input id={`${plan.id}-${field}`} className="mt-1" type="number" min="0" step={field.includes("price") ? "0.01" : "1"} value={form[field]} onChange={e => setForm({ ...form, [field]: Number(e.target.value) })} /></div>)}</div><div className="space-y-2"><p className="text-xs text-muted-foreground">Included features</p><div className="grid grid-cols-2 gap-2">{flagKeys.map(key => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.features.includes(key)} onChange={e => setForm({ ...form, features: e.target.checked ? [...form.features, key] : form.features.filter(f => f !== key) })} />{key.replaceAll("_", " ")}</label>)}</div></div><label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={is_active => setForm({ ...form, is_active })} />Active</label><Button className="w-full" type="submit">Save plan</Button></form>;
}

function BrandEditor({ settings, onSaved }: { settings: { platform_name: string; logo_url: string | null; favicon_url: string | null; primary_color: string; secondary_color: string; email_sender_name: string; show_powered_by: boolean; announcement: string | null; announcement_active: boolean }; onSaved: () => void }) {
  const [form, setForm] = useState(settings);
  return <form className="grid max-w-3xl gap-4 rounded-md border bg-card p-5 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); const { error } = await supabase.from("platform_settings").update(form).eq("id", true); if (error) toast.error(error.message); else { toast.success("Branding saved"); onSaved(); } }}><div className="sm:col-span-2"><Label htmlFor="brand-name">Platform name</Label><Input id="brand-name" className="mt-1" value={form.platform_name} onChange={e => setForm({ ...form, platform_name: e.target.value })} /></div>{([ ["Logo URL", "logo_url"], ["Favicon URL", "favicon_url"], ["Email sender", "email_sender_name"], ["Announcement", "announcement"] ] as const).map(([label, key]) => <div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} className="mt-1" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}{([ ["Primary", "primary_color"], ["Secondary", "secondary_color"] ] as const).map(([label, key]) => <div key={key}><Label htmlFor={key}>{label} colour</Label><Input id={key} type="color" className="mt-1 h-10 p-1" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}<label className="flex items-center gap-2 text-sm"><Switch checked={form.show_powered_by} onCheckedChange={show_powered_by => setForm({ ...form, show_powered_by })} />Show Powered by EduSync</label><label className="flex items-center gap-2 text-sm"><Switch checked={form.announcement_active} onCheckedChange={announcement_active => setForm({ ...form, announcement_active })} />Show announcement</label><Button type="submit" className="sm:col-span-2"><Palette className="mr-2 h-4 w-4" /> Save branding</Button></form>;
}

function SchoolBrandEditor({ school, onSaved }: { school: { id: string; logo_url: string | null; primary_color: string; secondary_color: string; contact_email: string | null }; onSaved: () => void }) {
  const [form, setForm] = useState({ logo_url: school.logo_url ?? "", primary_color: school.primary_color, secondary_color: school.secondary_color, contact_email: school.contact_email ?? "" });
  return <form className="grid max-w-3xl gap-3 rounded-md border bg-card p-4 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); const { error } = await supabase.from("schools").update(form).eq("id", school.id); if (error) toast.error(error.message); else { toast.success("School branding saved"); onSaved(); } }}><div className="sm:col-span-2"><Label htmlFor="school-logo">Logo URL</Label><Input id="school-logo" className="mt-1" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} /></div>{(["primary_color", "secondary_color"] as const).map(key => <div key={key}><Label htmlFor={key}>{key.replace("_", " ")}</Label><Input id={key} className="mt-1 h-10 p-1" type="color" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}<div className="sm:col-span-2"><Label htmlFor="school-contact">Contact email</Label><Input id="school-contact" className="mt-1" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div><Button type="submit" className="sm:col-span-2">Save school branding</Button></form>;
}
