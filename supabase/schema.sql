create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
revoke all on public.user_state from anon;
grant select, insert, update, delete on public.user_state to authenticated;
drop policy if exists "own state select" on public.user_state;
drop policy if exists "own state insert" on public.user_state;
drop policy if exists "own state update" on public.user_state;
drop policy if exists "own state delete" on public.user_state;
create policy "own state select" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "own state insert" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own state update" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own state delete" on public.user_state for delete to authenticated using ((select auth.uid()) = user_id);
