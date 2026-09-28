import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ParentDashboard } from "@/components/dash/ParentDashboard";
import { TeacherDashboard } from "@/components/dash/TeacherDashboard";
import { PrincipalDashboard } from "@/components/dash/PrincipalDashboard";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — EduSync" }, { name: "robots", content: "noindex" }] }),
  component: AppHome,
});

function AppHome() {
  const { loading, primaryRole, isPlatformAdmin, user, signOut } = useAuth();
  if (loading) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;
  if (primaryRole === "school_admin") return <PrincipalDashboard />;
  if (primaryRole === "teacher") return <TeacherDashboard />;
  if (primaryRole === "parent") return <ParentDashboard />;
  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="font-display text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {user?.email}. Your account isn't linked to a school yet.</p>
      <div className="mt-6 flex gap-2">
        {isPlatformAdmin && <Button asChild><Link to="/master">Master Control Centre</Link></Button>}
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </div>
  );
}
