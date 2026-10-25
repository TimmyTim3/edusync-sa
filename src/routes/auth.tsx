import { PasswordInput } from "@/components/PasswordInput";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneOtp } from "@/components/PhoneOtp";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s["mode"] === "signup" ? ("signup" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — EduSync Parent Hub" },
      { name: "description", content: "Sign in as a parent, teacher or principal." },
      { property: "og:title", content: "Sign in — EduSync" },
      { property: "og:description", content: "Access your school's EduSync portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/app" });
  }, [loading, session, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/app`, data: { full_name: name } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.user && !data.session) toast.success("Check your inbox to verify your email.");
  };

  const magic = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/app`, shouldCreateUser: false },
    });
    if (error) toast.error(error.message);
    else toast.success("Magic link sent — check your email.");
  };

  const reset = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/app`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-lift">
        <Link to="/" className="mb-6 flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </span>
          EduSync
        </Link>
        <Tabs defaultValue={mode === "signup" ? "signup" : "signin"}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Email</TabsTrigger>
            <TabsTrigger value="phone">Phone</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="phone">
            <PhoneOtp />
          </TabsContent>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={magic} className="text-primary hover:underline">Email me a magic link</button>
                <button type="button" onClick={reset} className="text-muted-foreground hover:underline">Forgot password?</button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-password">Password</Label>
                <PasswordInput id="su-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button className="w-full" disabled={busy}>Create account</Button>
              <p className="text-xs text-muted-foreground">
                Your school links your account to your children or classes after you verify your email.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
