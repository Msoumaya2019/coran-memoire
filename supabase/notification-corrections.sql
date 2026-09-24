-- Apply after social.sql, notifications.sql, social-v2.sql and recitations.sql.
-- Additive: existing accounts, recordings and notification choices are preserved.
create extension if not exists pg_net with schema extensions;

alter table public.notification_preferences
  add column if not exists corrections_enabled boolean not null default true;
alter table public.recitations
  add column if not exists correction_revision integer not null default 0,
  add column if not exists corrected_at timestamptz,
  add column if not exists last_correction_request_id text;

create or replace function private.notify_recitation_corrected() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_device record;
begin
  if new.correction_revision <= old.correction_revision then return new; end if;
  if exists(select 1 from public.notification_preferences p
    where p.user_id=new.user_id and not p.corrections_enabled) then return new; end if;
  for v_device in select d.expo_push_token from public.push_devices d where d.user_id=new.user_id loop
    perform net.http_post(
      url:='https://exp.host/--/api/v2/push/send',
      body:=jsonb_build_object(
        'to',v_device.expo_push_token,
        'title','Ta récitation a été corrigée',
        'body','Le professeur a ajouté ses observations. Ouvre Mes récitations pour les consulter.',
        'data',jsonb_build_object('kind','recitation-corrected','recitationId',new.id,'revision',new.correction_revision),
        'sound','default','priority','high','channelId','corrections'),
      headers:='{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds:=5000
    );
  end loop;
  return new;
end $$;
revoke all on function private.notify_recitation_corrected() from public,anon,authenticated;
drop trigger if exists notify_recitation_corrected on public.recitations;
create trigger notify_recitation_corrected after update of correction_revision on public.recitations
  for each row when (new.correction_revision > old.correction_revision)
  execute function private.notify_recitation_corrected();

create or replace function public.finalize_recitation_correction(
  p_recitation_id text,
  p_request_id text,
  p_verses jsonb,
  p_general_comment text,
  p_voice_path text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_rec public.recitations%rowtype; v_item jsonb; v_verse integer; v_comment text; v_revision integer;
begin
  if auth.uid() is null or not private.is_app_admin() then raise exception 'Accès administrateur refusé'; end if;
  if p_request_id is null or length(p_request_id) not between 12 and 100 then raise exception 'Identifiant de correction invalide'; end if;
  if p_verses is null or jsonb_typeof(p_verses)<>'array' or jsonb_array_length(p_verses)>6236 then raise exception 'Liste des versets invalide'; end if;
  select * into v_rec from public.recitations where id=p_recitation_id for update;
  if not found then raise exception 'Récitation introuvable'; end if;
  if v_rec.last_correction_request_id=p_request_id then return v_rec.correction_revision; end if;
  if jsonb_array_length(p_verses)=0 and nullif(btrim(coalesce(p_general_comment,'')),'') is null and p_voice_path is null
    then raise exception 'Correction vide'; end if;
  if p_voice_path is not null and (
    p_voice_path not like 'feedback/'||auth.uid()::text||'/%'
    or not exists(select 1 from storage.objects where bucket_id='recitations' and name=p_voice_path)
  ) then raise exception 'Correction vocale introuvable'; end if;

  for v_item in select value from jsonb_array_elements(p_verses) loop
    if jsonb_typeof(v_item)<>'object' or (v_item->>'verseId') !~ '^[0-9]+$' then raise exception 'Verset invalide'; end if;
    v_verse:=(v_item->>'verseId')::integer;
    if v_verse not between v_rec.start_verse_id and v_rec.end_verse_id then raise exception 'Verset hors de la récitation'; end if;
    v_comment:=nullif(btrim(left(coalesce(v_item->>'comment',''),2000)),'');
    insert into public.recitation_corrections(recitation_id,admin_id,verse_id,comment,voice_path)
      values(v_rec.id,auth.uid(),v_verse,coalesce(v_comment,'À retravailler'),p_voice_path);
  end loop;
  if nullif(btrim(coalesce(p_general_comment,'')),'') is not null or p_voice_path is not null then
    insert into public.recitation_feedback(recitation_id,admin_id,comment,voice_path)
      values(v_rec.id,auth.uid(),nullif(btrim(left(coalesce(p_general_comment,''),4000)),''),p_voice_path);
  end if;
  update public.recitations set correction_revision=correction_revision+1,corrected_at=now(),last_correction_request_id=p_request_id
    where id=v_rec.id returning correction_revision into v_revision;
  return v_revision;
end $$;
revoke all on function public.finalize_recitation_correction(text,text,jsonb,text,text) from public,anon;
grant execute on function public.finalize_recitation_correction(text,text,jsonb,text,text) to authenticated;
