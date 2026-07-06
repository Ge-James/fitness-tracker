create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null,
  duration_minutes numeric,
  intensity numeric,
  notes text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight numeric,
  waist numeric,
  chest numeric,
  hips numeric,
  thigh numeric,
  arm numeric,
  body_fat numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  image_path text not null,
  captured_at timestamptz,
  angle text,
  weight numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sleep_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_score numeric,
  wake_feeling text,
  sleep_issues jsonb not null default '[]'::jsonb,
  afternoon_score numeric,
  severity text,
  impact_window text,
  symptoms jsonb not null default '[]'::jsonb,
  factors jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  duration_minutes numeric,
  intensity numeric,
  notes text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.progress_photos
add column if not exists captured_at timestamptz;

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

alter table public.workouts enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.sleep_records enable row level security;
alter table public.workout_templates enable row level security;

drop policy if exists "workouts are owned by user" on public.workouts;
create policy "workouts are owned by user"
on public.workouts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "body measurements are owned by user" on public.body_measurements;
create policy "body measurements are owned by user"
on public.body_measurements
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "progress photos are owned by user" on public.progress_photos;
create policy "progress photos are owned by user"
on public.progress_photos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sleep records are owned by user" on public.sleep_records;
create policy "sleep records are owned by user"
on public.sleep_records
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workout templates are owned by user" on public.workout_templates;
create policy "workout templates are owned by user"
on public.workout_templates
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can upload own progress photos" on storage.objects;
create policy "users can upload own progress photos"
on storage.objects
for insert
with check (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can read own progress photos" on storage.objects;
create policy "users can read own progress photos"
on storage.objects
for select
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can update own progress photos" on storage.objects;
create policy "users can update own progress photos"
on storage.objects
for update
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users can delete own progress photos" on storage.objects;
create policy "users can delete own progress photos"
on storage.objects
for delete
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
