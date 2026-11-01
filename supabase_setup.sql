-- DQT migration: user_progress is the existing per-user JSON sync table.
-- Run only if you have not already created it. This does not drop existing data.
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

drop policy if exists "Users can read own progress" on public.user_progress;
create policy "Users can read own progress" on public.user_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on public.user_progress;
create policy "Users can insert own progress" on public.user_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.user_progress;
create policy "Users can update own progress" on public.user_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
