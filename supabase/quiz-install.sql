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

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Quiz PostgreSQL: rights, one daily answer, frozen shared questions, hidden corrections, scores and expiry',async()=>{
 const db=new PGlite();const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000003';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function private.is_app_admin() returns boolean language sql as $$select current_setting('test.admin',true)='true'$$;create table notification_preferences(user_id uuid primary key,messages_enabled boolean default true);create table public.friend_profiles(id uuid primary key,display_name text,avatar_path text);create table public.friend_links(requester_id uuid,recipient_id uuid,status text);insert into auth.users values('${a}'),('${b}'),('${outsider}');insert into friend_profiles values('${a}','Mohamed',null),('${b}','Yassine',null);insert into friend_links values('${a}','${b}','accepted');`);
 const migration=fs.readFileSync('supabase/quiz.sql','utf8');await db.exec(migration);await db.exec(migration);
 await db.exec(`create table push_devices(user_id uuid,expo_push_token text);create table push_log(body jsonb);create function private.send_expo_push(url text,body jsonb,headers jsonb,timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$begin insert into public.push_log values(body);return 1;end$$;create schema cron;create table cron.job(jobname text);create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1);return 1;end$$;insert into push_devices values('${a}','ExpoPushToken[a]'),('${b}','ExpoPushToken[b]');`);
 const notifications=fs.readFileSync('supabase/quiz-notifications.sql','utf8').replace('create extension if not exists pg_cron;','');await db.exec(notifications);await db.exec(notifications);
 const asUser=async(id,admin=false)=>{await db.query("select set_config('test.uid',$1,false),set_config('test.admin',$2,false)",[id,String(admin)]);};
 await asUser(a,true);const day=(await db.query('select current_date::text as day')).rows[0].day,at=new Date().toISOString();let dailyId;
 for(let i=0;i<10;i++){const q={category:'Coran',question:'Question de test '+i,answers:['A','B','C'].map(id=>({id,text:id})),correctAnswerId:'B',explanation:'Explication de test',sourceTitle:'Source de test',publicationDate:day,isDailyQuestion:i===0,availableForChallenges:true,isActive:true};const r=await db.query('select quiz_admin_save($1::jsonb) as id',[JSON.stringify(q)]);if(i===0)dailyId=r.rows[0].id;}
 const questionIds=(await db.query('select id from quiz_questions order by created_at,id')).rows.map(q=>q.id);
 const setDraft={title:'Coran — quiz thématique',category:'Coran',questionIds,isActive:true};
 await assert.rejects(db.query('select quiz_admin_save_set($1::jsonb)',[JSON.stringify({...setDraft,questionIds:questionIds.slice(0,9)})]),/exactement 10/);
 await assert.rejects(db.query('select quiz_admin_save_set($1::jsonb)',[JSON.stringify({...setDraft,questionIds:Array(10).fill(questionIds[0])})]),/exactement 10/);
 const setId=(await db.query('select quiz_admin_save_set($1::jsonb) as id',[JSON.stringify(setDraft)])).rows[0].id;
 assert.equal((await db.query('select quiz_admin_sets() as s')).rows[0].s[0].title,setDraft.title);
 await assert.rejects(db.query('select quiz_admin_save($1::jsonb)',[JSON.stringify({category:'Coran',question:'Deuxième quotidienne',answers:['A','B','C'].map(id=>({id,text:id})),correctAnswerId:'A',sourceTitle:'Test',publicationDate:day,isDailyQuestion:true})]),/duplicate/);
 await asUser(a);const snapshot=async()=> (await db.query('select quiz_snapshot($1) as s',[day])).rows[0].s;
 let s=await snapshot();assert.equal(s.daily.correctAnswerId,undefined);assert.equal(s.daily.explanation,undefined);
 await assert.rejects(db.query('select quiz_admin_list()'),/administrateur/);await assert.rejects(db.query('select quiz_admin_sets()'),/administrateur/);assert.equal(s.quizSets[0].title,setDraft.title);assert.equal(s.quizSets[0].questionIds,undefined);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from quiz_questions'),/permission denied/);await db.exec('reset role');
 await db.query('select quiz_answer_daily($1,$2,$3,$4)',[dailyId,'A',day,at]);await db.query('select quiz_answer_daily($1,$2,$3,$4)',[dailyId,'B',day,at]);s=await snapshot();assert.equal(s.responses.length,1);assert.equal(s.responses[0].selectedAnswerId,'A');assert.equal(s.responses[0].isCorrect,false);assert.equal(s.responses[0].question.correctAnswerId,'B');
 const cid=(await db.query('select quiz_create_challenge($1,10,$2) as id',[b,setId])).rows[0].id;let c=(await snapshot()).challenges[0],ids=c.questions.map(q=>q.id);assert.equal(ids.length,10);assert.deepEqual(ids,questionIds);assert.equal(new Set(ids).size,10);assert.equal(Math.round((Date.parse(c.expiresAt)-Date.parse(c.createdAt))/3600000),48);
 await asUser(b);assert.deepEqual((await snapshot()).challenges[0].questions.map(q=>q.id),ids);
 await asUser(outsider);assert.equal((await snapshot()).challenges.length,0);await assert.rejects(db.query('select quiz_answer_challenge($1,$2,$3)',[cid,ids[0],'B']),/inaccessible/);await assert.rejects(db.query('select quiz_create_challenge($1,5)',[a]),/ami/);
 await asUser(a);for(const id of ids)await db.query('select quiz_answer_challenge($1,$2,$3)',[cid,id,'B']);c=(await snapshot()).challenges[0];assert.equal(c.status,'pending');assert.equal(c.answers[0].isCorrect,undefined);assert.equal(c.questions[0].explanation,undefined);await db.query('select quiz_answer_challenge($1,$2,$3)',[cid,ids[0],'A']);assert.equal((await snapshot()).challenges[0].answers.length,10);
 await asUser(b);for(const id of ids)await db.query('select quiz_answer_challenge($1,$2,$3)',[cid,id,'A']);c=(await snapshot()).challenges[0];assert.equal(c.status,'completed');assert.equal(c.answers.filter(x=>x.userId===a&&x.isCorrect).length,10);assert.equal(c.answers.filter(x=>x.userId===b&&x.isCorrect).length,0);assert.equal(c.questions[0].explanation,'Explication de test');assert.ok(c.completedAt);
 const small=(await db.query('select quiz_create_challenge($1,5) as id',[a])).rows[0].id;await db.query("update quiz_challenges set expires_at=now()-interval '1 second' where id=$1",[small]);c=(await snapshot()).challenges.find(x=>x.id===small);assert.equal(c.status,'expired');await assert.rejects(db.query('select quiz_answer_challenge($1,$2,$3)',[small,c.questions[0].id,'B']),/expiré/);
 assert.equal((await db.query("select count(*)::integer as n from push_log where body->>'title' like '%te défie%'")).rows[0].n,2);
 assert.equal((await db.query("select count(*)::integer as n from push_log where body->>'title'='Résultat disponible 🏆'")).rows[0].n,2);
 assert.equal((await db.query("select count(*)::integer as n from push_log where body->>'title' like '%a terminé son quiz%'")).rows[0].n,1);
 await asUser(a);await db.query('select quiz_set_notifications(false,$1)',['Europe/Paris']);await db.query("select private.quiz_push($1,'disabled','Test','Test','{}')",[a]);assert.equal((await db.query("select count(*)::integer as n from push_log where body->>'title'='Test'")).rows[0].n,0);
 await db.query('select private.quiz_notify_daily()');await db.query('select private.quiz_notify_daily()');
 await asUser(a,true);await db.query('select quiz_admin_delete($1)',[dailyId]);await asUser(a);assert.equal((await snapshot()).responses[0].question.question,'Question de test 0');assert.equal((await snapshot()).challenges.find(x=>x.id===cid).questions.length,10);
 }finally{await db.close();}
});
