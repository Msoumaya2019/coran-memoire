-- Apply after social.sql. Avatars stay in a private bucket and can only be read
-- by their owner or an accepted friend. Recordings keep their own policies.
alter table public.friend_profiles add column if not exists avatar_path text;
grant update(avatar_path) on public.friend_profiles to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('friend-avatars','friend-avatars',false,2097152,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];

drop policy if exists friend_avatars_read on storage.objects;
create policy friend_avatars_read on storage.objects for select to authenticated using (
  bucket_id='friend-avatars' and (
    split_part(name,'/',1)=(select auth.uid())::text
    or exists(select 1 from public.friend_links l where l.status='accepted'
      and ((l.requester_id=(select auth.uid()) and l.recipient_id::text=split_part(name,'/',1))
        or (l.recipient_id=(select auth.uid()) and l.requester_id::text=split_part(name,'/',1))))
  )
);
drop policy if exists friend_avatars_insert on storage.objects;
create policy friend_avatars_insert on storage.objects for insert to authenticated
with check (bucket_id='friend-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
drop policy if exists friend_avatars_update on storage.objects;
create policy friend_avatars_update on storage.objects for update to authenticated
using (bucket_id='friend-avatars' and name=(select auth.uid())::text||'/avatar.jpg')
with check (bucket_id='friend-avatars' and name=(select auth.uid())::text||'/avatar.jpg');
drop policy if exists friend_avatars_delete on storage.objects;
create policy friend_avatars_delete on storage.objects for delete to authenticated
using (bucket_id='friend-avatars' and name=(select auth.uid())::text||'/avatar.jpg');

drop policy if exists friend_read_receipts on public.friend_message_reads;
create policy friend_read_receipts on public.friend_message_reads for select to authenticated using (
  exists(select 1 from public.friend_links l where l.id=link_id and l.status='accepted'
    and (select auth.uid()) in (l.requester_id,l.recipient_id))
);
