const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,modules={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,console,...extra,require:name=>{if(!(name in modules))throw Error(name);return modules[name];}});return exports;}
const core=load('src/core/roqya.ts');
const row={id:'roqya',title:'Roqya',category:'complete',enabled:true,sort_order:0,roqya_audios:[{id:'audio',reciter_id:'reciter',enabled:true,storage_path:'reciter/roqya.mp3',duration_seconds:120,roqya_reciters:{id:'reciter',name:'Récitateur',enabled:true}}]};
test('le catalogue exclut les roqyas, audios et récitateurs désactivés et les adresses dangereuses',()=>{
 assert.equal(core.normalizeRoqyaCatalog([row]).length,1);
 for(const change of [{...row,enabled:false},{...row,roqya_audios:[{...row.roqya_audios[0],enabled:false}]},{...row,roqya_audios:[{...row.roqya_audios[0],roqya_reciters:{id:'reciter',enabled:false}}]}])assert.equal(core.normalizeRoqyaCatalog([change]).length,0);
 assert.equal(core.safeMediaUrl('javascript:alert(1)'),undefined);assert.equal(core.safeMediaUrl('https://user:password@example.com/a.mp3'),undefined);
 assert.equal(core.safeMediaUrl('https://example.com/a.mp3'),'https://example.com/a.mp3');
});
test('les différentes versions audio gardent leur propre reprise, la fin repart au début',()=>{
 const r=core.normalizeRoqyaCatalog([{...row,roqya_audios:[row.roqya_audios[0],{...row.roqya_audios[0],id:'audio2'}]}])[0];
 assert.equal(core.selectedRoqyaAudio(r,{selected:{roqya:'audio2'}}).id,'audio2');
 assert.equal(core.resumeRoqyaPosition(1122,2530),1122);assert.equal(core.resumeRoqyaPosition(2530,2530),0);assert.equal(core.resumeRoqyaPosition(NaN,2530),0);
});
test('le SQL Roqya protège les relations et interdit les écritures des utilisateurs',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public,storage to anon,authenticated;grant select on storage.objects to anon,authenticated;`);
 const sql=fs.readFileSync('supabase/roqya.sql','utf8');await db.exec(sql);await db.exec(sql);
 const reciter=(await db.query("insert into roqya_reciters(name) values('Test') returning id")).rows[0].id;
 const roqya=(await db.query("insert into roqyas(title) values('Roqya') returning id")).rows[0].id;
 await db.query("insert into roqya_audios(roqya_id,reciter_id,storage_path) values($1,$2,'test/roqya.mp3')",[roqya,reciter]);
 await db.exec("insert into storage.objects(bucket_id,name) values('roqya-audio','test/roqya.mp3'),('roqya-audio','unlisted.mp3')");
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);assert.equal((await db.query('select * from roqya_audios')).rows.length,1);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await assert.rejects(()=>db.exec("insert into roqyas(title) values('Forbidden')"));await assert.rejects(()=>db.exec("update roqya_reciters set name='Forbidden'"));await assert.rejects(()=>db.exec('delete from roqya_audios'));await db.exec('reset role');
 }
 await db.query('update roqya_reciters set enabled=false where id=$1',[reciter]);await db.exec('set role authenticated');
 assert.equal((await db.query('select * from roqya_audios')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);await db.exec('reset role');
 await assert.rejects(()=>db.query('delete from roqyas where id=$1',[roqya]));await assert.rejects(()=>db.query('insert into roqya_audios(roqya_id,reciter_id) values($1,$2)',[roqya,reciter]));await db.close();
});

function hook(){
 const slots=[],effects=[],players=[],saved=[],timers=[];let cursor=0;
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect(fn,deps){const i=cursor++;if(!(i in slots)){slots[i]=deps;effects.push(fn);}}};
 const catalog=core.normalizeRoqyaCatalog([{...row,roqya_audios:[row.roqya_audios[0],{...row.roqya_audios[0],id:'audio2',reciter_id:'second',roqya_reciters:{id:'second',name:'Second',enabled:true}}]}]);
 const lib={favorites:[],selected:{},listens:{audio:{audioId:'audio',position:42,duration:120,listenedAt:'2026-10-01'}}};let resolves={};
 const service={cachedRoqyas:()=>catalog,loadRoqyaLibrary:()=>lib,saveRoqyaLibrary:value=>saved.push(JSON.parse(JSON.stringify(value))),fetchRoqyas:async()=>catalog,observeRoqyaDownloads:()=>()=>{},roqyaPlaybackUrl:audio=>new Promise(resolve=>resolves[audio.id]=resolve),roqyaError:e=>String(e),downloadRoqya:async()=>{},deleteRoqyaDownload:()=>{}};
 const create=()=>{let listener;const p={isLoaded:false,playing:false,currentTime:0,duration:120,seek:[],plays:0,replace(source){p.uri=source?.uri;p.isLoaded=false;},play(){p.playing=true;p.plays++;},pause(){p.playing=false;},setSleepTimer(){},setPlaybackRate(){},clearLockScreenControls(){},setActiveForLockScreen(){},release(){p.released=true;},seekTo:async value=>{p.currentTime=value;p.seek.push(value);},addListener(_,fn){listener=fn;return {remove(){listener=null;}};},emit(status){p.isLoaded=status.isLoaded;p.playing=status.playing??false;listener?.({duration:120,currentTime:0,playing:false,...status});}};players.push(p);return p;};
 const mod=load('src/services/useRoqya.ts',{'react':React,'react-native':{AppState:{addEventListener:()=>({remove(){}})},Image:{resolveAssetSource:()=>({uri:'file:///cover.png'})}},'expo-audio':{setAudioModeAsync:async()=>{}},'./audioFocus':{createManagedAudioPlayer:create},'./roqya':service,'../core/roqya':core,'../../assets/roqya/lantern.png':1,'../../assets/roqya/sleep.png':2},{setInterval:fn=>{timers.push(fn);return fn;},clearInterval(){},setTimeout:fn=>fn,clearTimeout(){}});
 const render=()=>{cursor=0;return mod.useRoqya('user');};const result=render(),cleanups=effects.map(fn=>fn());return {result,render,catalog,players,saved,resolves,cleanups,timers};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('la reprise attend le chargement natif et choisir un autre récitateur annule une ancienne requête',async()=>{
 const h=hook(),r=h.catalog[0],p=h.players[0];
 const first=h.result.select(r,r.audios[0],true),second=h.result.select(r,r.audios[1],true);
 h.resolves.audio2('https://example.com/second.mp3');await second;h.resolves.audio('https://example.com/first.mp3');await first;
 assert.equal(p.uri,'https://example.com/second.mp3');p.emit({isLoaded:true});await flush();assert.deepEqual(p.seek,[0]);assert.equal(p.plays,1);
 const resume=h.render().select(r,r.audios[0],true);h.resolves.audio('file:///saved.mp3');await resume;p.emit({isLoaded:true});await flush();assert.equal(p.seek.at(-1),42);
});
test('la fin, la minuterie et la fermeture conservent la position et arrêtent le lecteur',async()=>{
 const h=hook(),r=h.catalog[0],p=h.players[0];const start=h.result.select(r,r.audios[0],true);h.resolves.audio('file:///saved.mp3');await start;p.emit({isLoaded:true});await flush();
 p.emit({isLoaded:true,playing:true,currentTime:67});h.render().setTimer(0);h.timers.forEach(fn=>fn());assert.equal(p.playing,false);assert.equal(h.saved.at(-1).listens.audio.position,67);
 h.render().close();assert.equal(h.render().current,null);
 h.cleanups.forEach(fn=>typeof fn==='function'&&fn());await flush();assert.equal(p.released,true);
});
