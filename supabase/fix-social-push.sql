-- An empty active_link_id means the recipient is not viewing a conversation.
-- SQL's NULL logic previously excluded that device from the push loop.
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
revoke all on function private.notify_private_message() from public,anon,authenticated;
