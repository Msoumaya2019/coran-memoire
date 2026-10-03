-- Après social.sql et notifications.sql. Migration additive, aucune donnée existante modifiée.
begin;
alter table public.notification_preferences add column if not exists quiz_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists quiz_timezone text not null default 'Europe/Paris';
create table if not exists public.quiz_questions(
 id uuid primary key default gen_random_uuid(),category text not null check(category in ('Coran','Tajwid','Prophètes','Sîra','Vocabulaire coranique','Connaissances générales')),
 is_deleted boolean not null default false,question text not null check(length(btrim(question))>0),answers jsonb not null check(jsonb_typeof(answers)='array' and jsonb_array_length(answers) between 3 and 4),correct_answer_id text not null,
 explanation text not null,source_title text not null check(length(btrim(source_title))>0),source_reference text,source_url text check(source_url is null or source_url like 'https://%'),arabic text,translation text,surah integer check(surah between 1 and 114),ayah integer check(ayah between 1 and 286),
 publication_date date,is_daily_question boolean not null default false,available_for_challenges boolean not null default true,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(not is_daily_question or publication_date is not null));
create unique index if not exists quiz_one_daily on public.quiz_questions(publication_date) where is_daily_question and is_active;
create table if not exists public.quiz_daily_responses(user_id uuid not null references auth.users(id) on delete cascade,day date not null,question_id uuid not null,answer_id text not null,is_correct boolean not null,answered_at timestamptz not null,received_at timestamptz not null default now(),question_snapshot jsonb not null,primary key(user_id,day),unique(user_id,question_id));
create table if not exists public.quiz_challenges(id uuid primary key default gen_random_uuid(),creator_user_id uuid not null references auth.users(id),opponent_user_id uuid not null references auth.users(id),question_count integer not null check(question_count in (5,10)),status text not null default 'pending' check(status in ('pending','completed','expired')),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '48 hours',completed_at timestamptz,check(creator_user_id<>opponent_user_id));
create index if not exists quiz_creator on public.quiz_challenges(creator_user_id,created_at desc);
create index if not exists quiz_opponent on public.quiz_challenges(opponent_user_id,created_at desc);
create table if not exists public.quiz_challenge_questions(challenge_id uuid not null references public.quiz_challenges(id) on delete cascade,question_id uuid not null,question_order integer not null,question_snapshot jsonb not null,primary key(challenge_id,question_id),unique(challenge_id,question_order));
create table if not exists public.quiz_challenge_answers(challenge_id uuid not null,question_id uuid not null,user_id uuid not null references auth.users(id),answer_id text not null,is_correct boolean not null,answered_at timestamptz not null default now(),primary key(challenge_id,user_id,question_id),foreign key(challenge_id,question_id) references public.quiz_challenge_questions(challenge_id,question_id));
alter table public.quiz_questions enable row level security;
alter table public.quiz_daily_responses enable row level security;
alter table public.quiz_challenges enable row level security;
alter table public.quiz_challenge_questions enable row level security;
alter table public.quiz_challenge_answers enable row level security;
revoke all on public.quiz_questions,public.quiz_daily_responses,public.quiz_challenges,public.quiz_challenge_questions,public.quiz_challenge_answers from anon,authenticated;
drop policy if exists quiz_admin on public.quiz_questions;
create policy quiz_admin on public.quiz_questions for all to authenticated using(private.is_app_admin()) with check(private.is_app_admin());
drop policy if exists quiz_daily_own on public.quiz_daily_responses;
create policy quiz_daily_own on public.quiz_daily_responses for select to authenticated using(user_id=auth.uid());
drop policy if exists quiz_challenge_member on public.quiz_challenges;
create policy quiz_challenge_member on public.quiz_challenges for select to authenticated using(auth.uid() in (creator_user_id,opponent_user_id));
drop policy if exists quiz_answer_own on public.quiz_challenge_answers;
create policy quiz_answer_own on public.quiz_challenge_answers for select to authenticated using(user_id=auth.uid());
drop policy if exists quiz_question_member on public.quiz_challenge_questions;
create policy quiz_question_member on public.quiz_challenge_questions for select to authenticated using(exists(select 1 from public.quiz_challenges c where c.id=challenge_id and auth.uid() in(c.creator_user_id,c.opponent_user_id)));
-- Pas de SELECT direct : les RPC ne transmettent ni solution ni score avant autorisation.
create or replace function private.quiz_question_json(q public.quiz_questions) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',q.id,'category',q.category,'question',q.question,'answers',q.answers,'correctAnswerId',q.correct_answer_id,'explanation',q.explanation,'sourceTitle',q.source_title,'sourceReference',q.source_reference,'sourceUrl',q.source_url,'arabic',q.arabic,'translation',q.translation,'surah',q.surah,'ayah',q.ayah,'publicationDate',q.publication_date,'isDailyQuestion',q.is_daily_question,'availableForChallenges',q.available_for_challenges,'isActive',q.is_active);
$$;
create or replace function private.quiz_public_question(q jsonb) returns jsonb language sql immutable set search_path='' as $$
 select q-'correctAnswerId'-'explanation'-'sourceTitle'-'sourceReference'-'sourceUrl'-'arabic'-'translation';
