create or replace function public.seed_demo_school(p_size text default 'large', p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_term uuid;
  v_sections int;
  v_per_class int;
  v_days int;
  v_plan uuid;
  v_students int;
  v_parents int;
  v_att int;
  v_marks int;
  v_teachers int;
  v_name text;
  v_first text[] := array['Thabo','Lerato','Sipho','Nandi','Ayanda','Kabelo','Zanele','Musa','Naledi','Bongani','Precious','Tshepo','Amahle','Sibusiso','Palesa','Katlego','Nomsa','Lwazi','Refilwe','Mpho','Aisha','Daniel','Emma','Junaid','Kyle','Megan','Sarah','Liam','Chloe','Ethan'];
  v_last text[] := array['Dlamini','Nkosi','Mokoena','Zulu','Khumalo','Ndlovu','Mahlangu','Botha','Naidoo','Pillay','Van Wyk','Molefe','Sithole','Maseko','Jacobs','Petersen','Mthembu','Ngcobo','Radebe','Modise'];
  v_subjects text[] := array['Mathematics','English','Physical Sciences','Life Sciences','Geography','History','Accounting','Life Orientation'];
  v_cats text[] := array['Excellent participation','Homework excellence','Leadership','Disruption in class','Incomplete work','Late arrival','Helping a peer','Uniform violation'];
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform administrator may seed demo data';
  end if;

  if p_size = 'small' then v_sections := 4; v_per_class := 30; v_days := 15;
  else v_sections := 14; v_per_class := 46; v_days := 20; end if;

  select id into v_plan from public.plans where slug = 'enterprise';
  v_name := coalesce(p_name, case when p_size='small' then 'Riverside Demo Primary' else 'Ogwini Demo Comprehensive High' end);

  insert into public.schools (name, slug, status, plan_id, is_demo, contact_email, phone, address, trial_ends_at)
  values (v_name, 'demo-' || substr(replace(gen_random_uuid()::text,'-',''),1,8), 'active', v_plan, true,
          'principal@demo-edusync.school', '+27 31 000 0000', 'KwaZulu-Natal, South Africa', now() + interval '30 days')
  returning id into v_school;

  insert into public.academic_years (school_id, name, start_date, end_date, is_current)
  values (v_school, to_char(now(),'YYYY'), date_trunc('year', now())::date, (date_trunc('year', now()) + interval '1 year - 1 day')::date, true)
  returning id into v_year;

  insert into public.terms (school_id, academic_year_id, name, start_date, end_date, is_current)
  values (v_school, v_year, 'Term 1', date_trunc('year', now())::date, (date_trunc('year', now()) + interval '3 months')::date, false),
         (v_school, v_year, 'Term 2', (date_trunc('year', now()) + interval '3 months')::date, (date_trunc('year', now()) + interval '6 months')::date, false),
         (v_school, v_year, 'Term 3', (now() - interval '2 months')::date, (now() + interval '2 months')::date, true);
  select id into v_term from public.terms where school_id = v_school and is_current;

  insert into public.subjects (school_id, name, code)
  select v_school, s, upper(left(s,4)) from unnest(v_subjects) s;

  insert into public.classes (school_id, grade, section, name)
  select v_school, g::text, chr(64 + sec), 'Grade ' || g || chr(64 + sec)
  from generate_series(8,12) g, generate_series(1, v_sections) sec;

  -- students
  insert into public.students (school_id, class_id, admission_no, first_name, last_name, date_of_birth, gender, photo_url)
  select v_school, c.id,
    'ADM' || to_char(now(),'YY') || lpad((row_number() over ())::text, 5, '0'),
    v_first[1 + floor(random()*array_length(v_first,1))::int],
    v_last[1 + floor(random()*array_length(v_last,1))::int],
    (now() - ((13 + (c.grade::int - 8)) * interval '1 year') - (floor(random()*365) * interval '1 day'))::date,
    case when random() < 0.5 then 'Female' else 'Male' end,
    'https://api.dicebear.com/7.x/initials/svg?seed=' || floor(random()*100000)::text
  from public.classes c, generate_series(1, v_per_class) n
  where c.school_id = v_school;

  select count(*) into v_students from public.students where school_id = v_school;

  -- parents: fewer parents than students so many have 2-4 children
  v_parents := greatest(1, (v_students / 1.9)::int);
  insert into public.parents (school_id, full_name, email, phone)
  select v_school,
    v_first[1 + floor(random()*array_length(v_first,1))::int] || ' ' || v_last[1 + floor(random()*array_length(v_last,1))::int],
    'parent' || n || '@demo-edusync.school',
    '+2782' || lpad(floor(random()*9999999)::text, 7, '0')
  from generate_series(1, v_parents) n;

  insert into public.parent_student (school_id, parent_id, student_id, relationship, is_primary)
  select v_school, p.id, s.id,
    case when random() < 0.5 then 'Mother' when random() < 0.85 then 'Father' else 'Guardian' end, true
  from (select id, row_number() over (order by random()) rn from public.students where school_id = v_school) s
  join (select id, row_number() over (order by created_at) rn from public.parents where school_id = v_school) p
    on p.rn = 1 + ((s.rn - 1) % v_parents);

  -- teacher profiles (directory) + roles
  v_teachers := greatest(10, (v_students / 28)::int);
  with t as (
    insert into public.profiles (id, school_id, full_name, email)
    select gen_random_uuid(), v_school,
      v_first[1 + floor(random()*array_length(v_first,1))::int] || ' ' || v_last[1 + floor(random()*array_length(v_last,1))::int],
      'teacher' || n || '.' || substr(replace(gen_random_uuid()::text,'-',''),1,4) || '@demo-edusync.school'
    from generate_series(1, v_teachers) n
    returning id
  )
  insert into public.user_roles (user_id, school_id, role) select id, v_school, 'teacher' from t;

  -- assign teachers to class/subject
  insert into public.class_subject_teachers (school_id, class_id, subject_id, teacher_id)
  select v_school, c.id, sub.id,
    (select ur.user_id from public.user_roles ur where ur.school_id = v_school and ur.role='teacher' order by md5(ur.user_id::text || c.id::text || sub.id::text) limit 1)
  from public.classes c join public.subjects sub on sub.school_id = v_school
  where c.school_id = v_school
  on conflict do nothing;

  -- class teacher
  update public.classes c set class_teacher_id = (
    select cst.teacher_id from public.class_subject_teachers cst where cst.class_id = c.id limit 1)
  where c.school_id = v_school;

  -- attendance for recent weekdays
  insert into public.attendance_records (school_id, student_id, class_id, date, status)
  select v_school, s.id, s.class_id, d::date,
    case when random() < 0.9 then 'present'::attendance_status
         when random() < 0.5 then 'absent'::attendance_status
         when random() < 0.6 then 'late'::attendance_status
         else 'excused'::attendance_status end
  from public.students s,
       lateral (select generate_series(current_date - (v_days * 2), current_date, interval '1 day') d) g
  where s.school_id = v_school and extract(dow from g.d) between 1 and 5
  on conflict (student_id, date) do nothing;

  -- assessments + marks
  insert into public.assessments (school_id, class_id, subject_id, term_id, title, type, max_marks, date, published)
  select v_school, c.id, sub.id, v_term,
    (array['Class Test 1','Mid-term Exam','Project'])[n], (array['test','exam','project'])[n], 100,
    (current_date - (n * 18))::date, true
  from public.classes c join public.subjects sub on sub.school_id = v_school, generate_series(1,3) n
  where c.school_id = v_school;

  insert into public.marks (school_id, assessment_id, student_id, score)
  select v_school, a.id, s.id, round((35 + random()*63)::numeric, 1)
  from public.assessments a join public.students s on s.class_id = a.class_id
  where a.school_id = v_school
  on conflict do nothing;

  -- behaviour notes
  insert into public.behaviour_notes (school_id, student_id, category, is_positive, severity, note, points, created_at)
  select v_school, s.id, cat, pos, case when pos then 'low' else (array['low','medium','high'])[1+floor(random()*3)::int] end,
    case when pos then 'Recognised for ' || lower(cat) || ' during class.' else 'Logged incident: ' || lower(cat) || '. Teacher followed up.' end,
    case when pos then 5 else -5 end,
    now() - (floor(random()*30) * interval '1 day')
  from (select id, random() r from public.students where school_id = v_school) s,
       lateral (select v_cats[1+floor(random()*8)::int] cat, random() < 0.6 pos) x
  where s.r < 0.25;

  -- homework
  insert into public.homework (school_id, class_id, subject_id, title, description, due_date)
  select v_school, c.id, sub.id,
    sub.name || ' — ' || (array['Exercise Set','Revision Worksheet','Research Task','Past Paper','Reading'])[1+floor(random()*5)::int],
    'Complete the assigned work and submit to your subject teacher.',
    (current_date + (floor(random()*14) - 6)::int)
  from public.classes c join public.subjects sub on sub.school_id = v_school
  where c.school_id = v_school and random() < 0.45;

  -- notices
  insert into public.notices (school_id, scope, title, body, priority, published_at)
  values
   (v_school,'school','Term 3 Parents Evening','Parents evening takes place on Thursday from 16:00 to 19:00 in the school hall. Please book a slot with your child''s class teacher.','urgent', now() - interval '1 day'),
   (v_school,'school','Winter Uniform Reminder','Full winter uniform is compulsory from Monday. Learners without correct uniform will be recorded.','normal', now() - interval '3 days'),
   (v_school,'school','Sports Day','Annual athletics meeting next Friday. Learners must arrive by 07:30 in house colours.','normal', now() - interval '6 days'),
   (v_school,'school','Exam Timetable Published','The Term 3 examination timetable is now available on the parent portal.','urgent', now() - interval '9 days');

  select count(*) into v_att from public.attendance_records where school_id = v_school;
  select count(*) into v_marks from public.marks where school_id = v_school;

  return jsonb_build_object(
    'school_id', v_school, 'school_name', v_name,
    'students', v_students, 'parents', v_parents, 'teachers', v_teachers,
    'classes', (select count(*) from public.classes where school_id = v_school),
    'attendance_records', v_att, 'marks', v_marks,
    'assessments', (select count(*) from public.assessments where school_id = v_school),
    'behaviour_notes', (select count(*) from public.behaviour_notes where school_id = v_school),
    'homework', (select count(*) from public.homework where school_id = v_school),
    'notices', (select count(*) from public.notices where school_id = v_school)
  );
end; $$;

revoke all on function public.seed_demo_school(text, text) from public;
grant execute on function public.seed_demo_school(text, text) to authenticated, service_role;

create or replace function public.clear_demo_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorised'; end if;
  with d as (delete from public.schools where is_demo returning 1) select count(*) into v from d;
  return jsonb_build_object('schools_removed', v);
end; $$;
revoke all on function public.clear_demo_data() from public;
grant execute on function public.clear_demo_data() to authenticated, service_role;