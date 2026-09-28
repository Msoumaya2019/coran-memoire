const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const core=require('./build/core/audio.js'),quran=require('./build/core/quran.js');
function controls(mode='passage',fallbackReciter=null,repeatCount=3,options={}){
 const effects=[],changes=[],calls={replace:0,play:0,pause:0,seek:[],release:0};let listener;
 const player={currentTime:0,replace(source){calls.replace++;if(options.replace)options.replace(source);},play(){calls.play++;},pause(){calls.pause++;},seekTo(...args){calls.seek.push(args);return options.seek?options.seek():Promise.resolve();},setPlaybackRate(){},setActiveForLockScreen(){},addListener(_,fn){listener=fn;return {remove(){listener=null;}};},release(){calls.release++;}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment',useState:initial=>[initial===core.defaultReciter&&fallbackReciter?fallbackReciter:initial==='passage'?mode:initial===3?repeatCount:initial===0&&options.gap?options.gap:typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>({current:initial}),useEffect:fn=>effects.push(fn),useMemo:fn=>fn()};
 const ui=Object.fromEntries(['Button','Choice','Field','Label'].map(name=>[name,name]));ui.colors={};
 const native=Object.fromEntries(['KeyboardAvoidingView','Pressable','ScrollView','Text','View'].map(name=>[name,name]));native.Platform={OS:'ios'};native.PanResponder={create:()=>({panHandlers:{}})};native.LayoutAnimation={configureNext(){},Presets:{easeInEaseOut:{}}};
 const exports={};const code=ts.transpileModule(fs.readFileSync('src/PassageAudioPlayer.tsx','utf8')+'\nexport {PassageAudioControls};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const timeline={url:'https://example.com/chapter.mp3',verses:{5:{start:10,end:11},6:{start:11,end:12},7:{start:12,end:13},8:{start:13,end:14}}};
 const timers=new Map();
 vm.runInNewContext(code,{exports,console:options.console??console,Promise,setTimeout:(fn,delay)=>{timers.set(fn,delay);return fn;},clearTimeout:fn=>timers.delete(fn),require(name){
  return {'react':React,'react-native':native,'expo-audio':{setAudioModeAsync:()=>Promise.resolve(),preload:()=>Promise.resolve(),clearPreloadedSource(){}},'@react-native-async-storage/async-storage':{getItem:()=>Promise.resolve(null),setItem:()=>Promise.resolve()},'./services/audioFocus':{createManagedAudioPlayer:()=>player},'./services/quranAudioTimeline':{chapterAudio:()=>Promise.resolve(options.timeline?timeline:null)},'./core/audio':core,'./core/quran':quran,'./ui/theme':ui,'./ui/Premium':{Icon:'Icon'}}[name]??(()=>{throw Error(name)})();}});
 const tree=exports.PassageAudioControls({sessionRange:options.range??(fallbackReciter?{start:1,end:7}:{start:5,end:8}),page:1,dock:'expanded',setDock(){},onVerseChange:id=>changes.push(id)});
 const cleanups=effects.map(fn=>fn()).filter(fn=>typeof fn==='function');
 function find(node,label){if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const found=find(child,label);if(found)return found;}return null;}if(node.props?.accessibilityLabel===label||(node.type==='Button'&&node.children.includes(label)))return node;return find(node.children,label);}
 return {press:label=>find(tree,label).props.onPress(),timers,begin:()=>find(tree,'▶ Lancer ce passage').props.onPress(),emit:(time,extra={})=>{player.currentTime=time;listener({isLoaded:true,playing:true,didJustFinish:false,currentTime:time,...extra});},setTime:time=>player.currentTime=time,calls,changes,advanceGap:()=>{for(const [fn,delay] of timers)if(delay===core.DEFAULT_AYAH_GAP_MS){timers.delete(fn);fn();}},close:()=>cleanups.forEach(fn=>fn())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const mode of ['passage','each-verse'])test(`enchaînement automatique entre chaque fichier et répétition (${mode})`,async()=>{
 const c=controls(mode);c.begin();await settle();
 const expected=mode==='passage'?Array.from({length:3},()=>[5,6,7,8]).flat():[5,5,5,6,6,6,7,7,7,8,8,8];
 for(let i=0;i<expected.length;i++){
  c.emit(1,{duration:5});const before=c.calls.play;
  c.emit(5,{duration:5,playing:false});c.emit(5,{duration:5,didJustFinish:true});
  assert.equal(c.calls.play,before,'aucun départ natif synchrone dans le callback de fin');
  await settle();c.advanceGap();await settle();
 }
 assert.deepEqual(c.changes.filter(id=>id!==null),expected);
 assert.equal(c.calls.play,12);c.close();await settle();assert.equal(c.calls.release,1);
});

for(const reciter of core.reciters)test(`${reciter.name}: Al-Fatiha 1–7 avance sans événement natif de fin`,async()=>{
 const c=controls('passage',reciter);c.begin();await settle();
 for(let pass=1;pass<=3;pass++)for(let verse=1;verse<=7;verse++){
  c.emit(1,{duration:5});
  const before=c.calls.replace;c.emit(4.99,{duration:5,isBuffering:true});assert.equal(c.calls.replace,before);
  c.emit(5,{duration:5,playing:false});await settle();c.advanceGap();await settle();
 }
 assert.deepEqual(c.changes.filter(id=>id!==null),Array.from({length:3},()=>[1,2,3,4,5,6,7]).flat());
 assert.equal(c.calls.play,21);c.close();
});

for(const count of [2,5,10,'continuous'])test(`l’enchaînement automatique couvre ×${count}`,async()=>{
 const c=controls('passage',null,count);c.begin();await settle();
 const passes=count==='continuous'?4:count;
 for(let i=0;i<passes*4;i++){c.emit(1,{duration:5});c.emit(5,{duration:5,playing:false});await settle();c.advanceGap();await settle();}
 const played=c.changes.filter(id=>id!==null);assert.deepEqual(played.slice(0,passes*4),Array.from({length:passes},()=>[5,6,7,8]).flat());
 c.close();const before=c.calls.play;c.advanceGap();await settle();assert.equal(c.calls.play,before,'fermer annule la transition en attente');
});


function finish(c){c.emit(1,{duration:5});c.emit(5,{duration:5,playing:false});}
for(const mode of ['each-verse','passage'])for(const count of [1,3,5])test(`As Saffat 3–5 ×${count} ${mode} : ordre automatique`,async()=>{
 const start=quran.verseId(37,3),end=quran.verseId(37,5);
 const c=controls(mode,null,count,{range:{start,end}});c.begin();await settle();
 const expected=mode==='each-verse'?[start,start+1,end].flatMap(id=>Array(count).fill(id)):Array.from({length:count},()=>[start,start+1,end]).flat();
 for(const id of expected){finish(c);await settle();c.advanceGap();await settle();}
 assert.deepEqual(c.changes.filter(x=>x!==null),expected);c.close();
});
test('200 ms conservées et pause utilisateur sans double délai',async()=>{
 assert.equal(core.DEFAULT_AYAH_GAP_MS,200);
 for(const gap of [0,2,5,10]){
  const c=controls('each-verse',null,3,{gap});c.begin();await settle();finish(c);await settle();
  assert.ok([...c.timers.values()].includes(Math.max(200,gap*1000)));c.close();
 }
});
test('Pause durant la pause utilisateur conserve la répétition, Play reprend automatiquement',async()=>{
 const c=controls('each-verse',null,3,{gap:2});c.begin();await settle();finish(c);await settle();
 c.press('Lecture');const played=c.calls.play;c.advanceGap();await settle();assert.equal(c.calls.play,played);
 c.press('Lecture');for(const [fn] of c.timers){c.timers.delete(fn);fn();}await settle();assert.equal(c.calls.play,played+1);
 assert.deepEqual(c.changes.filter(x=>x!==null),[5,5]);c.close();
});
test('Arrêt pendant la pause utilisateur annule définitivement la répétition',async()=>{
 const c=controls('each-verse',null,3,{gap:2});c.begin();await settle();finish(c);await settle();c.press('Arrêter la lecture');const played=c.calls.play;
 c.advanceGap();await settle();assert.equal(c.calls.play,played);c.close();
});
test('Suivant annule la répétition en attente et remet son compteur à 1',async()=>{
 const c=controls('each-verse',null,3,{gap:2});c.begin();await settle();finish(c);await settle();c.press('Verset suivant');await settle();c.advanceGap();await settle();
 assert.deepEqual(c.changes.filter(x=>x!==null),[5,6]);c.close();
});
test('une source ne peut pas être remplacée pendant un seek natif en attente',async()=>{
 let resolveSeek;const c=controls('each-verse',null,3,{seek:()=>new Promise(resolve=>resolveSeek=resolve)});
 c.begin();await settle();finish(c);await settle();c.advanceGap();await settle();assert.ok(resolveSeek);
 const before=c.calls.replace;c.press('Verset suivant');await settle();assert.equal(c.calls.replace,before);
 resolveSeek();await settle();assert.deepEqual(c.changes.filter(x=>x!==null),[5,6]);c.close();
});
test('fermer pendant un seek attend son achèvement et ne relance jamais le player',async()=>{
 let resolveSeek;const c=controls('each-verse',null,3,{seek:()=>new Promise(resolve=>resolveSeek=resolve)});
 c.begin();await settle();finish(c);await settle();c.advanceGap();await settle();const played=c.calls.play;
 c.close();assert.equal(c.calls.release,0);resolveSeek();await settle();assert.equal(c.calls.release,1);assert.equal(c.calls.play,played);
});
test('une erreur native indique précisément seekTo et son contexte',async()=>{
 const errors=[];const c=controls('each-verse',null,3,{seek:()=>Promise.reject(new Error('Exception in HostFunction: <unknown>')),console:{...console,error:(...args)=>errors.push(args)}});
 c.begin();await settle();finish(c);await settle();c.advanceGap();await settle();
 assert.equal(errors[0][1].operation,'seekTo');assert.equal(errors[0][1].repeatIndex,2);assert.equal(errors[0][1].ayah,5);c.close();
});
test('∞ Chaque verset reste sur le même verset jusqu’à une action',async()=>{
 const c=controls('each-verse',null,'continuous');c.begin();await settle();for(let i=0;i<8;i++){finish(c);await settle();c.advanceGap();await settle();}
 assert.ok(c.changes.filter(x=>x!==null).every(x=>x===5));c.press('Arrêter la lecture');const played=c.calls.play;c.advanceGap();await settle();assert.equal(c.calls.play,played);c.close();
});

test('Pause puis Play pendant un seek ne produit aucune lecture obsolète',async()=>{
 let resolveSeek;const c=controls('each-verse',null,3,{seek:()=>new Promise(resolve=>resolveSeek=resolve)});
 c.begin();await settle();finish(c);await settle();c.advanceGap();await settle();const before=c.calls.play;
 c.press('Lecture');resolveSeek();await settle();assert.equal(c.calls.play,before);
 c.press('Lecture');for(const [fn,delay] of c.timers)if(delay===0){c.timers.delete(fn);fn();}await settle();
 resolveSeek();await settle();assert.equal(c.calls.play,before+1);c.close();
});
test('invalidation de session empêche les anciens événements de fin de relancer',async()=>{
 const c=controls('each-verse',null,3,{gap:2});c.begin();await settle();finish(c);await settle();const before=c.calls.play;
 c.press('Arrêter la lecture');c.emit(5,{duration:5,didJustFinish:true});c.advanceGap();await settle();assert.equal(c.calls.play,before);c.close();
});


test('sourate continue : chaque transition conserve le même fichier sans seek',async()=>{
 const c=controls('passage',null,1,{timeline:true});c.begin();await settle();
 for(let verse=5;verse<8;verse++){c.emit(10+verse-5+0.1,{duration:20});c.emit(11+verse-5,{duration:20});await settle();c.advanceGap();await settle();}
 assert.deepEqual(c.changes.filter(x=>x!==null),[5,6,7,8]);assert.equal(c.calls.replace,1);assert.equal(c.calls.seek.length,1);assert.equal(c.calls.play,4);
 c.emit(13.1,{duration:20});c.emit(14,{duration:20});c.advanceGap();await settle();assert.equal(c.calls.play,4);c.close();
});
test('passage continu ×3 : repositionnements uniquement aux reprises du passage',async()=>{
 const c=controls('passage',null,3,{timeline:true});c.begin();await settle();
 for(let pass=0;pass<3;pass++)for(let verse=5;verse<=8;verse++){c.emit(10+verse-5+0.1,{duration:20});c.emit(11+verse-5,{duration:20});await settle();c.advanceGap();await settle();}
 assert.equal(c.calls.replace,1);assert.equal(c.calls.play,12);assert.equal(c.calls.seek.length,3);
 assert.deepEqual(c.changes.filter(x=>x!==null),Array.from({length:3},()=>[5,6,7,8]).flat());c.close();
});
test('Chaque verset ×3 conserve les répétitions dans le fichier de sourate',async()=>{
 const c=controls('each-verse',null,3,{timeline:true});c.begin();await settle();
 for(let verse=5;verse<=8;verse++)for(let pass=0;pass<3;pass++){c.emit(10+verse-5+0.1,{duration:20});c.emit(11+verse-5,{duration:20});await settle();c.advanceGap();await settle();}
 assert.deepEqual(c.changes.filter(x=>x!==null),[5,5,5,6,6,6,7,7,7,8,8,8]);assert.equal(c.calls.replace,1);assert.equal(c.calls.seek.length,9);c.close();
});

test('arrêt au timestamp sans attendre le prochain événement de suivi',async()=>{
 const c=controls('each-verse',null,3,{timeline:true});c.begin();await settle();c.emit(10.95,{duration:20});
 const [deadline,delay]=[...c.timers].find(([,delay])=>delay>0&&delay<100);
 assert.ok(delay<=51);const before=c.calls.pause;c.setTime(11);c.timers.delete(deadline);deadline();
 assert.equal(c.calls.pause,before+1);await settle();assert.ok([...c.timers.values()].includes(200));
 c.emit(11.09,{duration:20});c.advanceGap();await settle();assert.deepEqual(c.changes.filter(x=>x!==null),[5,5]);c.close();
});
test('une horloge bloquée par buffering ne déclenche pas la fin du verset',async()=>{
 const c=controls('passage',null,1,{timeline:true});c.begin();await settle();c.emit(10.95,{duration:20});
 const [deadline]=[...c.timers].find(([,delay])=>delay<100);const before=c.calls.pause;c.timers.delete(deadline);deadline();
 assert.equal(c.calls.pause,before);assert.equal(c.calls.play,1);c.close();
});
test('Arrêt invalide aussi un ancien timer de frontière de verset',async()=>{
 const c=controls('each-verse',null,3,{timeline:true});c.begin();await settle();c.emit(10.95,{duration:20});
 const [deadline]=[...c.timers].find(([,delay])=>delay<100);c.press('Arrêter la lecture');const before=c.calls.play;c.setTime(11);deadline();
 c.advanceGap();await settle();assert.equal(c.calls.play,before);assert.ok(![...c.timers.values()].includes(200));c.close();
});
test('Pause annule le timer de frontière sans lancer le verset suivant',async()=>{
 const c=controls('passage',null,1,{timeline:true});c.begin();await settle();c.emit(10.95,{duration:20});
 const [deadline]=[...c.timers].find(([,delay])=>delay<100);c.press('Lecture');c.setTime(11);deadline();await settle();
 assert.deepEqual(c.changes.filter(x=>x!==null),[5]);assert.ok(![...c.timers.values()].includes(200));c.close();
});

for(const count of [2,3,5])test(`même verset ×${count}: un seul replace, puis seek(0) et play`,async()=>{
 const c=controls('each-verse',null,count,{range:{start:5,end:5},replace(source){assert.ok(source.uri.startsWith('https://'));}});
 c.begin();await settle();
 for(let pass=1;pass<=count;pass++){
  finish(c);c.emit(5,{duration:5,didJustFinish:true,playing:false});await settle();
  // Obsolete status from the completed item must not invalidate its source.
  c.emit(5,{duration:5,playing:false,error:'late completed-item status'});
  if(pass<count){assert.ok([...c.timers.values()].includes(200));c.advanceGap();await settle();}
 }
 assert.equal(c.calls.replace,1);assert.equal(c.calls.play,count);
 assert.deepEqual(c.calls.seek,Array.from({length:count-1},()=>[0]));
 assert.deepEqual(c.changes.filter(id=>id!==null),Array(count).fill(5));c.close();
});
test('chaque verset ×3: replace seulement au changement réel de verset',async()=>{
 const c=controls('each-verse',null,3,{range:{start:5,end:6}});c.begin();await settle();
 for(let i=0;i<6;i++){finish(c);await settle();c.advanceGap();await settle();}
 assert.equal(c.calls.replace,2);assert.equal(c.calls.play,6);assert.deepEqual(c.calls.seek,[[0],[0],[0],[0]]);c.close();
});
test('Arrêt dès le callback de fin annule aussi la pause encore dans la file',async()=>{
 const c=controls('each-verse',null,3);c.begin();await settle();finish(c);c.press('Arrêter la lecture');await settle();c.advanceGap();await settle();
 assert.equal(c.calls.play,1);assert.equal(c.calls.replace,1);c.close();
});
