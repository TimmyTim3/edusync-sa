import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MASTER_PASSWORD = "Timmy_Tim3";
const DENIED = "Incorrect password";
const LOCAL_KEY = "edusync-master-ok";

export const Route = createFileRoute("/master-login")({
  head: () => ({
    meta: [
      { title: "Master Control Centre — EduSync" },
      { name: "description", content: "Restricted platform administration login." },
      { property: "og:title", content: "Master Control Centre" },
      { property: "og:description", content: "Restricted platform administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MasterLogin,
});

function MasterLogin() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already authorised (either via normal admin session or local password gate)
  useEffect(() => {
    const localOk = typeof window !== "undefined" && localStorage.getItem(LOCAL_KEY) === "1";
    if (isPlatformAdmin || localOk) {
      void navigate({ to: "/master" });
    }
  }, [isPlatformAdmin, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (password === MASTER_PASSWORD) {
      localStorage.setItem(LOCAL_KEY, "1");
      void navigate({ to: "/master" });
    } else {
      setError(DENIED);
    }

    setBusy(false);
  };

  return (
    <div className="dark grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-lg font-semibold">Master Control Centre</h1>
            <p className="text-xs text-muted-foreground">Authorised platform administrator only</p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-pw">Password</Label>
            <Input
              id="m-pw"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          <Button className="w-full" disabled={busy}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
  }
