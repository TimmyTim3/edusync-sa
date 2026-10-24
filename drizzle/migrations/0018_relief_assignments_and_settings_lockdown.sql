create table public.relief_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  absent_teacher_id uuid not null,
  relief_teacher_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reason text,
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (absent_teacher_id <> relief_teacher_id)
);
grant select, insert, update on public.relief_assignments to authenticated;
grant all on public.relief_assignments to service_role;
alter table public.relief_assignments enable row level security;
create policy "admin manage relief" on public.relief_assignments for all to authenticated
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "teachers read own relief" on public.relief_assignments for select to authenticated
  using (relief_teacher_id = auth.uid() or absent_teacher_id = auth.uid());
create index on public.relief_assignments (relief_teacher_id, starts_on, ends_on);

create or replace function public.is_active_relief_for(_school uuid, _teacher uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.relief_assignments r where r.school_id = _school and r.absent_teacher_id = _teacher
    and r.relief_teacher_id = auth.uid() and r.revoked_at is null and current_date between r.starts_on and r.ends_on)
$$;

create or replace function public.can_manage_register(_school uuid, _class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_school_admin(_school) or exists (
    select 1 from public.classes c where c.id = _class and c.school_id = _school and public.has_role(auth.uid(), _school, 'teacher')
      and (c.class_teacher_id = auth.uid() or public.is_active_relief_for(_school, c.class_teacher_id)))
$$;

create or replace function public.audit_relief_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, school_id, action, details)
  values (auth.uid(), new.school_id, case when tg_op = 'INSERT' then 'relief_granted' else 'relief_updated' end,
    jsonb_build_object('relief_id', new.id, 'absent', new.absent_teacher_id, 'relief', new.relief_teacher_id, 'from', new.starts_on, 'to', new.ends_on, 'revoked', new.revoked_at));
  return new;
end $$;
create trigger relief_audit after insert or update on public.relief_assignments for each row execute function public.audit_relief_change();

drop policy if exists "read platform settings" on public.platform_settings;
create policy "read platform settings" on public.platform_settings for select to authenticated using (public.is_platform_admin());