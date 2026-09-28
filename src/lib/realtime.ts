import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["attendance_records", "marks", "behaviour_notes", "homework", "notices", "assessments", "notifications"] as const;

/** Subscribes to school-scoped changes and refreshes data. Returns last update time. */
export function useSchoolRealtime(schoolId: string | null) {
  const qc = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`school-${schoolId}`);
    for (const t of TABLES) {
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, ...(t === "notifications" ? {} : { filter: `school_id=eq.${schoolId}` }) },
        () => {
          setLastUpdate(new Date());
          void qc.invalidateQueries();
        },
      );
    }
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [schoolId, qc]);
  return lastUpdate;
}
