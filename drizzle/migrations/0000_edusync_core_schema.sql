-- ========== ENUMS ==========
create type public.app_role as enum ('school_admin','teacher','parent','student');
create type public.attendance_status as enum ('present','absent','late','excused','half_day');
create type public.notice_scope as enum ('school','grade','class');
create type public.school_status as enum ('active','suspended','trial');

-- ========== PLATFORM ==========
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
insert into public.platform_admins (email) values ('timmytim691@gmail.com');

create table public.platform_settings (
  id boolean primary key default true,
  platform_name text not null default 'EduSync Parent Hub',
  logo_url text,
  favicon_url text,
  primary_color text not null default '#2563eb',
  secondary_color text not null default '#0d9488',
  show_powered_by boolean not null default true,
  email_sender_name text not null default 'EduSync',
  announcement text,
  announcement_active boolean not null default false,
  constraint platform_settings_singleton check (id)
);
insert into public.platform_settings (id) values (true);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  price_monthly numeric not null default 0,
  price_annual numeric not null default 0,
  student_limit int not null default 500,
  trial_days int not null default 14,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.plans (name, slug, price_monthly, price_annual, student_limit, features) values
  ('Starter','starter',899,8990,500,'["attendance","notices","homework"]'),
  ('Growth','growth',2499,24990,1500,'["attendance","notices","homework","marks","behaviour","analytics"]'),
  ('Enterprise','enterprise',6999,69990,5000,'["attendance","notices","homework","marks","behaviour","analytics","whatsapp","student_portal","white_label","report_cards"]');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.school_status not null default 'trial',
  plan_id uuid references public.plans(id),
  logo_url text,
  primary_color text not null default '#2563eb',
  secondary_color text not null default '#0d9488',
  contact_email text,
  phone text,
  address text,
  is_demo boolean not null default false,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category text not null default 'General',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.feature_flags (key,name,description,category,enabled) values
  ('attendance','Attendance','Daily and period attendance marking','Academic',true),
  ('marks','Marks & Grades','Assessments, marks and report cards','Academic',true),
  ('behaviour','Behaviour Notes','Positive and negative behaviour tracking','Academic',true),
  ('homework','Homework','Assignments and submission tracking','Academic',true),
  ('notices','Notices','School, grade and class announcements','Communication',true),
  ('whatsapp','WhatsApp Integration','WhatsApp linking and notification pathway','Communication',false),
  ('parent_messaging','Parent Messaging','Moderated parent to teacher messaging','Communication',false),
  ('analytics','Advanced Analytics','Charts, trends and school health metrics','Insights',true),
  ('student_portal','Student Portal','Students can log in and view their own data','Access',false),
  ('fees','Fee Module','Placeholder for fee management','Future',false),
  ('transport','Transport Tracking','Placeholder for transport tracking','Future',false),
  ('report_cards','Report Card Generator','Printable and PDF report cards','Academic',true),
  ('bulk_import','Bulk Import','CSV import of students, parents and staff','Admin',true),
  ('dark_mode','Dark Mode','Allow users to switch to dark theme','UI',true),
  ('pwa_prompt','PWA Install Prompt','Prompt parents to install the app','UI',true);

create table public.tenant_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  unique (school_id, flag_key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  actor_id uuid,
  school_id uuid references public.schools(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.seed_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  status text not null default 'running',
  size text not null default 'large',
  summary jsonb not null default '{}'::jsonb,
  credentials jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ========== USERS ==========
create table public.profiles (
  id uuid primary key,
  school_id uuid references public.schools(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  whatsapp_number text,
  whatsapp_opt_in boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  school_id uuid references public.schools(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, school_id, role)
);

-- ========== ACADEMIC STRUCTURE ==========
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade text not null,
  section text not null,
  name text not null,
  class_teacher_id uuid,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text
);

create table public.class_subject_teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null,
  unique (class_id, subject_id, teacher_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  user_id uuid,
  admission_no text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  gender text,
  photo_url text,
  medical_notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (school_id, admission_no)
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid,
  full_name text not null,
  email text,
  phone text,
  whatsapp_number text,
  created_at timestamptz not null default now()
);

create table public.parent_student (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text not null default 'Guardian',
  is_primary boolean not null default false,
  unique (parent_id, student_id)
);

-- ========== MODULES ==========
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  date date not null,
  status public.attendance_status not null default 'present',
  note text,
  marked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term_id uuid references public.terms(id) on delete set null,
  title text not null,
  type text not null default 'test',
  max_marks numeric not null default 100,
  weight numeric not null default 1,
  date date not null default current_date,
  published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric,
  comment text,
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table public.behaviour_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  is_positive boolean not null default true,
  severity text not null default 'low',
  note text not null,
  private_note text,
  points int not null default 0,
  parent_visible boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  description text,
  due_date date not null,
  attachment_url text,
  requires_submission boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.homework_completions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  homework_id uuid not null references public.homework(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed_at timestamptz not null default now(),
  marked_by uuid,
  unique (homework_id, student_id)
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scope public.notice_scope not null default 'school',
  class_id uuid references public.classes(id) on delete cascade,
  grade text,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  attachment_url text,
  published_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.notice_reads (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  unique (notice_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  user_id uuid not null,
  student_id uuid references public.students(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  push_enabled boolean not null default false,
  quiet_hours_start int,
  quiet_hours_end int,
  digest boolean not null default false,
  event_prefs jsonb not null default '{}'::jsonb
);

-- ========== INDEXES ==========
create index on public.students (school_id, class_id);
create index on public.students (school_id, last_name);
create index on public.parents (school_id);
create index on public.parents (user_id);
create index on public.parent_student (student_id);
create index on public.parent_student (parent_id);
create index on public.attendance_records (student_id, date desc);
create index on public.attendance_records (school_id, date desc);
create index on public.marks (student_id);
create index on public.marks (assessment_id);
create index on public.assessments (school_id, class_id);
create index on public.behaviour_notes (student_id, created_at desc);
create index on public.homework (school_id, class_id, due_date desc);
create index on public.notices (school_id, published_at desc);
create index on public.notifications (user_id, created_at desc);
create index on public.classes (school_id);
create index on public.user_roles (user_id);

-- ========== SECURITY HELPERS ==========
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins pa
    where lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  )
$$;

create or replace function public.has_role(_user_id uuid, _school uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.school_id = _school and ur.role = _role)
$$;

create or replace function public.is_school_staff(_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.school_id = _school
      and ur.role in ('school_admin','teacher'))
$$;

create or replace function public.is_school_admin(_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.school_id = _school and ur.role = 'school_admin')
$$;

create or replace function public.is_school_member(_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.school_id = _school)
$$;

create or replace function public.my_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select ps.student_id from public.parent_student ps
    join public.parents p on p.id = ps.parent_id
   where p.user_id = auth.uid()
  union
  select s.id from public.students s where s.user_id = auth.uid()
$$;

create or replace function public.can_see_student(_student uuid, _school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or public.is_school_staff(_school)
      or _student in (select public.my_student_ids())
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
