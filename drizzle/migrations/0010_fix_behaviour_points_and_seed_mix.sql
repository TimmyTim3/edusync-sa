CREATE OR REPLACE FUNCTION public.normalize_behaviour_incident() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF lower(trim(NEW.category)) = ANY (ARRAY['excellent participation','homework excellence','leadership','helping a peer','merit']) THEN NEW.is_positive := true;
  ELSIF lower(trim(NEW.category)) = ANY (ARRAY['disruption in class','incomplete work','late arrival','uniform violation','concern']) THEN NEW.is_positive := false;
  END IF;
  -- keep the real number of points; only fix the sign (0 defaults to 5)
  NEW.points := CASE WHEN NEW.is_positive THEN coalesce(nullif(abs(NEW.points),0),5) ELSE -coalesce(nullif(abs(NEW.points),0),5) END;
  IF NEW.note LIKE 'Recognised for % during class.' OR NEW.note LIKE 'Logged incident: %. Teacher followed up.' THEN
    NEW.note := CASE WHEN NEW.is_positive THEN 'Recognised for ' || lower(NEW.category) || ' during class.' ELSE 'Logged incident: ' || lower(NEW.category) || '. Teacher followed up.' END;
  END IF;
  RETURN NEW;
END; $$;

-- Demo seed: pick category/polarity per learner (the lateral was evaluated once, giving one category for everyone)
DO $do$
DECLARE f text; src text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.seed_demo_school_base(text,text)','public.seed_demo_school(text,text)'] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      src := pg_get_functiondef(to_regprocedure(f));
      src := replace(src,
        'lateral (select v_cats[1+floor(random()*8)::int] cat, random() < 0.6 pos) x',
        'lateral (select case when s.r < 0.15 then (array[''Excellent participation'',''Homework excellence'',''Leadership'',''Helping a peer''])[1+floor(random()*4)::int] else (array[''Disruption in class'',''Incomplete work'',''Late arrival'',''Uniform violation''])[1+floor(random()*4)::int] end cat, s.r < 0.15 pos) x');
      src := replace(src, 'case when pos then 5 else -5 end', 'case when pos then 5*(1+floor(random()*3)::int) else -5*(1+floor(random()*4)::int) end');
      EXECUTE src;
    END IF;
  END LOOP;
END $do$;