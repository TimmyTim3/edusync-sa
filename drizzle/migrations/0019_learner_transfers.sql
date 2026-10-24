create table public.learner_transfers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  destination_school text,
  reason text not null default 'Relocation',
  leave_date date not null default current_date,
  clearance jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.learner_transfers to authenticated;
grant all on public.learner_transfers to service_role;
alter table public.learner_transfers enable row level security;
create policy "admin manage transfers" on public.learner_transfers for all to authenticated
  using (public.is_school_admin(school_id)) with check (public.is_school_admin(school_id));
create policy "staff read transfers" on public.learner_transfers for select to authenticated
  using (public.is_school_staff(school_id));

create or replace function public.audit_transfer_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, school_id, action, details)
  values (auth.uid(), new.school_id, case when tg_op = 'INSERT' then 'transfer_started' else 'transfer_updated' end,
    jsonb_build_object('transfer_id', new.id, 'student_id', new.student_id, 'status', new.status, 'clearance', new.clearance));
  return new;
end $$;
create trigger transfer_audit after insert or update on public.learner_transfers for each row execute function public.audit_transfer_change();