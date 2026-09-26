-- One authorized inbox query replaces one unread count and one presence RPC per friend.
-- The existing friend_messages_link_time index supports both lateral lookups.
create or replace function public.friend_inbox()
returns table(link_id uuid,body text,created_at timestamptz,unread_count bigint,other_id uuid,is_online boolean)
language sql stable security definer set search_path = '' as $$
  select l.id,
    case when latest.id is null then null
         when latest.deleted_at is not null then 'Message supprimé'
         else latest.body end,
    latest.created_at,
    unread.unread_count,
    p.id,
    p.share_online and coalesce(progress.online_until>now(),false)
  from public.friend_links l
  join public.friend_profiles p
    on p.id=case when l.requester_id=(select auth.uid()) then l.recipient_id else l.requester_id end
  left join public.friend_progress progress on progress.user_id=p.id
  left join public.friend_message_reads reads on reads.link_id=l.id and reads.user_id=(select auth.uid())
  left join lateral (
    select m.id,m.body,m.created_at,m.deleted_at
    from public.friend_messages m where m.link_id=l.id
    order by m.created_at desc limit 1
  ) latest on true
  cross join lateral (
    select count(*) as unread_count
    from public.friend_messages m
    where m.link_id=l.id and m.sender_id<>(select auth.uid()) and m.deleted_at is null
      and (reads.last_read_at is null or m.created_at>reads.last_read_at)
  ) unread
  where l.status='accepted' and (select auth.uid()) in (l.requester_id,l.recipient_id);
$$;
revoke all on function public.friend_inbox() from public,anon;
grant execute on function public.friend_inbox() to authenticated;
