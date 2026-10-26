ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS grades text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_school_name_uniq ON public.subjects (school_id, lower(name));