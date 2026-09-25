-- À exécuter après social.sql. La table des messages existante est conservée.
create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_devices (
  installation_id text primary key check (char_length(installation_id) between 16 and 100),
  expo_push_token text not null unique check (expo_push_token like 'ExpoPushToken[%]' or expo_push_token like 'ExponentPushToken[%]'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  active_link_id uuid,
  last_active_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user_id on public.push_devices(user_id);

alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;
revoke all on public.notification_preferences,public.push_devices from anon,authenticated;
grant select,insert,update,delete on public.notification_preferences,public.push_devices to authenticated;

drop policy if exists "notification settings own" on public.notification_preferences;
create policy "notification settings own" on public.notification_preferences
  for all to authenticated using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
drop policy if exists "push devices own" on public.push_devices;
create policy "push devices own" on public.push_devices
  for all to authenticated using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

create or replace function private.notify_private_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid;
  v_sender text;
  v_device record;
begin
  if new.link_id is null then return new; end if;
  select case when l.requester_id=new.sender_id then l.recipient_id else l.requester_id end
    into v_recipient from public.friend_links l
    where l.id=new.link_id and l.status='accepted'
      and new.sender_id in (l.requester_id,l.recipient_id);
  if v_recipient is null then return new; end if;
  if exists(select 1 from public.notification_preferences p
    where p.user_id=v_recipient and not p.messages_enabled) then return new; end if;
  select p.display_name into v_sender from public.friend_profiles p where p.id=new.sender_id;

  for v_device in
    select d.expo_push_token from public.push_devices d
      where d.user_id=v_recipient
        and not (d.active_link_id is not null and d.active_link_id=new.link_id
          and d.last_active_at>now()-interval '30 seconds')
  loop
    perform net.http_post(
      url:='https://exp.host/--/api/v2/push/send',
      body:=jsonb_build_object(
        'to',v_device.expo_push_token,
        'title','Nouveau message de '||coalesce(v_sender,'un ami'),
        'body',left(new.body,600),
        'data',jsonb_build_object('kind','private-message','linkId',new.link_id,'messageId',new.id),
        'sound','default','priority','high','channelId','messages'
      ),
      headers:='{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds:=5000
    );
  end loop;
  return new;
end;
$$;
revoke all on function private.notify_private_message() from public,anon,authenticated;
drop trigger if exists notify_private_message on public.friend_messages;
create trigger notify_private_message after insert on public.friend_messages
  for each row execute function private.notify_private_message();
