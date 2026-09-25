-- À exécuter après social.sql et notifications.sql. Les comptes et messages existants sont conservés.
alter table public.friend_profiles add column if not exists share_progress boolean not null default false;
alter table public.friend_profiles alter column share_online set default false;
alter table public.friend_profiles alter column share_location set default false;
update public.friend_profiles set share_online=false,share_location=false;
grant update(display_name,share_online,share_location,share_progress) on public.friend_profiles to authenticated;

create or replace function public.friend_overview(p_other uuid)
returns table(id uuid,display_name text,goal_label text,weekly_verses integer,weekly_sessions integer,
  goal_percent numeric,quran_percent numeric,current_start integer,current_end integer,is_online boolean,updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_friend(p_other) then raise exception 'Ami non autorisé'; end if;
  return query select p.id,p.display_name,
    case when p.share_progress then coalesce(f.goal_label,'') else '' end,
    case when p.share_progress then coalesce(f.weekly_verses,0) else 0 end,
    case when p.share_progress then coalesce(f.weekly_sessions,0) else 0 end,
    case when p.share_progress then coalesce(f.goal_percent,0) else 0 end,
    case when p.share_progress then coalesce(f.quran_percent,0) else 0 end,
    case when p.share_progress and p.share_location then f.current_start else null end,
    case when p.share_progress and p.share_location then f.current_end else null end,
    p.share_online and coalesce(f.online_until>now(),false),
    case when p.share_progress then f.updated_at else null end
    from public.friend_profiles p left join public.friend_progress f on f.user_id=p.id where p.id=p_other;
end $$;

create table if not exists public.friend_message_reads (
  link_id uuid not null references public.friend_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(link_id,user_id)
);
create table if not exists public.friend_message_hidden (
  message_id uuid not null references public.friend_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(message_id,user_id)
);
alter table public.friend_message_reads enable row level security;
alter table public.friend_message_hidden enable row level security;
revoke all on public.friend_message_reads,public.friend_message_hidden from anon,authenticated;
grant select,insert,update on public.friend_message_reads to authenticated;
grant select,insert,delete on public.friend_message_hidden to authenticated;
drop policy if exists "own message reads" on public.friend_message_reads;
create policy "own message reads" on public.friend_message_reads for all to authenticated
  using (user_id=(select auth.uid()) and private.can_read_chat(link_id,null))
  with check (user_id=(select auth.uid()) and private.can_read_chat(link_id,null));
drop policy if exists "own hidden messages" on public.friend_message_hidden;
create policy "own hidden messages" on public.friend_message_hidden for all to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.friend_messages m where m.id=message_id and private.can_read_chat(m.link_id,m.group_id)))
  with check (user_id=(select auth.uid()) and exists(select 1 from public.friend_messages m where m.id=message_id and private.can_read_chat(m.link_id,m.group_id)));

create or replace function public.my_unread_messages() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.friend_messages m
  join public.friend_links l on l.id=m.link_id and l.status='accepted'
  left join public.friend_message_reads r on r.link_id=l.id and r.user_id=auth.uid()
  where auth.uid() in (l.requester_id,l.recipient_id)
    and m.sender_id<>auth.uid() and m.deleted_at is null
    and m.created_at>coalesce(r.last_read_at,l.created_at)
    and not exists(select 1 from public.friend_message_hidden h where h.message_id=m.id and h.user_id=auth.uid());
$$;
revoke all on function public.my_unread_messages() from public,anon;
grant execute on function public.my_unread_messages() to authenticated;

alter table public.notification_preferences add column if not exists friend_requests_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists shared_progress_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists revision_reminders_enabled boolean not null default false;
alter table public.notification_preferences add column if not exists message_preview_enabled boolean not null default true;
alter table public.friend_messages drop constraint if exists friend_messages_kind_check;
alter table public.friend_messages add constraint friend_messages_kind_check check (kind in ('text','encouragement','progress'));

create or replace function private.notify_private_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_sender text; v_device record; v_preview boolean;
begin
  if new.link_id is null then return new; end if;
  select case when l.requester_id=new.sender_id then l.recipient_id else l.requester_id end
    into v_recipient from public.friend_links l
    where l.id=new.link_id and l.status='accepted'
      and new.sender_id in (l.requester_id,l.recipient_id);
  if v_recipient is null then return new; end if;
  if exists(select 1 from public.notification_preferences p where p.user_id=v_recipient and
    ((new.kind='progress' and not p.shared_progress_enabled) or (new.kind<>'progress' and not p.messages_enabled))) then return new; end if;
  select coalesce(p.message_preview_enabled,true) into v_preview from public.notification_preferences p where p.user_id=v_recipient;
  select p.display_name into v_sender from public.friend_profiles p where p.id=new.sender_id;
  for v_device in select d.expo_push_token from public.push_devices d
    where d.user_id=v_recipient and not (d.active_link_id is not null and d.active_link_id=new.link_id and d.last_active_at>now()-interval '30 seconds')
  loop
    perform net.http_post(url:='https://exp.host/--/api/v2/push/send',
      body:=jsonb_build_object('to',v_device.expo_push_token,
        'title',case when not coalesce(v_preview,true) then 'Nouveau message' when new.kind='progress' then coalesce(v_sender,'Un ami')||' a partagé une étape' else coalesce(v_sender,'Un ami')||' t’a envoyé un message' end,
        'body',case when coalesce(v_preview,true) then left(new.body,600) else 'Vous avez reçu un nouveau message' end,
        'data',jsonb_build_object('kind',case when new.kind='progress' then 'friend-progress' else 'private-message' end,'linkId',new.link_id,'messageId',new.id),
        'sound','default','priority','high','channelId','messages'),
      headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=5000);
  end loop;
  return new;
end $$;

create or replace function private.notify_friend_link() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_sender uuid; v_kind text; v_name text; v_device record;
begin
  if tg_op='INSERT' and new.status='pending' then
    v_recipient:=new.recipient_id; v_sender:=new.requester_id; v_kind:='friend-request';
  elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then
    v_recipient:=new.requester_id; v_sender:=new.recipient_id; v_kind:='friend-accepted';
  else return new; end if;
  if exists(select 1 from public.notification_preferences p where p.user_id=v_recipient and not p.friend_requests_enabled) then return new; end if;
  select display_name into v_name from public.friend_profiles where id=v_sender;
  for v_device in select expo_push_token from public.push_devices where user_id=v_recipient loop
    perform net.http_post(url:='https://exp.host/--/api/v2/push/send',
      body:=jsonb_build_object('to',v_device.expo_push_token,
        'title',case when v_kind='friend-request' then 'Nouvelle invitation' else 'Invitation acceptée' end,
        'body',case when v_kind='friend-request' then coalesce(v_name,'Un membre')||' souhaite devenir ton ami' else coalesce(v_name,'Un membre')||' a accepté ton invitation' end,
        'data',jsonb_build_object('kind',v_kind,'linkId',new.id),
        'sound','default','priority','high','channelId','messages'),
      headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=5000);
  end loop;
  return new;
end $$;
revoke all on function private.notify_friend_link() from public,anon,authenticated;
drop trigger if exists notify_friend_link on public.friend_links;
create trigger notify_friend_link after insert or update of status on public.friend_links
  for each row execute function private.notify_friend_link();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_messages') then
    alter publication supabase_realtime add table public.friend_messages;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_links') then
    alter publication supabase_realtime add table public.friend_links;
  end if;
end $$;
