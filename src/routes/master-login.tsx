import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PLATFORM_ADMIN_EMAIL, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DENIED = "Access restricted to authorised platform administrator only";

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
  const { session, loading, isPlatformAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (isPlatformAdmin) void navigate({ to: "/master" });
    else {
      setError(DENIED);
      void supabase.auth.signOut();
    }
  }, [loading, session, isPlatformAdmin, navigate]);

  const submit = async (e: React.FormEvent, create = false) => {
    e.preventDefault();
    setError(null);
    if (email.trim().toLowerCase() !== PLATFORM_ADMIN_EMAIL) return setError(DENIED);
    setBusy(true);
    const res = create
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/master-login` },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (res.error) setError(res.error.message);
    else if (create && !res.data.session) setError("Verification email sent. Confirm it, then sign in.");
  };

  const google = async () => {
    setError(null);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/master-login`,
    });
    if (r.error) setError(r.error.message);
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
          <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={(e) => submit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-email">Email</Label>
            <Input id="m-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-pw">Password</Label>
            <Input id="m-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy}>Sign in</Button>
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Login with Google
          </Button>
          <button
            type="button"
            onClick={(e) => submit(e as unknown as React.FormEvent, true)}
            className="w-full text-center text-xs text-muted-foreground hover:underline"
          >
            First time? Create the administrator password
          </button>
        </form>
      </div>
    </div>
  );
}
