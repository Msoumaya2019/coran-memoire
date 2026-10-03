const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('problem reports: private screenshots, own submissions, admin resolution and idempotent retry',async()=>{
 const db=new PGlite(),alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002',id='11111111-1111-4111-8111-111111111111';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function private.is_app_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true)='true',false)$$;grant usage on schema auth,private,storage to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
 const sql=fs.readFileSync('supabase/problem-reports.sql','utf8');await db.exec(sql);await db.exec(sql);
 assert.equal((await db.query("select public from storage.buckets where id='problem-report-screenshots'")).rows[0].public,false);
 const user=async(uid,admin=false)=>db.query("select set_config('test.uid',$1,false),set_config('test.admin',$2,false)",[uid,String(admin)]);
 await user(alice);await db.exec('set role authenticated');
 const insert="insert into app_problem_reports(id,user_id,type,description,screenshot_path,app_version,platform) values($1,$2,'Bug',$3,$4,'0.9.38','ios') on conflict(id) do nothing";
 await db.query(insert,[id,alice,'Une description',`${alice}/${id}.jpg`]);await db.query(insert,[id,alice,'Une description',`${alice}/${id}.jpg`]);assert.equal((await db.query('select count(*)::integer as n from app_problem_reports')).rows[0].n,1);
 await assert.rejects(db.query(insert,['22222222-2222-4222-8222-222222222222',bob,'Test',null]),/row-level security/);
 await assert.rejects(db.query(insert,['22222222-2222-4222-8222-222222222222',alice,'x'.repeat(501),null]),/check constraint/);
 await assert.rejects(db.query(insert,['22222222-2222-4222-8222-222222222222',alice,'Test',`${bob}/${id}.jpg`]),/check constraint/);
 await db.query("insert into storage.objects values('problem-report-screenshots',$1)",[`${alice}/${id}.jpg`]);
 await assert.rejects(db.query("insert into storage.objects values('problem-report-screenshots',$1)",[`${bob}/${id}.jpg`]),/row-level security/);
 await db.query("update app_problem_reports set status='resolved' where id=$1",[id]);assert.equal((await db.query('select status from app_problem_reports')).rows[0].status,'open');
 await user(bob);assert.equal((await db.query('select * from app_problem_reports')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await user(bob,true);assert.equal((await db.query('select * from app_problem_reports')).rows.length,1);assert.equal((await db.query('select * from storage.objects')).rows.length,1);await db.query("update app_problem_reports set status='resolved' where id=$1",[id]);assert.equal((await db.query('select status from app_problem_reports')).rows[0].status,'resolved');
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from app_problem_reports'),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
