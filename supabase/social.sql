-- À exécuter après schema.sql. Aucun accès ami à public.user_state.
create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists public.friend_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  share_online boolean not null default true,
  share_location boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  blocked_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> recipient_id),
  check (blocked_by is null or blocked_by in (requester_id,recipient_id))
);
create unique index if not exists friend_links_pair on public.friend_links
  (least(requester_id,recipient_id),greatest(requester_id,recipient_id));

create table if not exists public.friend_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_label text not null default '',
  weekly_verses integer not null default 0 check (weekly_verses >= 0),
  weekly_sessions integer not null default 0 check (weekly_sessions >= 0),
  goal_percent numeric(5,2) not null default 0 check (goal_percent between 0 and 100),
  quran_percent numeric(5,2) not null default 0 check (quran_percent between 0 and 100),
  current_start integer check (current_start between 1 and 6236),
  current_end integer check (current_end between 1 and 6236),
  online_until timestamptz,
  updated_at timestamptz not null default now(),
  check (current_start is null or current_end >= current_start)
);

create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.friend_group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  primary key (group_id,user_id)
);

create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.friend_links(id) on delete cascade,
  group_id uuid references public.friend_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','encouragement')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  check ((link_id is null) <> (group_id is null))
);
create index if not exists friend_messages_link_time on public.friend_messages(link_id,created_at desc);
create index if not exists friend_messages_group_time on public.friend_messages(group_id,created_at desc);

create table if not exists public.friend_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.friend_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  excerpt text not null,
  created_at timestamptz not null default now(),
  unique (message_id,reporter_id)
);

-- Les administrateurs sont attribués par le propriétaire du projet dans SQL Editor.
-- Aucun client ne peut créer son propre rôle administrateur.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.social_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  suspended_until timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.friend_message_reports add column if not exists status text not null default 'open';
alter table public.friend_message_reports add column if not exists reviewed_at timestamptz;
alter table public.friend_message_reports add column if not exists reviewed_by uuid references auth.users(id);
alter table public.friend_message_reports drop constraint if exists friend_message_reports_status_check;
alter table public.friend_message_reports add constraint friend_message_reports_status_check check (status in ('open','reviewed'));

create table if not exists public.friend_shared_goals (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.friend_links(id) on delete cascade,
  week_start date not null,
  target_sessions integer not null check (target_sessions between 1 and 14),
  proposed_by uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (link_id,week_start)
);
create table if not exists public.friend_review_appointments (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.friend_links(id) on delete cascade,
  starts_at timestamptz not null,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function private.is_friend(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_links l
    where l.status='accepted' and
    ((l.requester_id=(select auth.uid()) and l.recipient_id=p_other)
      or (l.recipient_id=(select auth.uid()) and l.requester_id=p_other)));
$$;
create or replace function private.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.app_admins where user_id=(select auth.uid()));
$$;
create or replace function private.is_social_suspended(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.social_suspensions
    where user_id=p_user and (suspended_until is null or suspended_until>now()));
$$;
create or replace function private.has_friend_link(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_links l
    where l.status in ('pending','accepted') and
    ((l.requester_id=(select auth.uid()) and l.recipient_id=p_other)
      or (l.recipient_id=(select auth.uid()) and l.requester_id=p_other)));
$$;
create or replace function private.active_link(p_link uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_links l where l.id=p_link
    and l.status='accepted' and (select auth.uid()) in (l.requester_id,l.recipient_id));
$$;
create or replace function private.group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_group_members m where m.group_id=p_group
    and m.user_id=(select auth.uid()) and m.accepted_at is not null);
$$;
create or replace function private.group_invitee(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_group_members m where m.group_id=p_group
    and m.user_id=(select auth.uid()));
$$;
create or replace function private.group_moderator(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_group_members m where m.group_id=p_group
    and m.user_id=(select auth.uid()) and m.accepted_at is not null
    and m.role in ('owner','moderator'));
$$;
create or replace function private.shared_group(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friend_group_members mine
    join public.friend_group_members theirs on theirs.group_id=mine.group_id
    where mine.user_id=(select auth.uid()) and theirs.user_id=p_other
      and mine.accepted_at is not null and theirs.accepted_at is not null);
