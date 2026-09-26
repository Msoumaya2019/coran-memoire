-- Keep both the installation and Expo token unique while allowing account changes
-- and token rotation on the same physical installation. Existing rows are retained.
create or replace function public.register_push_device(
  p_installation_id text,
  p_expo_push_token text,
  p_platform text
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_updated timestamptz;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if char_length(p_installation_id) not between 16 and 100 then raise exception 'Identifiant appareil invalide'; end if;
  if p_platform not in ('ios','android') then raise exception 'Plateforme invalide'; end if;
  if not (p_expo_push_token like 'ExpoPushToken[%]' or p_expo_push_token like 'ExponentPushToken[%]')
    then raise exception 'Jeton Expo invalide'; end if;

  -- Only one active token can represent a particular local installation.
  delete from public.push_devices
    where installation_id=p_installation_id and expo_push_token<>p_expo_push_token;

  -- The token may already belong to a previous installation ID or account.
  insert into public.push_devices(installation_id,expo_push_token,user_id,platform,active_link_id,last_active_at,updated_at)
    values(p_installation_id,p_expo_push_token,v_user,p_platform,null,null,now())
    on conflict (expo_push_token) do update set
      installation_id=excluded.installation_id,
      user_id=excluded.user_id,
      platform=excluded.platform,
      active_link_id=null,
      last_active_at=null,
      updated_at=excluded.updated_at
    returning updated_at into v_updated;
  return v_updated;
end $$;
revoke all on function public.register_push_device(text,text,text) from public,anon;
grant execute on function public.register_push_device(text,text,text) to authenticated;
