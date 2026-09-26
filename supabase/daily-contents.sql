create table if not exists public.content_categories (
 id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 1 and 100),icon text not null default '☾',type text not null check(type in ('reminder','invocation')),display_order integer not null default 0,is_active boolean not null default true,created_at timestamptz not null default now(),unique(id,type)
);
create table if not exists public.daily_contents (
 id uuid primary key default gen_random_uuid(),type text not null check(type in ('reminder','invocation')),title text,arabic_text text,phonetic_text text,french_text text not null check(length(btrim(french_text))>0),explanation text,source text not null check(length(btrim(source))>0),reference text,category_id uuid not null,audio_url text,image_url text,is_active boolean not null default true,created_by uuid references auth.users(id) default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,type),foreign key(category_id,type) references public.content_categories(id,type),check(type='reminder' or (length(btrim(arabic_text))>0 and length(btrim(phonetic_text))>0 and arabic_text is not null and phonetic_text is not null)),check(audio_url is null or audio_url like 'https://%'),check(image_url is null or image_url like 'https://%')
);
create table if not exists public.daily_content_schedule (
 id uuid primary key default gen_random_uuid(),content_id uuid not null,type text not null,display_date date not null,created_at timestamptz not null default now(),unique(display_date,type),foreign key(content_id,type) references public.daily_contents(id,type) on delete cascade
);
create table if not exists public.content_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,content_id uuid not null references public.daily_contents(id) on delete cascade,created_at timestamptz not null default now(),primary key(user_id,content_id)
);
create index if not exists daily_contents_category_active on public.daily_contents(type,category_id,created_at desc) where is_active;
alter table public.content_categories enable row level security;
alter table public.daily_contents enable row level security;
alter table public.daily_content_schedule enable row level security;
alter table public.content_favorites enable row level security;
drop policy if exists categories_read on public.content_categories;
create policy categories_read on public.content_categories for select to authenticated using(is_active or private.is_app_admin());
drop policy if exists categories_read_public on public.content_categories;
create policy categories_read_public on public.content_categories for select to anon using(is_active);
drop policy if exists categories_admin on public.content_categories;
create policy categories_admin on public.content_categories for all to authenticated using(private.is_app_admin()) with check(private.is_app_admin());
drop policy if exists contents_read on public.daily_contents;
create policy contents_read on public.daily_contents for select to authenticated using(private.is_app_admin() or (is_active and exists(select 1 from public.content_categories c where c.id=category_id and c.is_active)));
drop policy if exists contents_read_public on public.daily_contents;
create policy contents_read_public on public.daily_contents for select to anon using(is_active and exists(select 1 from public.content_categories c where c.id=category_id and c.is_active));
drop policy if exists contents_admin on public.daily_contents;
create policy contents_admin on public.daily_contents for all to authenticated using(private.is_app_admin()) with check(private.is_app_admin());
drop policy if exists schedule_read on public.daily_content_schedule;
create policy schedule_read on public.daily_content_schedule for select to anon,authenticated using(exists(select 1 from public.daily_contents c where c.id=content_id));
drop policy if exists schedule_admin on public.daily_content_schedule;
create policy schedule_admin on public.daily_content_schedule for all to authenticated using(private.is_app_admin()) with check(private.is_app_admin());
drop policy if exists favorites_own on public.content_favorites;
create policy favorites_own on public.content_favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select on public.content_categories,public.daily_contents,public.daily_content_schedule to anon,authenticated;
grant insert,update,delete on public.content_categories,public.daily_contents,public.daily_content_schedule to authenticated;
grant select,insert,update,delete on public.content_favorites to authenticated;
create or replace function public.daily_content_for_date(p_date date) returns setof public.daily_contents language sql stable security invoker set search_path='' as $$
 select chosen.* from (values('reminder'),('invocation')) t(kind)
 cross join lateral (
 select c.* from public.daily_contents c join public.content_categories cat on cat.id=c.category_id and cat.is_active
 left join public.daily_content_schedule s on s.content_id=c.id and s.display_date=p_date and s.type=t.kind
 where c.type=t.kind and c.is_active
 order by (s.id is not null) desc,
 case when s.id is null then mod((row_number() over(partition by c.type order by c.id)-1)-(p_date-date '2020-01-01')::bigint+1000000,(select count(*) from public.daily_contents x join public.content_categories xc on xc.id=x.category_id and xc.is_active where x.type=t.kind and x.is_active)) else 0 end
 limit 1
 ) chosen;