$$;
create or replace function private.can_read_chat(p_link uuid,p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_link is not null then private.active_link(p_link)
    else private.group_member(p_group) end;
$$;

revoke all on function private.is_friend(uuid),private.has_friend_link(uuid),private.active_link(uuid),
  private.group_member(uuid),private.group_invitee(uuid),private.group_moderator(uuid),
  private.shared_group(uuid),private.can_read_chat(uuid,uuid) from public,anon;
revoke all on function private.is_app_admin(),private.is_social_suspended(uuid) from public,anon;
grant execute on function private.is_app_admin(),private.is_social_suspended(uuid) to authenticated;
grant execute on function private.is_friend(uuid),private.has_friend_link(uuid),private.active_link(uuid),
  private.group_member(uuid),private.group_invitee(uuid),private.group_moderator(uuid),
  private.shared_group(uuid),private.can_read_chat(uuid,uuid) to authenticated;

alter table public.friend_profiles enable row level security;
alter table public.friend_links enable row level security;
alter table public.friend_progress enable row level security;
alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.friend_messages enable row level security;
alter table public.friend_message_reports enable row level security;
alter table public.friend_shared_goals enable row level security;
alter table public.friend_review_appointments enable row level security;
alter table public.app_admins enable row level security;
alter table public.social_suspensions enable row level security;

revoke all on public.friend_profiles,public.friend_links,public.friend_progress,
  public.friend_groups,public.friend_group_members,public.friend_messages,
  public.friend_message_reports,public.friend_shared_goals,public.friend_review_appointments from anon,authenticated;
revoke all on public.app_admins,public.social_suspensions from anon,authenticated;
grant select on public.app_admins,public.social_suspensions to authenticated;
grant select,insert on public.friend_profiles to authenticated;
grant update(display_name,share_online,share_location) on public.friend_profiles to authenticated;
grant select on public.friend_links to authenticated;
grant select,insert on public.friend_progress to authenticated;
grant update(goal_label,weekly_verses,weekly_sessions,goal_percent,quran_percent,current_start,current_end,updated_at) on public.friend_progress to authenticated;
grant select on public.friend_groups,public.friend_group_members to authenticated;
grant select,insert on public.friend_messages to authenticated;
grant select on public.friend_message_reports to authenticated;
grant select,insert on public.friend_shared_goals,public.friend_review_appointments to authenticated;

drop policy if exists "profiles read" on public.friend_profiles;
drop policy if exists "profiles insert" on public.friend_profiles;
drop policy if exists "profiles update" on public.friend_profiles;
create policy "profiles read" on public.friend_profiles for select to authenticated
  using (id=(select auth.uid()) or private.has_friend_link(id) or private.shared_group(id) or private.is_app_admin());
create policy "profiles insert" on public.friend_profiles for insert to authenticated
  with check (id=(select auth.uid()));
create policy "profiles update" on public.friend_profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));

drop policy if exists "links read" on public.friend_links;
create policy "links read" on public.friend_links for select to authenticated
  using ((select auth.uid()) in (requester_id,recipient_id));

drop policy if exists "progress own read" on public.friend_progress;
drop policy if exists "progress own insert" on public.friend_progress;
drop policy if exists "progress own update" on public.friend_progress;
create policy "progress own read" on public.friend_progress for select to authenticated using (user_id=(select auth.uid()));
create policy "progress own insert" on public.friend_progress for insert to authenticated with check (user_id=(select auth.uid()));
create policy "progress own update" on public.friend_progress for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "groups read" on public.friend_groups;
create policy "groups read" on public.friend_groups for select to authenticated using (private.group_invitee(id));
drop policy if exists "group members read" on public.friend_group_members;
create policy "group members read" on public.friend_group_members for select to authenticated
  using (user_id=(select auth.uid()) or private.group_member(group_id));

drop policy if exists "chat read" on public.friend_messages;
drop policy if exists "chat send" on public.friend_messages;
create policy "chat read" on public.friend_messages for select to authenticated
  using (private.can_read_chat(link_id,group_id) or private.is_app_admin());
create policy "chat send" on public.friend_messages for insert to authenticated
  with check (sender_id=(select auth.uid()) and private.can_read_chat(link_id,group_id)
    and not private.is_social_suspended((select auth.uid())));

drop policy if exists "reports own read" on public.friend_message_reports;
drop policy if exists "reports moderators read" on public.friend_message_reports;
create policy "reports own read" on public.friend_message_reports for select to authenticated
  using (reporter_id=(select auth.uid()));
create policy "reports moderators read" on public.friend_message_reports for select to authenticated
  using (exists(select 1 from public.friend_messages m where m.id=message_id
    and m.group_id is not null and private.group_moderator(m.group_id)));
drop policy if exists "reports admins read" on public.friend_message_reports;
create policy "reports admins read" on public.friend_message_reports for select to authenticated
  using (private.is_app_admin());
