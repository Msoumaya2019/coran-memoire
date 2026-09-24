-- Apply after social-v2.sql and recitations.sql. Existing messages and recordings remain private.
alter table public.friend_messages
  add column if not exists recitation_id text references public.recitations(id) on delete set null;
alter table public.friend_messages drop constraint if exists friend_messages_kind_check;
alter table public.friend_messages add constraint friend_messages_kind_check
  check (kind in ('text','encouragement','progress','recitation'));

create or replace function private.validate_recitation_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'recitation' then
    if new.group_id is not null or new.link_id is null or new.recitation_id is null
      or not exists(select 1 from public.recitations r
        where r.id=new.recitation_id and r.user_id=new.sender_id)
    then raise exception 'Récitation privée invalide'; end if;
  elsif new.recitation_id is not null then
    raise exception 'Pièce jointe invalide';
  end if;
  return new;
end $$;
revoke all on function private.validate_recitation_message() from public,anon,authenticated;
drop trigger if exists validate_recitation_message on public.friend_messages;
create trigger validate_recitation_message before insert on public.friend_messages
  for each row execute function private.validate_recitation_message();

create or replace function private.can_play_shared_recitation(p_recitation_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.recitations r
    join public.friend_messages m on m.recitation_id=r.id and m.kind='recitation' and m.deleted_at is null
    join public.friend_links l on l.id=m.link_id and l.status='accepted'
    where r.id=p_recitation_id and m.sender_id=r.user_id
      and auth.uid() in (l.requester_id,l.recipient_id)
      and auth.uid()<>r.user_id
      and r.user_id in (l.requester_id,l.recipient_id)
  );
$$;
revoke all on function private.can_play_shared_recitation(text) from public,anon;
grant execute on function private.can_play_shared_recitation(text) to authenticated;

drop policy if exists recitations_read on public.recitations;
create policy recitations_read on public.recitations for select to authenticated
  using (user_id=(select auth.uid()) or private.is_app_admin() or private.can_play_shared_recitation(id));

drop policy if exists recitation_files_read on storage.objects;
create policy recitation_files_read on storage.objects for select to authenticated
using (
  bucket_id='recitations' and (
    split_part(name,'/',1)=(select auth.uid())::text
    or private.is_app_admin()
    or exists(select 1 from public.recitations r
      where r.storage_path=name and private.can_play_shared_recitation(r.id))
    or exists(select 1 from public.recitation_corrections c
      join public.recitations r on r.id=c.recitation_id
      where c.voice_path=name and r.user_id=(select auth.uid()))
    or exists(select 1 from public.recitation_feedback f
      join public.recitations r on r.id=f.recitation_id
      where f.voice_path=name and r.user_id=(select auth.uid()))
  )
);

grant delete on public.recitations to authenticated;
drop policy if exists recitations_owner_delete on public.recitations;
create policy recitations_owner_delete on public.recitations for delete to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists recitation_files_owner_delete on storage.objects;
create policy recitation_files_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='recitations' and split_part(name,'/',1)=(select auth.uid())::text);
