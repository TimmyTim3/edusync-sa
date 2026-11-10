DROP POLICY IF EXISTS "read flags" ON public.feature_flags;
CREATE POLICY "read flags" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "read plans" ON public.plans;
CREATE POLICY "read plans" ON public.plans
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE SELECT ON public.feature_flags FROM anon;
REVOKE SELECT ON public.plans FROM anon;