-- One-off administrator reminders. Apply after social.sql and notifications.sql.
-- Expo tokens remain private in push_devices; the client can only call the guarded RPC.
create extension if not exists pg_net with schema extensions;

alter table public.notification_preferences
  add column if not exists admin_messages_enabled boolean not null default true;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  admin_id uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id),
  title text not null,
  body text not null,
  recipient_count integer not null default 0,
  device_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_created_at on public.admin_notifications(created_at desc);
alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from anon,authenticated;
grant select on public.admin_notifications to authenticated;
drop policy if exists admin_notifications_read on public.admin_notifications;
create policy admin_notifications_read on public.admin_notifications for select to authenticated
  using (private.is_app_admin());

create or replace function public.admin_notification_recipients()
returns table(user_id uuid, display_name text, device_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_app_admin() then raise exception 'Accès administrateur refusé'; end if;
  return query
    select d.user_id,
      coalesce(nullif(btrim(p.display_name),''),'Élève '||left(d.user_id::text,8)) as display_name,
      count(*)::bigint as device_count
    from public.push_devices d
    left join public.friend_profiles p on p.id=d.user_id
    left join public.notification_preferences pref on pref.user_id=d.user_id
    where coalesce(pref.admin_messages_enabled,true)
    group by d.user_id,p.display_name
    order by 2;
end $$;
revoke all on function public.admin_notification_recipients() from public,anon;
grant execute on function public.admin_notification_recipients() to authenticated;

create or replace function public.send_admin_notification(
  p_target uuid, p_title text, p_body text, p_request_id text
) returns table(recipient_count integer, device_count integer)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_device record; v_recipients integer; v_devices integer;
begin
  if auth.uid() is null or not private.is_app_admin() then raise exception 'Accès administrateur refusé'; end if;
  p_title:=btrim(coalesce(p_title,'')); p_body:=btrim(coalesce(p_body,''));
  if char_length(p_title) not between 3 and 80 or char_length(p_body) not between 3 and 500
    then raise exception 'Titre ou message invalide'; end if;
  if p_request_id is null or char_length(p_request_id) not between 16 and 100
    then raise exception 'Identifiant d’envoi invalide'; end if;
  select count(distinct d.user_id)::integer,count(*)::integer into v_recipients,v_devices
    from public.push_devices d
    left join public.notification_preferences pref on pref.user_id=d.user_id
    where (p_target is null or d.user_id=p_target) and coalesce(pref.admin_messages_enabled,true);
  if v_devices=0 then raise exception 'Aucun appareil autorisé pour ce destinataire'; end if;
  if v_devices>500 then raise exception 'Envoi trop volumineux : limite de 500 appareils'; end if;
  insert into public.admin_notifications(request_id,admin_id,target_user_id,title,body,recipient_count,device_count)
    values(p_request_id,auth.uid(),p_target,p_title,p_body,v_recipients,v_devices)
    on conflict(request_id) do nothing returning id into v_id;
  if v_id is null then
    return query select n.recipient_count,n.device_count from public.admin_notifications n
      where n.request_id=p_request_id and n.admin_id=auth.uid();
    if not found then raise exception 'Identifiant d’envoi déjà utilisé'; end if;
    return;
  end if;
  for v_device in
    select distinct d.expo_push_token from public.push_devices d
    left join public.notification_preferences pref on pref.user_id=d.user_id
    where (p_target is null or d.user_id=p_target) and coalesce(pref.admin_messages_enabled,true)
  loop
    perform net.http_post(
      url:='https://exp.host/--/api/v2/push/send',
      body:=jsonb_build_object('to',v_device.expo_push_token,'title',p_title,'body',p_body,
        'data',jsonb_build_object('kind','admin-reminder','notificationId',v_id),
        'sound','default','priority','high','channelId','admin'),
      headers:='{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds:=5000
    );
  end loop;
  return query select v_recipients,v_devices;
end $$;
revoke all on function public.send_admin_notification(uuid,text,text,text) from public,anon;
grant execute on function public.send_admin_notification(uuid,text,text,text) to authenticated;
