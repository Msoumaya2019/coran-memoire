-- Après social.sql. Signalements et captures privés ; aucune donnée existante remplacée.
begin;
create table if not exists public.app_problem_reports(
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in('Bug','Affichage','Audio','Notification','Autre')),
 description text not null check(length(btrim(description)) between 1 and 500),
 screenshot_path text check(screenshot_path is null or screenshot_path in(user_id::text||'/'||id::text||'.jpg',user_id::text||'/'||id::text||'.png')),
 app_version text not null check(length(app_version)<=32),platform text not null check(platform in('ios','android','web')),
 created_at timestamptz not null default now(),status text not null default 'open' check(status in('open','resolved'))
);
create index if not exists app_problem_reports_status on public.app_problem_reports(status,created_at desc);
alter table public.app_problem_reports enable row level security;
revoke all on public.app_problem_reports from anon,authenticated;
grant select,insert,update on public.app_problem_reports to authenticated;
drop policy if exists problem_reports_read on public.app_problem_reports;
create policy problem_reports_read on public.app_problem_reports for select to authenticated using(user_id=auth.uid() or private.is_app_admin());
drop policy if exists problem_reports_insert on public.app_problem_reports;
create policy problem_reports_insert on public.app_problem_reports for insert to authenticated with check(user_id=auth.uid() and status='open');
drop policy if exists problem_reports_admin_update on public.app_problem_reports;
create policy problem_reports_admin_update on public.app_problem_reports for update to authenticated using(private.is_app_admin()) with check(private.is_app_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('problem-report-screenshots','problem-report-screenshots',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;
drop policy if exists problem_screenshots_insert on storage.objects;
create policy problem_screenshots_insert on storage.objects for insert to authenticated with check(bucket_id='problem-report-screenshots' and (storage.foldername(name))[1]=auth.uid()::text and name~('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(jpg|png)$'));
drop policy if exists problem_screenshots_read on storage.objects;
create policy problem_screenshots_read on storage.objects for select to authenticated using(bucket_id='problem-report-screenshots' and ((storage.foldername(name))[1]=auth.uid()::text or private.is_app_admin()));
commit;
