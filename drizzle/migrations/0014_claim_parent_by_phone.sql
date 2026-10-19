CREATE OR REPLACE FUNCTION public.sa_phone_key(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  select case when d is null or d = '' then null
              when d like '27%' and length(d) = 11 then substr(d, 3)
              when d like '0%' and length(d) = 10 then substr(d, 2)
              else d end
  from (select regexp_replace(coalesce(p,''), '\D', '', 'g') d) x
$$;

CREATE OR REPLACE FUNCTION public.claim_parent_records()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    update public.parents set user_id = new.id
     where user_id is null and lower(email) = lower(new.email);
  end if;
  if new.phone is not null and new.phone <> '' and new.phone_confirmed_at is not null then
    update public.parents set user_id = new.id
     where user_id is null
       and (public.sa_phone_key(phone) = public.sa_phone_key(new.phone)
            or public.sa_phone_key(whatsapp_number) = public.sa_phone_key(new.phone));
  end if;
  insert into public.user_roles (user_id, school_id, role)
  select distinct new.id, p.school_id, 'parent'::app_role from public.parents p
   where p.user_id = new.id
     and not exists (select 1 from public.user_roles r where r.user_id = new.id and r.school_id = p.school_id and r.role = 'parent');
  return new;
end $function$;