$$;
revoke all on function private.quiz_question_json(public.quiz_questions),private.quiz_public_question(jsonb) from public,anon,authenticated;

create or replace function public.quiz_answer_daily(p_question uuid,p_answer text,p_day date,p_answered_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare q public.quiz_questions;
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 if exists(select 1 from public.quiz_daily_responses where user_id=auth.uid() and day=p_day) then return;end if;
 select * into q from public.quiz_questions where id=p_question and is_daily_question and publication_date=p_day;
 -- Une question téléchargée peut être répondue hors ligne puis synchronisée plus tard.
 if not found or p_day>(now() at time zone 'Pacific/Kiritimati')::date or p_answered_at>now()+interval '5 minutes' or p_answered_at < p_day::timestamptz-interval '14 hours' or p_answered_at>p_day::timestamptz+interval '38 hours' then raise exception 'Question ou date invalide';end if;
 if not exists(select 1 from jsonb_array_elements(q.answers) a where a->>'id'=p_answer) then raise exception 'Réponse invalide';end if;
 insert into public.quiz_daily_responses(user_id,day,question_id,answer_id,is_correct,answered_at,question_snapshot) values(auth.uid(),p_day,q.id,p_answer,p_answer=q.correct_answer_id,p_answered_at,private.quiz_question_json(q)) on conflict do nothing;
end;$$;


create table if not exists public.quiz_sets(id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title))>0),category text not null,question_ids uuid[] not null check(cardinality(question_ids)=10),is_active boolean not null default true,updated_at timestamptz not null default now());
alter table public.quiz_sets enable row level security;
revoke all on public.quiz_sets from anon,authenticated;

