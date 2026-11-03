import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "edusync-master-ok";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Allow the simple master password gate
    if (typeof window !== "undefined" && localStorage.getItem(LOCAL_KEY) === "1") {
      return { user: null };
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: undefined } });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
