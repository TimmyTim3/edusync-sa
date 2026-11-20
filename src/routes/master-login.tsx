import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [showPassword, setShowPassword] = useState(false);

  // Already authorised (either via normal admin session or local password gate)
  useEffect(() => {
    const localOk = typeof window !== "undefined" && localStorage.getItem(LOCAL_KEY) === "1";
    if (isPlatformAdmin || localOk) {
      void navigate({ to: "/master" });
    }
  }, [isPlatformAdmin, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: "timmytim691@gmail.com", password });
      if (signInError) throw signInError;
      localStorage.setItem(LOCAL_KEY, "1");
      await navigate({ to: "/master" });
    } catch {
      setError(DENIED);
    } finally {
      setBusy(false);
    }
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
            <div className="relative">
              <Input
                id="m-pw"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button className="w-full" type="submit" disabled={busy || !password.trim()}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
  }
