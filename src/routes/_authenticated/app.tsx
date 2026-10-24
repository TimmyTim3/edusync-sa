import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { manageSchoolRemotely } from "@/lib/master.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ParentDashboard } from "@/components/dash/ParentDashboard";
import { TeacherDashboard } from "@/components/dash/TeacherDashboard";
import { ClaimChild } from "@/components/dash/BundleB";
import { PrincipalDashboard } from "@/components/dash/PrincipalDashboard";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard — EduSync" }, { name: "robots", content: "noindex" }] }),
  component: AppHome,
});

function AppHome() {
  const { loading, primaryRole, isPlatformAdmin, user, signOut } = useAuth();
  if (loading) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;
  return <><RoleChip /><Dash /></>;
}

const roleLabel: Record<string, string> = { school_admin: "Principal", teacher: "Teacher", parent: "Parent", student: "Learner" };
function RoleChip() {
  const { availableRoles, primaryRole, setViewAs } = useAuth();
  if (availableRoles.length < 2) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-b bg-muted px-4 py-1.5 text-sm">
      <span className="text-muted-foreground">Viewing as:</span>
      <select className="rounded-md border bg-background px-2 py-1" value={primaryRole ?? ""} onChange={(e) => setViewAs(e.target.value as never)}>
        {availableRoles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
      </select>
    </div>
  );
}

function Dash() {
  const { loading, primaryRole, isPlatformAdmin, user, signOut, refresh } = useAuth();
  if (loading) return <div className="p-8"><Skeleton className="h-48 w-full" /></div>;
  if (primaryRole === "school_admin") return isPlatformAdmin ? <><RemoteBanner /><PrincipalDashboard /></> : <PrincipalDashboard />;
  if (primaryRole === "teacher") return <TeacherDashboard />;
  if (primaryRole === "parent") return <ParentDashboard />;
  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="font-display text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {user?.email}. Are you a parent or guardian? Link your child below using the details on their school record.</p>
      {user && <div className="mt-4"><ClaimChild userId={user.id} startOpen onLinked={refresh} /></div>}
      <div className="mt-6 flex gap-2">
        {isPlatformAdmin && <Button asChild><Link to="/master">Master Control Centre</Link></Button>}
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </div>
  );
}

function RemoteBanner() {
  const { refresh } = useAuth();
  const stop = useServerFn(manageSchoolRemotely);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-accent px-4 py-2 text-sm text-accent-foreground">
      <span>You are managing this school remotely as the platform administrator.</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" asChild><Link to="/master">Control Centre</Link></Button>
        <Button size="sm" onClick={async () => { await stop({ data: { schoolId: null } }); await refresh(); }}>Exit school</Button>
      </div>
    </div>
  );
}
