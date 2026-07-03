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
  angle text,
  weight numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

alter table public.workouts enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;

create policy "workouts are owned by user"
on public.workouts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "body measurements are owned by user"
on public.body_measurements
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "progress photos are owned by user"
on public.progress_photos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can upload own progress photos"
on storage.objects
for insert
with check (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users can read own progress photos"
on storage.objects
for select
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

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

create policy "users can delete own progress photos"
on storage.objects
for delete
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
