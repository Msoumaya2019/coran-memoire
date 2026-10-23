-- Additive tracking; existing accounts, progress and admin RPC are unchanged.
begin;
create table if not exists public.app_usage_sessions (
 id text primary key,user_id uuid not null references auth.users(id),
 started_at timestamptz not null,seconds integer not null check(seconds>=0),
 ended boolean not null default false,updated_at timestamptz not null default now()
);
create index if not exists app_usage_user_latest on public.app_usage_sessions(user_id,started_at desc);
alter table public.app_usage_sessions enable row level security;
revoke all on public.app_usage_sessions from anon,authenticated;
create or replace function public.record_app_usage(p_id text,p_started_at timestamptz,p_seconds integer,p_ended boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 if length(p_id)>100 or length(p_id)<1 or p_seconds<0 or p_seconds>604800 or p_started_at>now()+interval '5 minutes' or p_seconds>extract(epoch from(now()-p_started_at))+300 then raise exception 'Session invalide';end if;
 if exists(select 1 from public.app_usage_sessions where id=p_id and user_id<>auth.uid()) then raise exception 'Session interdite';end if;
 insert into public.app_usage_sessions(id,user_id,started_at,seconds,ended) values(p_id,auth.uid(),p_started_at,p_seconds,p_ended)
 on conflict(id) do update set seconds=greatest(app_usage_sessions.seconds,excluded.seconds),ended=app_usage_sessions.ended or excluded.ended,updated_at=now() where app_usage_sessions.user_id=auth.uid();
end $$;
create or replace function public.admin_last_app_usage(p_users uuid[]) returns table(user_id uuid,started_at timestamptz,seconds integer,ended boolean,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;
 if cardinality(p_users)>200 then raise exception 'Trop de comptes';end if;
 return query select distinct on(s.user_id) s.user_id,s.started_at,s.seconds,s.ended,s.updated_at from public.app_usage_sessions s where s.user_id=any(p_users) order by s.user_id,s.started_at desc,s.updated_at desc;
end $$;
revoke all on function public.record_app_usage(text,timestamptz,integer,boolean),public.admin_last_app_usage(uuid[]) from public,anon;
grant execute on function public.record_app_usage(text,timestamptz,integer,boolean),public.admin_last_app_usage(uuid[]) to authenticated;
commit;
