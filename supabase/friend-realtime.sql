-- Private ephemeral typing and read indicators for existing friend rooms.
-- Message contents continue to use friend_messages with its existing RLS.
create or replace function private.friend_room_access(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_topic is null or p_topic !~ '^friend-room-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_id:=substring(p_topic from 13)::uuid;
  return private.active_link(v_id) or private.group_member(v_id);
end $$;
revoke all on function private.friend_room_access(text) from public,anon;
grant execute on function private.friend_room_access(text) to authenticated;

drop policy if exists friend_room_receive on realtime.messages;
create policy friend_room_receive on realtime.messages for select to authenticated
using (extension='broadcast' and private.friend_room_access(realtime.topic()));
drop policy if exists friend_room_send on realtime.messages;
create policy friend_room_send on realtime.messages for insert to authenticated
with check (extension='broadcast' and private.friend_room_access(realtime.topic()));
