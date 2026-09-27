const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const core=require('./build/core/audio.js'),quran=require('./build/core/quran.js');
function controls(mode='passage',fallbackReciter=null){
 const effects=[],changes=[],calls={replace:0,play:0,pause:0,seek:[],release:0};let listener;
 const player={replace(){calls.replace++;},play(){calls.play++;},pause(){calls.pause++;},seekTo(...args){calls.seek.push(args);return Promise.resolve();},setPlaybackRate(){},setActiveForLockScreen(){},addListener(_,fn){listener=fn;return {remove(){listener=null;}};},release(){calls.release++;}};
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment',useState:initial=>[initial===core.reciters[0]&&fallbackReciter?fallbackReciter:initial==='passage'?mode:typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>({current:initial}),useEffect:fn=>effects.push(fn),useMemo:fn=>fn()};
 const ui=Object.fromEntries(['Button','Choice','Field','Label'].map(name=>[name,name]));ui.colors={};
 const native=Object.fromEntries(['KeyboardAvoidingView','Pressable','ScrollView','Text','View'].map(name=>[name,name]));native.Platform={OS:'ios'};native.PanResponder={create:()=>({panHandlers:{}})};native.LayoutAnimation={configureNext(){},Presets:{easeInEaseOut:{}}};
 const exports={};const code=ts.transpileModule(fs.readFileSync('src/PassageAudioPlayer.tsx','utf8')+'\nexport {PassageAudioControls};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const timeline={url:'https://example.com/chapter.mp3',verses:{5:{start:10,end:11},6:{start:11,end:12},7:{start:12,end:13},8:{start:13,end:14}}};
 const timers=new Set();
 vm.runInNewContext(code,{exports,console,Promise,setTimeout:(fn)=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),require(name){
  return {'react':React,'react-native':native,'expo-audio':{setAudioModeAsync:()=>Promise.resolve(),preload:()=>Promise.resolve(),clearPreloadedSource(){}},'@react-native-async-storage/async-storage':{getItem:()=>Promise.resolve(null),setItem:()=>Promise.resolve()},'./services/audioFocus':{createManagedAudioPlayer:()=>player},'./services/quranAudioTimeline':{chapterAudio:()=>Promise.resolve(fallbackReciter?null:timeline)},'./core/audio':core,'./core/quran':quran,'./ui/theme':ui}[name]??(()=>{throw Error(name)})();}});
 const tree=exports.PassageAudioControls({sessionRange:fallbackReciter?{start:1,end:7}:{start:5,end:8},page:1,dock:'expanded',setDock(){},onVerseChange:id=>changes.push(id)});
 const cleanups=effects.map(fn=>fn()).filter(fn=>typeof fn==='function');
 function find(node,label){if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const found=find(child,label);if(found)return found;}return null;}if(node.type==='Button'&&node.children.includes(label))return node;return find(node.children,label);}
 return {begin:()=>find(tree,'▶ Lancer ce passage').props.onPress(),emit:(time,extra={})=>listener({isLoaded:true,playing:true,didJustFinish:false,currentTime:time,...extra}),calls,changes,close:()=>cleanups.forEach(fn=>fn())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('le lecteur conserve un seul fichier entre les ayat et seek uniquement aux répétitions',async()=>{
 const c=controls();c.begin();await settle();c.emit(10);assert.equal(c.calls.replace,1);
 for(let repetition=1;repetition<=3;repetition++){
  const plays=c.calls.play,pauses=c.calls.pause;
  for(const time of [11.01,12.01,13.01])c.emit(time);
  assert.equal(c.calls.play,plays);assert.equal(c.calls.pause,pauses);assert.equal(c.calls.replace,1);
  c.emit(14);await settle();if(repetition<3)c.emit(10);
 }
 assert.deepEqual(c.changes.filter(id=>id!==null),[5,6,7,8,5,6,7,8,5,6,7,8]);
 assert.equal(c.calls.play,3);assert.equal(c.calls.seek.length,3);assert.ok(c.calls.seek.every(args=>args[0]===10&&args[1]===0&&args[2]===0));
 c.close();await settle();assert.equal(c.calls.release,1);
});

test('répéter chaque ayah conserve aussi une transition continue vers l’ayah suivante',async()=>{
 const c=controls('each-verse');c.begin();await settle();
 for(let id=5;id<=8;id++){
  const start=id+5,end=start+1;
  for(let repetition=1;repetition<=3;repetition++){
   c.emit(start);const plays=c.calls.play,pauses=c.calls.pause;c.emit(end);await settle();
   if(repetition===3&&id<8){assert.equal(c.calls.play,plays);assert.equal(c.calls.pause,pauses);}
  }
 }
 assert.deepEqual(c.changes.filter(id=>id!==null),[5,5,5,6,6,6,7,7,7,8,8,8]);
 assert.equal(c.calls.replace,1);assert.equal(c.calls.play,9);assert.equal(c.calls.seek.length,9);c.close();
});

for(const reciter of core.reciters.filter(r=>r.id.startsWith('everyayah.')))test(`${reciter.name}: Al-Fatiha 1–7 avance sans événement natif de fin`,async()=>{
 const c=controls('passage',reciter);c.begin();await settle();
 for(let pass=1;pass<=3;pass++)for(let verse=1;verse<=7;verse++){
  c.emit(1,{duration:5});
  const before=c.calls.replace;c.emit(4.99,{duration:5,isBuffering:true});assert.equal(c.calls.replace,before);
  c.emit(5,{duration:5,playing:false});await settle();
 }
 assert.deepEqual(c.changes.filter(id=>id!==null),Array.from({length:3},()=>[1,2,3,4,5,6,7]).flat());
 assert.equal(c.calls.play,21);c.close();
});
