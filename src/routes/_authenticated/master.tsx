import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { clearDemoData, seedDemoSchool, type Credential } from "@/lib/master.functions";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({ meta: [{ title: "Master Control Centre — EduSync" }, { name: "robots", content: "noindex" }] }),
  component: Master,
});

function Master() {
  const { isPlatformAdmin, loading } = useAuth();
  const seed = useServerFn(seedDemoSchool);
  const clear = useServerFn(clearDemoData);
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [summary, setSummary] = useState<Record<string, string | number> | null>(null);

  if (loading) return <p className="p-8">Loading…</p>;
  if (!isPlatformAdmin)
    return <p className="p-8 text-destructive">Access restricted to authorised platform administrator only</p>;

  const run = async (size: "small" | "large") => {
    setBusy(true);
    try {
      const r = await seed({ data: { size } });
      setCreds(r.credentials);
      setSummary(r.summary);
      toast.success("Demo school created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seeding failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background p-8 text-foreground">
      <h1 className="font-display text-2xl font-semibold">Master Control Centre</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run("large")}>
          {busy ? "Seeding… (up to a minute)" : "Seed Full Demo School (3,200+ learners)"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run("small")}>Seed Smaller Demo School</Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Delete all demo schools and demo logins?")) return;
            const r = await clear();
            toast.success(`Removed ${r.removed} demo schools`);
          }}
        >
          Clear All Demo Data
        </Button>
      </div>
      {summary && (
        <pre className="mt-6 rounded-lg border bg-card p-4 text-xs">{JSON.stringify(summary, null, 2)}</pre>
      )}
      {creds.length > 0 && (
        <table className="mt-6 w-full text-sm">
          <tbody>
            {creds.map((c) => (
              <tr key={c.email} className="border-b">
                <td className="py-2">{c.role}</td>
                <td>{c.email}</td>
                <td className="font-mono">{c.password}</td>
                <td>
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(`${c.email} ${c.password}`)}>
                    Copy
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
