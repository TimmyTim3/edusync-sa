import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Users, LogOut, Radio } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Shell({ title, subtitle, lastUpdate, children }: { title: string; subtitle?: string; lastUpdate: Date | null; children: ReactNode }) {
  const { user, signOut, isPlatformAdmin } = useAuth();
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Users className="h-4 w-4" /></span>
            EduSync
          </Link>
          <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Radio className="h-3 w-3 text-primary" />
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : "Live"}
          </span>
          {isPlatformAdmin && <Button asChild size="sm" variant="outline"><Link to="/master">Control Centre</Link></Button>}
          <span className="hidden text-sm text-muted-foreground md:inline">{user?.email}</span>
          <Button size="icon" variant="ghost" onClick={() => void signOut()} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border bg-card p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

export const today = () => new Date().toISOString().slice(0, 10);
