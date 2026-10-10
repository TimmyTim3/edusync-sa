CREATE OR REPLACE FUNCTION public.prevent_behaviour_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('edusync.allow_demo_purge', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Behaviour notes are permanent and cannot be deleted';
END $$;

CREATE OR REPLACE FUNCTION public.clear_demo_data() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorised'; end if;
  perform set_config('edusync.allow_demo_purge', 'on', true);
  delete from public.seed_jobs where school_id in (select id from public.schools where is_demo);
  with d as (delete from public.schools where is_demo returning 1) select count(*) into v from d;
  perform set_config('edusync.allow_demo_purge', 'off', true);
  return jsonb_build_object('schools_removed', v);
end; $$;