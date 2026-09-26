import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
};

export function useFeatureFlags(schoolId?: string | null) {
  return useQuery({
    queryKey: ["feature-flags", schoolId ?? "global"],
    queryFn: async () => {
      const [{ data: flags }, overrides] = await Promise.all([
        supabase.from("feature_flags").select("*").order("category").order("name"),
        schoolId
          ? supabase.from("tenant_feature_overrides").select("flag_key, enabled").eq("school_id", schoolId)
          : Promise.resolve({ data: [] as { flag_key: string; enabled: boolean }[] }),
      ]);
      const map = new Map((overrides.data ?? []).map((o) => [o.flag_key, o.enabled]));
      const resolved: Record<string, boolean> = {};
      for (const f of (flags ?? []) as FeatureFlag[]) {
        resolved[f.key] = map.has(f.key) ? (map.get(f.key) as boolean) : f.enabled;
      }
      return { flags: (flags ?? []) as FeatureFlag[], resolved };
    },
    staleTime: 30_000,
  });
}

export function useFeature(key: string, schoolId?: string | null) {
  const { data, isLoading } = useFeatureFlags(schoolId);
  return { enabled: data?.resolved[key] ?? false, isLoading };
}
