-- Additive migration. Existing learning state, accounts and messages are unchanged.
create table if not exists public.recitations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_verse_id integer not null check (start_verse_id between 1 and 6236),
  end_verse_id integer not null check (end_verse_id between 1 and 6236 and end_verse_id >= start_verse_id),
  duration_ms integer not null check (duration_ms > 0),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  listened_at timestamptz,
  constraint recitation_own_path check (storage_path like user_id::text || '/%')
);
alter table public.recitations add column if not exists listened_at timestamptz;

create table if not exists public.recitation_corrections (
  id uuid primary key default gen_random_uuid(),
  recitation_id text not null references public.recitations(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  verse_id integer not null check (verse_id between 1 and 6236),
  comment text,
  voice_path text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint correction_has_content check (nullif(btrim(comment),'') is not null or voice_path is not null)
);
create table if not exists public.recitation_feedback (
  id uuid primary key default gen_random_uuid(),
  recitation_id text not null references public.recitations(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  comment text,
  voice_path text,
  created_at timestamptz not null default now(),
  constraint feedback_has_content check (nullif(btrim(comment),'') is not null or voice_path is not null)
);
create index if not exists recitations_user_date_idx on public.recitations(user_id,created_at desc);
create index if not exists corrections_recitation_idx on public.recitation_corrections(recitation_id,created_at desc);

alter table public.recitations enable row level security;
alter table public.recitation_corrections enable row level security;
alter table public.recitation_feedback enable row level security;
revoke all on public.recitations,public.recitation_corrections,public.recitation_feedback from anon;
grant select,insert,update on public.recitations to authenticated;
grant select,insert,update on public.recitation_corrections to authenticated;
grant select,insert on public.recitation_feedback to authenticated;

drop policy if exists recitations_read on public.recitations;
create policy recitations_read on public.recitations for select to authenticated
using (user_id=(select auth.uid()) or private.is_app_admin());
drop policy if exists recitations_insert on public.recitations;
create policy recitations_insert on public.recitations for insert to authenticated
with check (user_id=(select auth.uid()));
drop policy if exists recitations_update on public.recitations;
create policy recitations_update on public.recitations for update to authenticated
using (private.is_app_admin()) with check (private.is_app_admin());

drop policy if exists corrections_read on public.recitation_corrections;
create policy corrections_read on public.recitation_corrections for select to authenticated
using (private.is_app_admin() or exists(select 1 from public.recitations r where r.id=recitation_id and r.user_id=(select auth.uid())));
drop policy if exists corrections_admin_insert on public.recitation_corrections;
create policy corrections_admin_insert on public.recitation_corrections for insert to authenticated
with check (
  private.is_app_admin() and admin_id=(select auth.uid())
  and exists(select 1 from public.recitations r where r.id=recitation_id and verse_id between r.start_verse_id and r.end_verse_id)
);
drop policy if exists corrections_admin_update on public.recitation_corrections;
create policy corrections_admin_update on public.recitation_corrections for update to authenticated
using (private.is_app_admin()) with check (private.is_app_admin());

drop policy if exists feedback_read on public.recitation_feedback;
create policy feedback_read on public.recitation_feedback for select to authenticated
using (private.is_app_admin() or exists(select 1 from public.recitations r where r.id=recitation_id and r.user_id=(select auth.uid())));
drop policy if exists feedback_admin_insert on public.recitation_feedback;
create policy feedback_admin_insert on public.recitation_feedback for insert to authenticated
with check (private.is_app_admin() and admin_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('recitations','recitations',false,52428800,array['audio/mp4','audio/3gpp','audio/m4a','audio/wav'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['audio/mp4','audio/3gpp','audio/m4a','audio/wav'];

drop policy if exists recitation_files_owner_insert on storage.objects;
create policy recitation_files_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='recitations' and split_part(name,'/',1)=(select auth.uid())::text);
drop policy if exists recitation_files_read on storage.objects;
create policy recitation_files_read on storage.objects for select to authenticated
using (
  bucket_id='recitations' and (
    split_part(name,'/',1)=(select auth.uid())::text
    or private.is_app_admin()
    or exists (
      select 1 from public.recitation_corrections c
      join public.recitations r on r.id=c.recitation_id
      where c.voice_path=name and r.user_id=(select auth.uid())
    )
    or exists (
      select 1 from public.recitation_feedback f
      join public.recitations r on r.id=f.recitation_id
      where f.voice_path=name and r.user_id=(select auth.uid())
    )
  )
);
drop policy if exists recitation_feedback_admin_insert on storage.objects;
create policy recitation_feedback_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='recitations' and split_part(name,'/',1)='feedback' and private.is_app_admin());