drop policy if exists "admins own read" on public.app_admins;
create policy "admins own read" on public.app_admins for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists "suspensions read" on public.social_suspensions;
create policy "suspensions read" on public.social_suspensions for select to authenticated
  using (user_id=(select auth.uid()) or private.is_app_admin());

drop policy if exists "shared goals read" on public.friend_shared_goals;
drop policy if exists "shared goals propose" on public.friend_shared_goals;
create policy "shared goals read" on public.friend_shared_goals for select to authenticated
  using (private.active_link(link_id));
create policy "shared goals propose" on public.friend_shared_goals for insert to authenticated
  with check (proposed_by=(select auth.uid()) and accepted_at is null and private.active_link(link_id));

drop policy if exists "appointments read" on public.friend_review_appointments;
drop policy if exists "appointments propose" on public.friend_review_appointments;
create policy "appointments read" on public.friend_review_appointments for select to authenticated
  using (private.active_link(link_id));
create policy "appointments propose" on public.friend_review_appointments for insert to authenticated
  with check (proposed_by=(select auth.uid()) and accepted_at is null and starts_at>now() and private.active_link(link_id));

create or replace function public.ensure_social_profile() returns public.friend_profiles
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_profile public.friend_profiles;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  insert into public.friend_profiles(id,display_name) values(v_user,'Apprenant') on conflict(id) do nothing;
  select * into v_profile from public.friend_profiles where id=v_user;
  return v_profile;
end $$;

