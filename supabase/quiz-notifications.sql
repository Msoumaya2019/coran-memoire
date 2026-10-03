-- Après quiz.sql et push-delivery-monitor.sql. Réutilise les appareils Expo et préférences existants.
begin;
alter table public.notification_preferences add column if not exists quiz_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists quiz_timezone text not null default 'Europe/Paris';
create table if not exists private.quiz_notification_events(user_id uuid not null,event_key text not null,created_at timestamptz not null default now(),primary key(user_id,event_key));
revoke all on private.quiz_notification_events from public,anon,authenticated;
create or replace function private.quiz_push(p_user uuid,p_event text,p_title text,p_body text,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare device record;
begin
 if exists(select 1 from public.notification_preferences where user_id=p_user and not quiz_enabled) then return;end if;
 insert into private.quiz_notification_events(user_id,event_key) values(p_user,p_event) on conflict do nothing;
 if not found then return;end if;
 for device in select expo_push_token from public.push_devices where user_id=p_user loop
 perform private.send_expo_push(url:='https://exp.host/--/api/v2/push/send',body:=jsonb_build_object('to',device.expo_push_token,'title',p_title,'body',p_body,'data',p_data,'sound','default','channelId','messages','priority','high'),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=5000);
 end loop;
 exception when others then raise warning 'Quiz notification pending: %',SQLERRM;
end;$$;
create or replace function private.quiz_challenge_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.quiz_challenges;recipient uuid;name text;total integer;
begin
 if TG_TABLE_NAME='quiz_challenges' then
 if TG_OP='INSERT' then select display_name into name from public.friend_profiles where id=new.creator_user_id;
 perform private.quiz_push(new.opponent_user_id,'invite:'||new.id,coalesce(name,'Un ami')||' te défie 🏆',new.question_count||' questions t’attendent. À toi de jouer !',jsonb_build_object('kind','quiz-challenge','challengeId',new.id));
 elsif new.status='completed' and old.status<>'completed' then
 perform private.quiz_push(new.creator_user_id,'result:'||new.id,'Résultat disponible 🏆','Votre défi est terminé.',jsonb_build_object('kind','quiz-result','challengeId',new.id));
 perform private.quiz_push(new.opponent_user_id,'result:'||new.id,'Résultat disponible 🏆','Votre défi est terminé.',jsonb_build_object('kind','quiz-result','challengeId',new.id));end if;
 else
 select * into c from public.quiz_challenges where id=new.challenge_id;
 select count(*) into total from public.quiz_challenge_answers where challenge_id=c.id;
 if total<c.question_count*2 and (select count(*) from public.quiz_challenge_answers where challenge_id=c.id and user_id=new.user_id)=c.question_count then
 recipient=case when new.user_id=c.creator_user_id then c.opponent_user_id else c.creator_user_id end;
 select display_name into name from public.friend_profiles where id=new.user_id;
 perform private.quiz_push(recipient,'finished:'||c.id||':'||new.user_id,coalesce(name,'Ton ami')||' a terminé son quiz 👀','À toi de jouer !',jsonb_build_object('kind','quiz-challenge','challengeId',c.id));end if;
 end if;return new;
end;$$;
drop trigger if exists quiz_challenge_push on public.quiz_challenges;
create trigger quiz_challenge_push after insert or update of status on public.quiz_challenges for each row execute function private.quiz_challenge_notification();
drop trigger if exists quiz_answer_push on public.quiz_challenge_answers;
create trigger quiz_answer_push after insert on public.quiz_challenge_answers for each row execute function private.quiz_challenge_notification();
create or replace function public.quiz_set_notifications(p_enabled boolean,p_timezone text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Préférence invalide';end if;
 insert into public.notification_preferences(user_id,quiz_enabled,quiz_timezone) values(auth.uid(),p_enabled,p_timezone) on conflict(user_id) do update set quiz_enabled=excluded.quiz_enabled,quiz_timezone=excluded.quiz_timezone;
end;$$;
create or replace function private.quiz_notify_daily() returns void language plpgsql security definer set search_path='' as $$
declare person record;v_day date;
begin
 for person in select distinct d.user_id,coalesce(p.quiz_timezone,'Europe/Paris') as tz from public.push_devices d left join public.notification_preferences p on p.user_id=d.user_id where coalesce(p.quiz_enabled,true) loop
 v_day=(now() at time zone person.tz)::date;
 if extract(hour from now() at time zone person.tz) between 9 and 21 and exists(select 1 from public.quiz_questions where is_active and is_daily_question and publication_date=v_day) and not exists(select 1 from public.quiz_daily_responses where user_id=person.user_id and quiz_daily_responses.day=v_day) then
 perform private.quiz_push(person.user_id,'daily:'||v_day,'Question du jour disponible 📖','Teste tes connaissances aujourd’hui.',jsonb_build_object('kind','quiz-daily'));
 end if;end loop;
end;$$;
revoke all on function private.quiz_push(uuid,text,text,text,jsonb),private.quiz_challenge_notification(),private.quiz_notify_daily() from public,anon,authenticated;
revoke all on function public.quiz_set_notifications(boolean,text) from public,anon;
grant execute on function public.quiz_set_notifications(boolean,text) to authenticated;
-- Planification additive : aucune remise à zéro ni suppression d’historique.
create extension if not exists pg_cron;
select cron.schedule('quiz-daily-notification','0 * * * *','select private.quiz_notify_daily()') where not exists(select 1 from cron.job where jobname='quiz-daily-notification');
commit;
