-- One private conversation per member, shared with all administrators.
alter table public.friend_groups add column if not exists contact_user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists friend_groups_contact_user_key on public.friend_groups(contact_user_id) where contact_user_id is not null;
create or replace function public.open_admin_contact() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_group uuid;v_name text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.app_admins) then raise exception 'Administration indisponible'; end if;
  select display_name into v_name from public.friend_profiles where id=v_user;
  insert into public.friend_groups(name,owner_id,contact_user_id)
    values('Contact · '||coalesce(v_name,'Membre'),v_user,v_user)
    on conflict(contact_user_id) where contact_user_id is not null do update set name=excluded.name returning id into v_group;
  insert into public.friend_group_members(group_id,user_id,role,accepted_at) values(v_group,v_user,'member',now()) on conflict(group_id,user_id) do nothing;
  insert into public.friend_group_members(group_id,user_id,role,accepted_at)
    select v_group,user_id,'member',now() from public.app_admins
    on conflict(group_id,user_id) do update set accepted_at=excluded.accepted_at,role='member';
  delete from public.friend_group_members m where m.group_id=v_group and m.user_id<>v_user
    and not exists(select 1 from public.app_admins a where a.user_id=m.user_id);
  return v_group;
end $$;
create or replace function private.sync_admin_contacts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP='INSERT' then
    insert into public.friend_group_members(group_id,user_id,role,accepted_at)
      select id,new.user_id,'member',now() from public.friend_groups where contact_user_id is not null
      on conflict(group_id,user_id) do update set accepted_at=excluded.accepted_at,role='member';
  else
    delete from public.friend_group_members m using public.friend_groups g
      where m.group_id=g.id and g.contact_user_id is not null and m.user_id=old.user_id and g.contact_user_id<>old.user_id;
  end if;
  return null;
end $$;
drop trigger if exists sync_admin_contacts on public.app_admins;
create trigger sync_admin_contacts after insert or delete on public.app_admins for each row execute function private.sync_admin_contacts();
revoke all on function public.open_admin_contact() from public,anon;
grant execute on function public.open_admin_contact() to authenticated;
