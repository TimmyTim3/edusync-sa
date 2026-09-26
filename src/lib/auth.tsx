import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const PLATFORM_ADMIN_EMAIL = "timmytim691@gmail.com";

export type AppRole = "school_admin" | "teacher" | "parent" | "student";

export type RoleRow = { role: AppRole; school_id: string | null };

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: RoleRow[];
  schoolId: string | null;
  primaryRole: AppRole | null;
  isPlatformAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ROLE_PRIORITY: AppRole[] = ["school_admin", "teacher", "parent", "student"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role, school_id").eq("user_id", uid);
    setRoles((data as RoleRow[]) ?? []);
  };

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setTimeout(() => void loadRoles(next?.user?.id), 0);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadRoles(data.session?.user?.id);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const email = session?.user?.email?.toLowerCase() ?? null;
  const primaryRole = ROLE_PRIORITY.find((r) => roles.some((x) => x.role === r)) ?? null;
  const schoolId = roles.find((r) => r.role === primaryRole)?.school_id ?? null;

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    roles,
    schoolId,
    primaryRole,
    isPlatformAdmin: email === PLATFORM_ADMIN_EMAIL,
    refresh: async () => loadRoles(session?.user?.id),
    signOut: async () => {
      await supabase.auth.signOut();
      setRoles([]);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
