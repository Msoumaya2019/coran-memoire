-- Only administrators can read this minimal learning snapshot. Existing RLS stays unchanged.
create or replace function public.admin_learning_accounts(p_offset integer default 0,p_search text default '')
returns table(user_id uuid,email text,first_name text,created_at timestamptz,synced_at timestamptz,knowledge jsonb,goal jsonb,pace text,total_accounts bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_app_admin() then raise exception 'Accès administrateur refusé'; end if;
  return query
    select u.id,u.email::text,
      coalesce(nullif(s.data#>>'{profile,firstName}',''),nullif(p.display_name,''),'Compte sans prénom'),
      u.created_at,s.updated_at,s.data->'knowledge',s.data->'goal',s.data->>'pace',count(*) over()
    from auth.users u
    left join public.user_state s on s.user_id=u.id
    left join public.friend_profiles p on p.id=u.id
    where coalesce(u.email,'') ilike '%'||left(coalesce(p_search,''),100)||'%'
       or coalesce(s.data#>>'{profile,firstName}',p.display_name,'') ilike '%'||left(coalesce(p_search,''),100)||'%'
    order by u.created_at desc,u.id
    limit 30 offset greatest(0,coalesce(p_offset,0));
end $$;
revoke all on function public.admin_learning_accounts(integer,text) from public,anon;
grant execute on function public.admin_learning_accounts(integer,text) to authenticated;