create or replace function public.request_friend(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_target uuid; v_link uuid;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  select id into v_target from public.friend_profiles where invite_code=upper(btrim(p_code));
  if v_target is null then raise exception 'Code ami introuvable'; end if;
  if v_target=v_user then raise exception 'Tu ne peux pas t’inviter toi-même'; end if;
  if exists(select 1 from public.friend_links where
    (requester_id=v_user and recipient_id=v_target) or (requester_id=v_target and recipient_id=v_user))
    then raise exception 'Invitation ou relation déjà existante'; end if;
  insert into public.friend_links(requester_id,recipient_id) values(v_user,v_target) returning id into v_link;
  return v_link;
end $$;

create or replace function public.accept_friend(p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_links set status='accepted',accepted_at=now()
    where id=p_link and recipient_id=auth.uid() and status='pending';
  if not found then raise exception 'Invitation indisponible'; end if;
end $$;
create or replace function public.decline_friend(p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_links where id=p_link and recipient_id=auth.uid() and status='pending';
  if not found then raise exception 'Invitation indisponible'; end if;
end $$;
create or replace function public.remove_friend(p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_links where id=p_link and status='accepted'
    and auth.uid() in (requester_id,recipient_id);
  if not found then raise exception 'Amitié introuvable'; end if;
end $$;
create or replace function public.block_friend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_link uuid;
begin
  if v_user is null or v_user=p_other then raise exception 'Compte invalide'; end if;
  if exists(select 1 from public.friend_links where status='blocked' and blocked_by<>v_user
    and ((requester_id=v_user and recipient_id=p_other) or (requester_id=p_other and recipient_id=v_user)))
    then raise exception 'Personne indisponible'; end if;
  select id into v_link from public.friend_links where
    (requester_id=v_user and recipient_id=p_other) or (requester_id=p_other and recipient_id=v_user);
  if v_link is null then
    insert into public.friend_links(requester_id,recipient_id,status,blocked_by)
      values(v_user,p_other,'blocked',v_user);
  else
    update public.friend_links set status='blocked',blocked_by=v_user,accepted_at=null where id=v_link;
  end if;
end $$;
create or replace function public.unblock_friend(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_links where status='blocked' and blocked_by=auth.uid()
    and (requester_id=p_other or recipient_id=p_other);
  if not found then raise exception 'Blocage introuvable'; end if;
end $$;

create or replace function public.publish_social_progress(
  p_goal_label text,p_weekly_verses integer,p_weekly_sessions integer,
  p_goal_percent numeric,p_quran_percent numeric,p_current_start integer,p_current_end integer
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  insert into public.friend_progress(user_id,goal_label,weekly_verses,weekly_sessions,goal_percent,quran_percent,current_start,current_end,updated_at)
    values(v_user,left(p_goal_label,100),p_weekly_verses,p_weekly_sessions,p_goal_percent,p_quran_percent,p_current_start,p_current_end,now())
    on conflict(user_id) do update set goal_label=excluded.goal_label,weekly_verses=excluded.weekly_verses,
      weekly_sessions=excluded.weekly_sessions,goal_percent=excluded.goal_percent,quran_percent=excluded.quran_percent,
      current_start=excluded.current_start,current_end=excluded.current_end,updated_at=now();
end $$;
create or replace function public.set_social_online(p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  insert into public.friend_progress(user_id,online_until)
    values(v_user,case when p_active then now()+interval '75 seconds' else now() end)
    on conflict(user_id) do update set online_until=excluded.online_until;
end $$;
create or replace function public.friend_overview(p_other uuid)
returns table(id uuid,display_name text,goal_label text,weekly_verses integer,weekly_sessions integer,
  goal_percent numeric,quran_percent numeric,current_start integer,current_end integer,is_online boolean,updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_friend(p_other) then raise exception 'Ami non autorisé'; end if;
  return query select p.id,p.display_name,coalesce(f.goal_label,''),coalesce(f.weekly_verses,0),
    coalesce(f.weekly_sessions,0),coalesce(f.goal_percent,0),coalesce(f.quran_percent,0),
    case when p.share_location then f.current_start else null end,
    case when p.share_location then f.current_end else null end,
    p.share_online and coalesce(f.online_until>now(),false),f.updated_at
    from public.friend_profiles p left join public.friend_progress f on f.user_id=p.id where p.id=p_other;
end $$;

create or replace function public.create_friend_group(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_group uuid;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  insert into public.friend_groups(name,owner_id) values(btrim(p_name),v_user) returning id into v_group;
  insert into public.friend_group_members(group_id,user_id,role,accepted_at)
    values(v_group,v_user,'owner',now());
  return v_group;
end $$;
create or replace function public.invite_group_member(p_group uuid,p_friend uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.group_moderator(p_group) or not private.is_friend(p_friend)
    then raise exception 'Invitation non autorisée'; end if;
  if (select count(*) from public.friend_group_members where group_id=p_group)>=5
    then raise exception 'Ce cercle est limité à cinq personnes'; end if;
  insert into public.friend_group_members(group_id,user_id,invited_by)
    values(p_group,p_friend,auth.uid());
end $$;
create or replace function public.accept_group_invite(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.friend_group_members where group_id=p_group and accepted_at is not null)>=5
    then raise exception 'Ce cercle est complet'; end if;
  update public.friend_group_members set accepted_at=now()
    where group_id=p_group and user_id=auth.uid() and accepted_at is null;
  if not found then raise exception 'Invitation introuvable'; end if;
end $$;
create or replace function public.decline_group_invite(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_group_members where group_id=p_group and user_id=auth.uid() and accepted_at is null;
  if not found then raise exception 'Invitation introuvable'; end if;
end $$;
create or replace function public.set_group_moderator(p_group uuid,p_member uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.friend_groups where id=p_group and owner_id=auth.uid())
    then raise exception 'Seul le créateur peut nommer un modérateur'; end if;
  update public.friend_group_members set role=case when p_enabled then 'moderator' else 'member' end
    where group_id=p_group and user_id=p_member and role<>'owner' and accepted_at is not null;
  if not found then raise exception 'Membre introuvable'; end if;
end $$;
create or replace function public.remove_group_member(p_group uuid,p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_member<>auth.uid() and not private.group_moderator(p_group)
    then raise exception 'Action non autorisée'; end if;
  delete from public.friend_group_members where group_id=p_group and user_id=p_member and role<>'owner';
  if not found then raise exception 'Membre introuvable'; end if;
end $$;
create or replace function public.delete_friend_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_groups where id=p_group and owner_id=auth.uid();
  if not found then raise exception 'Cercle introuvable'; end if;
end $$;

create or replace function public.delete_friend_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_message public.friend_messages;
begin
  select * into v_message from public.friend_messages where id=p_message;
  if not found or not (private.can_read_chat(v_message.link_id,v_message.group_id) or private.is_app_admin())
    then raise exception 'Message introuvable'; end if;
  if v_message.sender_id<>auth.uid() and v_message.group_id is not null
    and not private.group_moderator(v_message.group_id) and not private.is_app_admin()
    then raise exception 'Action non autorisée'; end if;
  if v_message.sender_id<>auth.uid() and v_message.group_id is null and not private.is_app_admin()
    then raise exception 'Action non autorisée'; end if;
  update public.friend_messages set body='[Message supprimé]',deleted_at=now(),deleted_by=auth.uid()
    where id=p_message and deleted_at is null;
end $$;

create or replace function public.resolve_friend_report(p_report uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_message public.friend_messages;
begin
  if not private.is_app_admin() then raise exception 'Action réservée à l’administrateur'; end if;
  select m.* into v_message from public.friend_message_reports r
    join public.friend_messages m on m.id=r.message_id where r.id=p_report;
  if not found then raise exception 'Signalement introuvable'; end if;
  update public.friend_message_reports set status='reviewed',reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_report;
end $$;
create or replace function public.suspend_social_member(p_user uuid,p_reason text,p_until timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_app_admin() then raise exception 'Action réservée à l’administrateur'; end if;
  if p_user=auth.uid() then raise exception 'Auto-suspension interdite'; end if;
  if exists(select 1 from public.app_admins where user_id=p_user) then raise exception 'Compte administrateur protégé'; end if;
  if p_until is not null and p_until<=now() then raise exception 'Date de fin invalide'; end if;
  insert into public.social_suspensions(user_id,reason,suspended_until,created_by)
    values(p_user,btrim(p_reason),p_until,auth.uid())
    on conflict(user_id) do update set reason=excluded.reason,suspended_until=excluded.suspended_until,
      created_by=excluded.created_by,created_at=now();
end $$;
create or replace function public.unsuspend_social_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_app_admin() then raise exception 'Action réservée à l’administrateur'; end if;
  delete from public.social_suspensions where user_id=p_user;
end $$;
create or replace function public.report_friend_message(p_message uuid,p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_message public.friend_messages;
begin
  select * into v_message from public.friend_messages where id=p_message;
  if not found or v_message.deleted_at is not null or not private.can_read_chat(v_message.link_id,v_message.group_id)
    then raise exception 'Message indisponible'; end if;
  insert into public.friend_message_reports(message_id,reporter_id,reason,excerpt)
    values(p_message,auth.uid(),btrim(p_reason),v_message.body)
    on conflict(message_id,reporter_id) do nothing;
end $$;

create or replace function public.accept_shared_goal(p_goal uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_shared_goals set accepted_at=now() where id=p_goal and accepted_at is null
    and proposed_by<>auth.uid() and private.active_link(link_id);
  if not found then raise exception 'Objectif partagé indisponible'; end if;
end $$;
create or replace function public.accept_review_appointment(p_appointment uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friend_review_appointments set accepted_at=now()
    where id=p_appointment and accepted_at is null and starts_at>now()
      and proposed_by<>auth.uid() and private.active_link(link_id);
  if not found then raise exception 'Rendez-vous indisponible'; end if;
end $$;
create or replace function public.cancel_review_appointment(p_appointment uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friend_review_appointments where id=p_appointment and private.active_link(link_id);
  if not found then raise exception 'Rendez-vous indisponible'; end if;
end $$;

revoke execute on function public.ensure_social_profile(),public.request_friend(text),
  public.accept_friend(uuid),public.decline_friend(uuid),public.remove_friend(uuid),
  public.block_friend(uuid),public.unblock_friend(uuid),
  public.publish_social_progress(text,integer,integer,numeric,numeric,integer,integer),
  public.set_social_online(boolean),public.friend_overview(uuid),
  public.create_friend_group(text),public.invite_group_member(uuid,uuid),
  public.accept_group_invite(uuid),public.decline_group_invite(uuid),
  public.set_group_moderator(uuid,uuid,boolean),public.remove_group_member(uuid,uuid),
  public.delete_friend_group(uuid),public.delete_friend_message(uuid),
  public.report_friend_message(uuid,text),public.accept_shared_goal(uuid),
  public.accept_review_appointment(uuid),public.cancel_review_appointment(uuid) from public,anon;
revoke execute on function public.resolve_friend_report(uuid),
  public.suspend_social_member(uuid,text,timestamptz),public.unsuspend_social_member(uuid) from public,anon;
grant execute on function public.ensure_social_profile(),public.request_friend(text),
  public.accept_friend(uuid),public.decline_friend(uuid),public.remove_friend(uuid),
  public.block_friend(uuid),public.unblock_friend(uuid),
  public.publish_social_progress(text,integer,integer,numeric,numeric,integer,integer),
  public.set_social_online(boolean),public.friend_overview(uuid),
  public.create_friend_group(text),public.invite_group_member(uuid,uuid),
  public.accept_group_invite(uuid),public.decline_group_invite(uuid),
  public.set_group_moderator(uuid,uuid,boolean),public.remove_group_member(uuid,uuid),
  public.delete_friend_group(uuid),public.delete_friend_message(uuid),
  public.report_friend_message(uuid,text),public.accept_shared_goal(uuid),
  public.accept_review_appointment(uuid),public.cancel_review_appointment(uuid) to authenticated;
grant execute on function public.resolve_friend_report(uuid),
  public.suspend_social_member(uuid,text,timestamptz),public.unsuspend_social_member(uuid) to authenticated;
