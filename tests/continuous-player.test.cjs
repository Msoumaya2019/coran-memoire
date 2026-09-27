const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const core=require('./build/core/audio.js'),quran=require('./build/core/quran.js');
function controls(mode='passage',fallbackReciter=null,repeatCount=3){
 const effects=[],changes=[],calls={replace:0,play:0,pause:0,seek:[],release:0};let listener;
 const player={replace(){calls.replace++;},play(){calls.play++;},pause(){calls.pause++;},seekTo(...args){calls.seek.push(args);return Promise.resolve();},setPlaybackRate(){},setActiveForLockScreen(){},addListener(_,fn){listener=fn;return {remove(){listener=null;}};},release(){calls.release++;}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment',useState:initial=>[initial===core.defaultReciter&&fallbackReciter?fallbackReciter:initial==='passage'?mode:initial===3?repeatCount:typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>({current:initial}),useEffect:fn=>effects.push(fn),useMemo:fn=>fn()};
 const ui=Object.fromEntries(['Button','Choice','Field','Label'].map(name=>[name,name]));ui.colors={};
 const native=Object.fromEntries(['KeyboardAvoidingView','Pressable','ScrollView','Text','View'].map(name=>[name,name]));native.Platform={OS:'ios'};native.PanResponder={create:()=>({panHandlers:{}})};native.LayoutAnimation={configureNext(){},Presets:{easeInEaseOut:{}}};
 const exports={};const code=ts.transpileModule(fs.readFileSync('src/PassageAudioPlayer.tsx','utf8')+'\nexport {PassageAudioControls};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const timeline={url:'https://example.com/chapter.mp3',verses:{5:{start:10,end:11},6:{start:11,end:12},7:{start:12,end:13},8:{start:13,end:14}}};
 const timers=new Map();
 vm.runInNewContext(code,{exports,console,Promise,setTimeout:(fn,delay)=>{timers.set(fn,delay);return fn;},clearTimeout:fn=>timers.delete(fn),require(name){
  return {'react':React,'react-native':native,'expo-audio':{setAudioModeAsync:()=>Promise.resolve(),preload:()=>Promise.resolve(),clearPreloadedSource(){}},'@react-native-async-storage/async-storage':{getItem:()=>Promise.resolve(null),setItem:()=>Promise.resolve()},'./services/audioFocus':{createManagedAudioPlayer:()=>player},'./services/quranAudioTimeline':{chapterAudio:()=>Promise.resolve(fallbackReciter?null:timeline)},'./core/audio':core,'./core/quran':quran,'./ui/theme':ui,'./ui/Premium':{Icon:'Icon'}}[name]??(()=>{throw Error(name)})();}});
 const tree=exports.PassageAudioControls({sessionRange:fallbackReciter?{start:1,end:7}:{start:5,end:8},page:1,dock:'expanded',setDock(){},onVerseChange:id=>changes.push(id)});
 const cleanups=effects.map(fn=>fn()).filter(fn=>typeof fn==='function');
 function find(node,label){if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const found=find(child,label);if(found)return found;}return null;}if(node.type==='Button'&&node.children.includes(label))return node;return find(node.children,label);}
 return {begin:()=>find(tree,'▶ Lancer ce passage').props.onPress(),emit:(time,extra={})=>listener({isLoaded:true,playing:true,didJustFinish:false,currentTime:time,...extra}),calls,changes,advanceGap:()=>{for(const [fn,delay] of timers)if(delay===core.DEFAULT_AYAH_GAP){timers.delete(fn);fn();}},close:()=>cleanups.forEach(fn=>fn())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const mode of ['passage','each-verse'])test(`pause technique entre chaque fichier et répétition (${mode})`,async()=>{
 const c=controls(mode);c.begin();await settle();
 const expected=mode==='passage'?Array.from({length:3},()=>[5,6,7,8]).flat():[5,5,5,6,6,6,7,7,7,8,8,8];
 for(let i=0;i<expected.length;i++){
  c.emit(1,{duration:5});const before=c.calls.play;
  c.emit(5,{duration:5,playing:false});c.emit(5,{duration:5,didJustFinish:true});await settle();
  assert.equal(c.calls.play,before,'aucun départ avant la micro-pause');
  c.advanceGap();await settle();
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

for(const count of [2,5,10,'continuous'])test(`la pause technique couvre ×${count}`,async()=>{
 const c=controls('passage',null,count);c.begin();await settle();
 const passes=count==='continuous'?4:count;
 for(let i=0;i<passes*4;i++){c.emit(1,{duration:5});c.emit(5,{duration:5,playing:false});await settle();c.advanceGap();await settle();}
 const played=c.changes.filter(id=>id!==null);assert.deepEqual(played.slice(0,passes*4),Array.from({length:passes},()=>[5,6,7,8]).flat());
 c.close();const before=c.calls.play;c.advanceGap();await settle();assert.equal(c.calls.play,before,'fermer annule la transition en attente');
});
