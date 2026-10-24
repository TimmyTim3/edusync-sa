create or replace function public.link_parent_to_existing_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if new.user_id is null then
    if new.email is not null then
      select id into uid from auth.users where email_confirmed_at is not null and lower(email) = lower(new.email) limit 1;
    end if;
    if uid is null and coalesce(new.phone, new.whatsapp_number) is not null then
      select id into uid from auth.users where phone_confirmed_at is not null and phone <> ''
        and (public.sa_phone_key(phone) = public.sa_phone_key(new.phone) or public.sa_phone_key(phone) = public.sa_phone_key(new.whatsapp_number)) limit 1;
    end if;
    new.user_id := uid;
  end if;
  if new.user_id is not null and not exists (select 1 from public.user_roles r where r.user_id = new.user_id and r.school_id = new.school_id and r.role = 'parent') then
    insert into public.user_roles (user_id, school_id, role) values (new.user_id, new.school_id, 'parent');
  end if;
  return new;
end $$;
drop trigger if exists parents_link_existing_user on public.parents;
create trigger parents_link_existing_user before insert or update of email, phone, whatsapp_number, user_id on public.parents
for each row execute function public.link_parent_to_existing_user();

alter table public.audit_logs alter column actor_id set default auth.uid();
drop policy if exists "insert audit logs" on public.audit_logs;
create policy "insert audit logs" on public.audit_logs for insert to authenticated
with check (actor_id = auth.uid() and (school_id is null or public.is_school_member(school_id) or public.is_platform_admin()));