create or replace function public.quiz_create_challenge(p_opponent uuid,p_count integer default 10,p_set uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid;pool uuid[];n integer=0;q public.quiz_questions;
begin
 if auth.uid() is null or p_count not in(5,10) or not exists(select 1 from public.friend_links l where l.status='accepted' and ((l.requester_id=auth.uid() and l.recipient_id=p_opponent) or (l.recipient_id=auth.uid() and l.requester_id=p_opponent))) then raise exception 'Choisis un ami accepté et 5 ou 10 questions';end if;
 if p_set is null then
 select array_agg(id) into pool from(select id from public.quiz_questions where is_active and available_for_challenges order by random() limit p_count) x;
 else
 if p_count<>10 then raise exception 'Un quiz thématique contient 10 questions';end if;
 select question_ids into pool from public.quiz_sets where id=p_set and is_active;
 if (select count(*) from public.quiz_questions where id=any(pool) and is_active and available_for_challenges)<>10 then raise exception 'Quiz indisponible';end if;
 end if;
 if coalesce(array_length(pool,1),0)<>p_count then raise exception 'Pas encore assez de questions disponibles pour ce défi';end if;
 insert into public.quiz_challenges(creator_user_id,opponent_user_id,question_count) values(auth.uid(),p_opponent,p_count) returning id into cid;
 for q in select * from public.quiz_questions where id=any(pool) order by array_position(pool,id) loop
 n=n+1;
 insert into public.quiz_challenge_questions values(cid,q.id,n,private.quiz_question_json(q));
 end loop;
 return cid;
end;$$;

create or replace function public.quiz_answer_challenge(p_challenge uuid,p_question uuid,p_answer text) returns void language plpgsql security definer set search_path='' as $$
declare c public.quiz_challenges;q jsonb;total integer;
begin
 select * into c from public.quiz_challenges where id=p_challenge for update;
 if not found or auth.uid() is null or auth.uid() not in(c.creator_user_id,c.opponent_user_id) then raise exception 'Défi inaccessible';end if;
 if exists(select 1 from public.quiz_challenge_answers where challenge_id=c.id and user_id=auth.uid() and question_id=p_question) then return;end if;
 if c.status<>'pending' or now()>=c.expires_at then raise exception 'Ce défi est terminé ou expiré';end if;
 select question_snapshot into q from public.quiz_challenge_questions where challenge_id=c.id and question_id=p_question;
 if q is null or not exists(select 1 from jsonb_array_elements(q->'answers') a where a->>'id'=p_answer) then raise exception 'Réponse invalide';end if;
 insert into public.quiz_challenge_answers values(c.id,p_question,auth.uid(),p_answer,p_answer=q->>'correctAnswerId',now());
 select count(*) into total from public.quiz_challenge_answers where challenge_id=c.id;
 if total=c.question_count*2 then update public.quiz_challenges set status='completed',completed_at=now() where id=c.id;end if;
end;$$;

create or replace function public.quiz_snapshot(p_day date) returns jsonb language plpgsql security definer set search_path='' as $$
declare daily jsonb;responses jsonb;challenges jsonb;
begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 select private.quiz_public_question(private.quiz_question_json(q)) into daily from public.quiz_questions q where q.is_daily_question and q.is_active and q.publication_date=p_day;
 select coalesce(jsonb_agg(jsonb_build_object('questionId',r.question_id,'day',r.day,'selectedAnswerId',r.answer_id,'isCorrect',r.is_correct,'answeredAt',r.answered_at,'question',r.question_snapshot) order by r.day desc),'[]') into responses from public.quiz_daily_responses r where user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'creatorId',c.creator_user_id,'opponentId',c.opponent_user_id,'creatorName',coalesce(a.display_name,'Ami'),'opponentName',coalesce(b.display_name,'Ami'),'creatorAvatar',a.avatar_path,'opponentAvatar',b.avatar_path,'questionCount',c.question_count,'status',case when c.status='pending' and c.expires_at<=now() then 'expired' else c.status end,'createdAt',c.created_at,'expiresAt',c.expires_at,'completedAt',c.completed_at,
 'questions',(select coalesce(jsonb_agg(case when c.status='completed' then cq.question_snapshot else private.quiz_public_question(cq.question_snapshot) end order by cq.question_order),'[]') from public.quiz_challenge_questions cq where cq.challenge_id=c.id),
 'answers',(select coalesce(jsonb_agg(jsonb_build_object('userId',ca.user_id,'questionId',ca.question_id,'selectedAnswerId',case when ca.user_id=auth.uid() or c.status='completed' then ca.answer_id else null end,'answeredAt',ca.answered_at)||case when c.status='completed' then jsonb_build_object('isCorrect',ca.is_correct) else '{}'::jsonb end),'[]') from public.quiz_challenge_answers ca where ca.challenge_id=c.id)) order by c.created_at desc),'[]') into challenges
 from public.quiz_challenges c left join public.friend_profiles a on a.id=c.creator_user_id left join public.friend_profiles b on b.id=c.opponent_user_id where auth.uid() in(c.creator_user_id,c.opponent_user_id);
 return jsonb_build_object('day',p_day,'daily',daily,'responses',responses,'challenges',challenges,'notificationsEnabled',coalesce((select quiz_enabled from public.notification_preferences where user_id=auth.uid()),true),'quizSets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'category',category) order by title),'[]') from public.quiz_sets where is_active and (select count(*) from public.quiz_questions where id=any(question_ids) and is_active and available_for_challenges)=10));
end;$$;

create or replace function public.quiz_admin_list() returns jsonb language plpgsql security definer set search_path='' as $$
begin if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;return (select coalesce(jsonb_agg(private.quiz_question_json(q) order by q.created_at desc),'[]') from public.quiz_questions q where not q.is_deleted);end;$$;
create or replace function public.quiz_admin_save(p_question jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare qid uuid=coalesce(nullif(p_question->>'id','')::uuid,gen_random_uuid());a jsonb=p_question->'answers';
begin
 if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;
 if jsonb_array_length(a) not between 3 and 4 or (select count(distinct x->>'id') from jsonb_array_elements(a) x)<>jsonb_array_length(a) or exists(select 1 from jsonb_array_elements(a) x where coalesce(length(btrim(x->>'text')),0)=0 or coalesce(length(x->>'id'),0)=0) or not exists(select 1 from jsonb_array_elements(a) x where x->>'id'=p_question->>'correctAnswerId') then raise exception 'Trois ou quatre réponses distinctes et une solution sont obligatoires';end if;
 insert into public.quiz_questions(id,category,question,answers,correct_answer_id,explanation,source_title,source_reference,source_url,arabic,translation,surah,ayah,publication_date,is_daily_question,available_for_challenges,is_active)
 values(qid,p_question->>'category',p_question->>'question',a,p_question->>'correctAnswerId',coalesce(p_question->>'explanation',''),p_question->>'sourceTitle',p_question->>'sourceReference',nullif(p_question->>'sourceUrl',''),p_question->>'arabic',p_question->>'translation',nullif(p_question->>'surah','')::integer,nullif(p_question->>'ayah','')::integer,nullif(p_question->>'publicationDate','')::date,coalesce((p_question->>'isDailyQuestion')::boolean,false),coalesce((p_question->>'availableForChallenges')::boolean,true),coalesce((p_question->>'isActive')::boolean,true))
 on conflict(id) do update set category=excluded.category,question=excluded.question,answers=excluded.answers,correct_answer_id=excluded.correct_answer_id,explanation=excluded.explanation,source_title=excluded.source_title,source_reference=excluded.source_reference,source_url=excluded.source_url,arabic=excluded.arabic,translation=excluded.translation,surah=excluded.surah,ayah=excluded.ayah,publication_date=excluded.publication_date,is_daily_question=excluded.is_daily_question,available_for_challenges=excluded.available_for_challenges,is_active=excluded.is_active,updated_at=now();return qid;
end;$$;
create or replace function public.quiz_admin_delete(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;update public.quiz_questions set is_active=false,is_deleted=true,updated_at=now() where id=p_id;end;$$;
revoke all on function public.quiz_snapshot(date),public.quiz_answer_daily(uuid,text,date,timestamptz),public.quiz_create_challenge(uuid,integer,uuid),public.quiz_answer_challenge(uuid,uuid,text),public.quiz_admin_list(),public.quiz_admin_save(jsonb),public.quiz_admin_delete(uuid) from public,anon;
grant execute on function public.quiz_snapshot(date),public.quiz_answer_daily(uuid,text,date,timestamptz),public.quiz_create_challenge(uuid,integer,uuid),public.quiz_answer_challenge(uuid,uuid,text),public.quiz_admin_list(),public.quiz_admin_save(jsonb),public.quiz_admin_delete(uuid) to authenticated;

create or replace function public.quiz_admin_sets() returns jsonb language plpgsql security definer set search_path='' as $$
begin if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;
return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'category',category,'questionIds',question_ids,'isActive',is_active) order by updated_at desc),'[]') from public.quiz_sets);end;$$;
create or replace function public.quiz_admin_save_set(p_set jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid=coalesce(nullif(p_set->>'id','')::uuid,gen_random_uuid());ids uuid[];
begin if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;
select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_set->'questionIds');
if cardinality(ids)<>10 or (select count(distinct x) from unnest(ids) x)<>10 or (select count(*) from public.quiz_questions where id=any(ids) and is_active and available_for_challenges)<>10 then raise exception 'Choisis exactement 10 questions actives disponibles pour les défis';end if;
insert into public.quiz_sets(id,title,category,question_ids,is_active) values(sid,p_set->>'title',p_set->>'category',ids,coalesce((p_set->>'isActive')::boolean,true)) on conflict(id) do update set title=excluded.title,category=excluded.category,question_ids=excluded.question_ids,is_active=excluded.is_active,updated_at=now();return sid;end;$$;
create or replace function public.quiz_admin_delete_set(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not private.is_app_admin() then raise exception 'Accès administrateur refusé';end if;delete from public.quiz_sets where id=p_id;end;$$;
revoke all on function public.quiz_admin_sets(),public.quiz_admin_save_set(jsonb),public.quiz_admin_delete_set(uuid) from public,anon;
grant execute on function public.quiz_admin_sets(),public.quiz_admin_save_set(jsonb),public.quiz_admin_delete_set(uuid) to authenticated;

commit;

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