$$;
grant execute on function public.daily_content_for_date(date) to anon,authenticated;
alter table public.recitations add column if not exists recording_type text not null default 'quran' check(recording_type in ('quran','invocation'));
alter table public.recitations add column if not exists invocation_id uuid references public.daily_contents(id) on delete set null;
alter table public.recitations add column if not exists invocation_snapshot jsonb;
alter table public.recitations alter column start_verse_id drop not null;
alter table public.recitations alter column end_verse_id drop not null;
alter table public.recitations drop constraint if exists recitations_start_verse_id_check;
alter table public.recitations drop constraint if exists recitations_end_verse_id_check;
alter table public.recitations drop constraint if exists recitations_passage_type;
alter table public.recitations add constraint recitations_passage_type check(
 (recording_type='quran' and invocation_id is null and start_verse_id between 1 and 6236 and end_verse_id between start_verse_id and 6236 and start_verse_id is not null and end_verse_id is not null)
 or (recording_type='invocation' and start_verse_id is null and end_verse_id is null and invocation_snapshot is not null)
);
create or replace function private.validate_invocation_recording() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.recording_type='invocation' and TG_OP='INSERT' then
  select to_jsonb(c)||jsonb_build_object('category_name',(select name from public.content_categories where id=c.category_id)) into new.invocation_snapshot from public.daily_contents c where c.id=new.invocation_id and c.type='invocation' and c.is_active;
  if new.invocation_snapshot is null then raise exception 'Invocation indisponible'; end if;
 end if;
 return new;
end $$;
drop trigger if exists validate_invocation_recording on public.recitations;
create trigger validate_invocation_recording before insert on public.recitations for each row execute function private.validate_invocation_recording();

create or replace function private.can_play_shared_recitation(p_recitation_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.recitations r
    join public.friend_messages m on m.recitation_id=r.id and m.kind='recitation' and m.deleted_at is null
    join public.friend_links l on l.id=m.link_id and l.status='accepted'
    where r.recording_type='quran' and r.id=p_recitation_id and m.sender_id=r.user_id
      and auth.uid() in (l.requester_id,l.recipient_id)
      and auth.uid()<>r.user_id
      and r.user_id in (l.requester_id,l.recipient_id)
  );
$$;
revoke all on function private.can_play_shared_recitation(text) from public,anon;
grant execute on function private.can_play_shared_recitation(text) to authenticated;


create or replace function public.save_daily_content(p_content jsonb,p_date date default null) returns void language plpgsql security invoker set search_path='' as $$
declare c public.daily_contents;
begin
 if not private.is_app_admin() then raise exception 'Accès administrateur refusé'; end if;
 c:=jsonb_populate_record(null::public.daily_contents,p_content);
 insert into public.daily_contents(id,type,title,arabic_text,phonetic_text,french_text,explanation,source,reference,category_id,audio_url,image_url,is_active)
 values(c.id,c.type,c.title,c.arabic_text,c.phonetic_text,c.french_text,c.explanation,c.source,c.reference,c.category_id,c.audio_url,c.image_url,c.is_active)
 on conflict(id) do update set title=excluded.title,arabic_text=excluded.arabic_text,phonetic_text=excluded.phonetic_text,french_text=excluded.french_text,explanation=excluded.explanation,source=excluded.source,reference=excluded.reference,category_id=excluded.category_id,audio_url=excluded.audio_url,image_url=excluded.image_url,is_active=excluded.is_active,updated_at=now();
 if p_date is not null then
 insert into public.daily_content_schedule(content_id,type,display_date) values(c.id,c.type,p_date)
 on conflict(display_date,type) do update set content_id=excluded.content_id;
 end if;
end $$;
revoke all on function public.save_daily_content(jsonb,date) from public,anon;
grant execute on function public.save_daily_content(jsonb,date) to authenticated;
