-- Skills Kepler learns in the Learning environment, one row per skill, private to each account.
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  notes text not null check (char_length(notes) between 1 and 2000),
  created_at timestamptz not null default now()
);
create unique index skills_user_name_key on public.skills (user_id, lower(name));
alter table public.skills enable row level security;
create policy "skills: read own" on public.skills for select to authenticated using ((select auth.uid()) = user_id);
create policy "skills: add own" on public.skills for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "skills: change own" on public.skills for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "skills: delete own" on public.skills for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.skills to authenticated;
