create or replace function public.claim_parent_records() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  update public.parents set user_id = new.id
   where user_id is null and lower(email) = lower(new.email);
  insert into public.user_roles (user_id, school_id, role)
  select distinct new.id, p.school_id, 'parent'::app_role from public.parents p
   where p.user_id = new.id
     and not exists (select 1 from public.user_roles r where r.user_id = new.id and r.school_id = p.school_id and r.role = 'parent');
  return new;
end $$;
drop trigger if exists on_auth_user_claim_parent on auth.users;
create trigger on_auth_user_claim_parent after insert or update of email_confirmed_at, email on auth.users
for each row execute function public.claim_parent_records();
-- link already-existing accounts
update public.parents p set user_id = u.id from auth.users u
 where p.user_id is null and u.email_confirmed_at is not null and lower(u.email) = lower(p.email);
insert into public.user_roles (user_id, school_id, role)
select distinct p.user_id, p.school_id, 'parent'::app_role from public.parents p
 where p.user_id is not null and not exists (select 1 from public.user_roles r where r.user_id = p.user_id and r.school_id = p.school_id and r.role = 'parent');