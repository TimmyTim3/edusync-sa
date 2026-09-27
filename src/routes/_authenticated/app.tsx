import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — EduSync" }] }),
  component: AppHome,
});

function AppHome() {
  const { user, primaryRole, isPlatformAdmin, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="font-display text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as {user?.email} · role: {primaryRole ?? "not yet linked to a school"}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">Role dashboards are still being built.</p>
      <div className="mt-6 flex gap-2">
        {isPlatformAdmin && (
          <Button asChild>
            <Link to="/master">Master Control Centre</Link>
          </Button>
        )}
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
