import {chapterAudio,ChapterAudio} from './services/quranAudioTimeline';
import {Icon} from './ui/Premium';
import {createManagedAudioPlayer as createAudioPlayer} from './services/audioFocus';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {KeyboardAvoidingView,LayoutAnimation,PanResponder,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import {preload,clearPreloadedSource,setAudioModeAsync} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DEFAULT_AYAH_GAP_MS,defaultReciter,audioRange,AudioPosition,nextAudioPosition,reciters,Reciter,RepeatCount,RepeatMode,resolveAudioSegment,verseAudioLabel} from './core/audio';
import {pageOf,pageRange,Range,reference,surahAt,surahs,verseAt,verseId} from './core/quran';
import {Button,Choice,colors,Field,Label} from './ui/theme';

type Selection='session'|'verse'|'custom'|'page'|'surah';
const counts:(number|'custom'|'continuous')[]=[1,2,3,5,10,'custom','continuous'];
const countLabel=(value:number|'custom'|'continuous')=>value==='continuous'?'∞':value==='custom'?'Autre':String(value);

type Dock='closed'|'expanded'|'mini'|'hidden';
export type AudioCommand={serial:number;id:number;action:'listen'|'repeat'|'select'|'open'};
type Props={userId?:string;reciterPreference?:string;onReciterPreference?:(id:string)=>void;sessionRange:Range;page:number;pageRangeOverride?:Range;command?:AudioCommand|null;onVerseChange?:(id:number|null)=>void;fullscreen?:boolean;hideLaunch?:boolean;compact?:boolean;maxPanelHeight?:number;onDockChange?:(open:boolean)=>void;sessionMode?:boolean};
type ControlsProps=Props&{onAdvancedChange?:(open:boolean)=>void;dock:Dock;setDock:(value:Dock)=>void};

export function PassageAudioPlayer({userId,reciterPreference,onReciterPreference,sessionRange,page,pageRangeOverride,command,onVerseChange,fullscreen,hideLaunch,compact,maxPanelHeight,onDockChange,sessionMode}:Props){
  const [dock,setDockState]=useState<Dock>('closed');
  const [settingsOpen,setSettingsOpen]=useState(false);
  const setDock=(next:Dock)=>{LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);setDockState(next);};
  useEffect(()=>{if(command)setDock('expanded');},[command?.serial]);
  useEffect(()=>{onDockChange?.(dock==='expanded'||dock==='mini');},[dock]);
  useEffect(()=>{if(fullscreen&&dock!=='hidden')setDock('hidden');},[fullscreen]);
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{backgroundColor:dock==='hidden'?'transparent':fullscreen?colors.cream:colors.paper,borderTopWidth:fullscreen||dock==='closed'||dock==='hidden'?0:1,borderColor:colors.line,paddingHorizontal:fullscreen||dock==='hidden'?0:12,paddingBottom:fullscreen||dock==='hidden'?0:6,maxHeight:dock==='expanded'?(compact?(settingsOpen?(maxPanelHeight??200)*1.75:undefined):'70%'):undefined,borderTopLeftRadius:compact?22:0,borderTopRightRadius:compact?22:0,...(fullscreen?{position:'absolute' as const,right:12,bottom:10,zIndex:6}:{})}}>
    {dock==='closed'&&!hideLaunch&&<Button onPress={()=>setDock('expanded')}>▶ Écouter mon passage par un récitateur</Button>}
    <PassageAudioControls userId={userId} reciterPreference={reciterPreference} onReciterPreference={onReciterPreference} sessionRange={sessionRange} page={page} pageRangeOverride={pageRangeOverride} command={command} onVerseChange={onVerseChange} dock={dock} setDock={setDock} compact={compact} sessionMode={sessionMode} onAdvancedChange={setSettingsOpen} maxPanelHeight={maxPanelHeight?(maxPanelHeight*(settingsOpen?1.75:1)):undefined} />
  </KeyboardAvoidingView>;
}

function PassageAudioControls({userId,reciterPreference,onReciterPreference,sessionRange,page,pageRangeOverride,command,onVerseChange,dock,setDock,compact,maxPanelHeight,sessionMode,onAdvancedChange}:ControlsProps){
  const currentPageRange=pageRangeOverride??pageRange(page);
  // Own the player so cleanup runs before release when the reader closes.
  const [player]=useState(()=>createAudioPlayer(null,{updateInterval:20,keepAudioSessionActive:true}));
  const onVerseChangeRef=useRef(onVerseChange);
  onVerseChangeRef.current=onVerseChange;
  const [selection,setSelection]=useState<Selection>('session');
  const [selectedRange,setSelectedRange]=useState<Range>(sessionRange);
  const [reciter,setReciter]=useState<Reciter>(reciters.find(r=>r.id===reciterPreference)??defaultReciter);
  const reciterKey=`audio-reciter-hafs:${userId??'guest'}`;
  const rememberReciter=(item:Reciter)=>{reciterTouched.current=true;stop();setReciter(item);onReciterPreference?.(item.id);AsyncStorage.setItem(reciterKey,item.id).catch(e=>setError(String(e)));};
  const [showReciters,setShowReciters]=useState(false);
  const reciterTouched=useRef(false);
  const [chosenId,setChosenId]=useState(sessionRange.start),[surahText,setSurahText]=useState(String(surahs.find(s=>s.start<=sessionRange.start&&s.end>=sessionRange.start)?.number??1));
  const [firstText,setFirstText]=useState(String(verseAt(sessionRange.start).ayah)),[lastText,setLastText]=useState(String(verseAt(sessionRange.end).surah===verseAt(sessionRange.start).surah?verseAt(sessionRange.end).ayah:verseAt(sessionRange.start).ayah));
  const [advanced,setAdvancedValue]=useState(false);
  const setAdvanced=(value:boolean)=>{setAdvancedValue(value);onAdvancedChange?.(value);};
  useEffect(()=>{if(dock!=='expanded')setAdvanced(false);},[dock]);
  useEffect(()=>setAdvanced(false),[command?.serial]);
  const [preferencesLoaded,setPreferencesLoaded]=useState(false);
  const [countChoice,setCountChoice]=useState<number|'custom'|'continuous'>(3),[customCount,setCustomCount]=useState('20');
  const [repeatMode,setRepeatMode]=useState<RepeatMode>('passage'),[gap,setGap]=useState(0),[speed,setSpeed]=useState<0.75|1|1.25>(1),[autoStop,setAutoStop]=useState(true);
  const [current,setCurrent]=useState<AudioPosition|null>(null),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const rangeRef=useRef<Range>(sessionRange),positionRef=useRef<AudioPosition|null>(null),timerRef=useRef<ReturnType<typeof setTimeout>|null>(null),collapseRef=useRef<ReturnType<typeof setTimeout>|null>(null),pendingRef=useRef<AudioPosition|null>(null),reciterRef=useRef<Reciter>(reciter);
  reciterRef.current=reciter;
  const settingsRef=useRef({count:3 as RepeatCount,mode:'passage' as RepeatMode,gap:0,autoStop:true,speed:1});
  const finishGuard=useRef(false),isPlayingRef=useRef(false),completedRef=useRef(false);
  const requestRef=useRef(0),mountedRef=useRef(true),sourceRef=useRef<string|null>(null),segmentEndRef=useRef<number|null>(null),pendingSeeks=useRef<Set<Promise<void>>>(new Set());
  const boundaryTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null),finishBoundaryRef=useRef<()=>void>(()=>{});
  const pendingContinuationRef=useRef(false);
  const timelineRef=useRef<ChapterAudio|null>(null);
  const pendingWaitRef=useRef(0),gapDeadlineRef=useRef(0);
  const transitionQueue=useRef<Promise<void>>(Promise.resolve());
  const transitioningRef=useRef(false),armedRequestRef=useRef(0);
  const lastStatusRef=useRef({isLoaded:false,playing:false,currentTime:0,duration:0});
  const debug=(event:string,details:object={})=>{if(typeof __DEV__!=='undefined'&&__DEV__)console.log(`[AUDIO] ${event}`,{ayah:positionRef.current?.verseId,repeatIndex:positionRef.current?.repetition,session:requestRef.current,...details});};
  const nativeOperation=async <T,>(operation:string,work:()=>T|Promise<T>):Promise<T>=>{
    try{return await work();}catch(error){console.error('[AUDIO ERROR]',{operation,ayah:positionRef.current?.verseId,repeatIndex:positionRef.current?.repetition,repeatCount:settingsRef.current.count,isAudioTransitioning:transitioningRef.current,playbackSessionId:requestRef.current,playerState:lastStatusRef.current,error,stack:error instanceof Error?error.stack:undefined});throw new Error(`${operation} : ${error instanceof Error?error.message:String(error)}`,{cause:error});}
  };
  const preloaded=useRef(new Set<string>());
  const [progress,setProgress]=useState({time:0,duration:0});
  const progressAt=useRef(0);
  const count:RepeatCount=countChoice==='custom'?Number(customCount):countChoice;
  settingsRef.current={count:count==='continuous'?count:Number.isInteger(count)&&count>0?count:1,mode:repeatMode,gap,autoStop,speed};

  const clearBoundary=()=>{if(boundaryTimerRef.current){clearTimeout(boundaryTimerRef.current);boundaryTimerRef.current=null;}};
  const armBoundary=()=>{
    clearBoundary();
    const end=segmentEndRef.current,session=requestRef.current;
    if(end===null||!isPlayingRef.current||finishGuard.current||!mountedRef.current)return;
    // Read the native clock, not the delayed status event's position.
    const remaining=(end-player.currentTime)*1000/settingsRef.current.speed;
    if(!Number.isFinite(remaining))return;
    if(remaining<=0){finishBoundaryRef.current();return;}
    boundaryTimerRef.current=setTimeout(()=>{
      boundaryTimerRef.current=null;
      if(!mountedRef.current||session!==requestRef.current||!isPlayingRef.current||finishGuard.current)return;
      // A buffering stall may have stopped the native clock before the deadline.
      if(player.currentTime<end){armBoundary();return;}
      finishBoundaryRef.current();
    },Math.max(1,Math.ceil(remaining)));
  };
  const clearPause=()=>{if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}};
  const scheduleNext=(next:AudioPosition,wait:number)=>{const continuation=pendingContinuationRef.current;const session=requestRef.current;pendingWaitRef.current=wait;gapDeadlineRef.current=Date.now()+wait;timerRef.current=setTimeout(()=>{timerRef.current=null;if(mountedRef.current&&session===requestRef.current){if(continuation)resumeContinuous(next);else startAt(next);}},wait);};
  const clearCollapse=()=>{if(collapseRef.current){clearTimeout(collapseRef.current);collapseRef.current=null;}};
  const collapseSoon=()=>{if(compact||collapseRef.current)return;collapseRef.current=setTimeout(()=>{collapseRef.current=null;setDock('mini');},3500);};
  const stop=()=>{requestRef.current++;clearBoundary();clearPause();clearCollapse();pendingRef.current=null;isPlayingRef.current=false;completedRef.current=false;if(sourceRef.current){player.pause();player.setActiveForLockScreen(false);}finishGuard.current=false;positionRef.current=null;segmentEndRef.current=null;onVerseChangeRef.current?.(null);setCurrent(null);setPlaying(false);setLoading(false);};
  const selectionRange=():Range=>{
    if(selection==='page'||selection==='surah')return selection==='page'?currentPageRange:selectedRange;
    if(selection==='session')return selectedRange;
    if(selection==='verse')return {start:chosenId,end:chosenId};
    const start=verseId(Number(surahText),Number(firstText)),end=verseId(Number(surahText),Number(lastText));
    if(start===null||end===null)throw new Error('Indique une sourate et des versets existants.');
    return audioRange(start,end);
  };
  const resumeContinuous=(position:AudioPosition)=>{
    const session=++requestRef.current;clearBoundary();pendingRef.current=null;pendingContinuationRef.current=false;
    positionRef.current=position;segmentEndRef.current=timelineRef.current?.verses[position.verseId]?.end??null;finishGuard.current=true;
    setCurrent(position);onVerseChangeRef.current?.(position.verseId);
    transitionQueue.current=transitionQueue.current.then(async()=>{
      if(!mountedRef.current||session!==requestRef.current)return;
      await nativeOperation('resumeContinuous.play',()=>player.play());
      if(!mountedRef.current||session!==requestRef.current){player.pause();return;}
      armedRequestRef.current=session;isPlayingRef.current=true;setPlaying(true);
    }).catch(e=>{if(session!==requestRef.current)return;isPlayingRef.current=false;setPlaying(false);setError(e instanceof Error?e.message:String(e));});
  };
  const startAt=(position:AudioPosition)=>{
    const request=++requestRef.current;
    clearBoundary();clearPause();pendingRef.current=null;pendingContinuationRef.current=false;isPlayingRef.current=false;completedRef.current=false;if(sourceRef.current)player.pause();positionRef.current=position;setCurrent(position);setProgress({time:0,duration:0});setPlaying(true);setLoading(true);setError('');finishGuard.current=true;
    debug('START');
    const selectedReciter=reciterRef.current;
    const task=transitionQueue.current.then(async()=>{
      if(!mountedRef.current||request!==requestRef.current)return;
      transitioningRef.current=true;
      const timeline=await chapterAudio(position.verseId,selectedReciter);
      if(!mountedRef.current||request!==requestRef.current)return;
      timelineRef.current=timeline;
      const timing=timeline?.verses[position.verseId];
      const segment=timeline&&timing?{url:timeline.url,startSeconds:timing.start,endSeconds:timing.end}:await nativeOperation('resolveAudioSegment',()=>resolveAudioSegment(position.verseId,selectedReciter));
      // A file contains only this ayah: its natural ending cannot run into the next.
      // Prefetch while listening; never wait for future sources to start this verse.
      if(!timeline)Promise.all(Array.from({length:Math.min(3,rangeRef.current.end-position.verseId)},(_,i)=>resolveAudioSegment(position.verseId+i+1,selectedReciter))).then(upcoming=>{
        if(!mountedRef.current||request!==requestRef.current)return;
        const wanted=new Set([segment.url,...upcoming.map(next=>next.url)]);
        for(const url of preloaded.current)if(!wanted.has(url)){clearPreloadedSource(url);preloaded.current.delete(url);}
        for(const next of upcoming)if(!preloaded.current.has(next.url)){preloaded.current.add(next.url);preload(next.url).catch(e=>console.warn('[Quran audio] Préchargement',e));}
      }).catch(e=>console.warn('[Quran audio] Préchargement',e));
      if(!mountedRef.current||request!==requestRef.current)return;
      segmentEndRef.current=segment.endSeconds??null;
      const sameSource=sourceRef.current===segment.url;
      if(!sameSource){await nativeOperation('replace',()=>player.replace(segment.url));sourceRef.current=segment.url;}
      if(!mountedRef.current||request!==requestRef.current)return;
      await nativeOperation('setPlaybackRate',()=>player.setPlaybackRate(settingsRef.current.speed));
      if(!mountedRef.current||request!==requestRef.current)return;
      await nativeOperation('setActiveForLockScreen',()=>player.setActiveForLockScreen(true,{title:`Coran · ${verseAudioLabel(position.verseId)}`,artist:selectedReciter.name,albumTitle:'Hafs ‘an ‘Âsim'}));
      if(!mountedRef.current||request!==requestRef.current)return;
      // A completed native player stays at the end of the file. Rewind it even
      // when the next repetition uses exactly the same verse and URL.
      if(sameSource||segment.startSeconds!==undefined){const seek=nativeOperation('seekTo',()=>player.seekTo(segment.startSeconds??0));pendingSeeks.current.add(seek);try{await seek;}finally{pendingSeeks.current.delete(seek);}}
      if(!mountedRef.current||request!==requestRef.current)return;
      await nativeOperation('play',()=>player.play());
      if(!mountedRef.current||request!==requestRef.current){player.pause();return;}
      armedRequestRef.current=request;isPlayingRef.current=true;onVerseChangeRef.current?.(position.verseId);setPlaying(true);setLoading(false);collapseSoon();
    });
    transitionQueue.current=task.catch(e=>{if(!mountedRef.current||request!==requestRef.current)return;isPlayingRef.current=false;completedRef.current=true;sourceRef.current=null;setPlaying(false);setLoading(false);onVerseChangeRef.current?.(null);setError(e instanceof Error?e.message:'Lecture indisponible. Vérifie ta connexion.');}).finally(()=>{transitioningRef.current=false;});
  };
  const begin=()=>{
    try{const range=selectionRange();if(countChoice==='custom'&&(!Number.isInteger(Number(customCount))||Number(customCount)<1||Number(customCount)>999))throw new Error('Choisis entre 1 et 999 écoutes.');
      rangeRef.current=range;startAt({verseId:range.start,repetition:1});
    }catch(e){setError(e instanceof Error?e.message:'Passage invalide.');}
  };
  useEffect(()=>{
    (async()=>{let id=reciterPreference??await AsyncStorage.getItem(reciterKey);if(!id){const owner=await AsyncStorage.getItem('audio-reciter-legacy-owner');if(!owner||owner===userId){id=await AsyncStorage.getItem('audio-reciter-hafs');if(id&&userId)await AsyncStorage.setItem('audio-reciter-legacy-owner',userId);}}const saved=reciters.find(item=>item.id===id)??defaultReciter;if(!mountedRef.current||reciterTouched.current)return;setReciter(saved);if(id&&reciters.some(item=>item.id===id)){await AsyncStorage.setItem(reciterKey,id);if(!reciterPreference)onReciterPreference?.(id);}})().catch(e=>console.warn('[Quran audio] Préférence',e));
    AsyncStorage.getItem('audio-repeat-preferences').then(raw=>{if(!raw)return;const prefs=JSON.parse(raw);if(counts.includes(prefs.countChoice))setCountChoice(prefs.countChoice);if(typeof prefs.customCount==='string')setCustomCount(prefs.customCount);if(prefs.repeatMode==='passage'||prefs.repeatMode==='each-verse')setRepeatMode(prefs.repeatMode);if([0,2,5,10].includes(prefs.gap))setGap(prefs.gap);if([0.75,1,1.25].includes(prefs.speed))setSpeed(prefs.speed);if(typeof prefs.autoStop==='boolean')setAutoStop(prefs.autoStop);}).catch(()=>{}).finally(()=>setPreferencesLoaded(true));
  },[]);
  useEffect(()=>{if(preferencesLoaded)AsyncStorage.setItem('audio-repeat-preferences',JSON.stringify({countChoice,customCount,repeatMode,gap,speed,autoStop})).catch(()=>{});},[preferencesLoaded,countChoice,customCount,repeatMode,gap,speed,autoStop]);
  useEffect(()=>{
    setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'}).catch(e=>setError(String(e)));
    finishBoundaryRef.current=()=>{
      if(finishGuard.current||!isPlayingRef.current||!positionRef.current)return;
      const timeline=timelineRef.current;clearBoundary();
      debug('FINISHED');
      finishGuard.current=true;
      const next=nextAudioPosition(rangeRef.current,positionRef.current,settingsRef.current.mode,settingsRef.current.count,settingsRef.current.autoStop);
      if(!next){isPlayingRef.current=false;completedRef.current=true;setPlaying(false);player.pause();player.setActiveForLockScreen(false);onVerseChangeRef.current?.(null);return;}
      const restart=next.verseId===rangeRef.current.start&&positionRef.current!.verseId===rangeRef.current.end;
      const repeatedVerse=settingsRef.current.mode==='each-verse'&&next.verseId===positionRef.current!.verseId&&next.repetition>positionRef.current!.repetition;
      const wait=Math.max(DEFAULT_AYAH_GAP_MS,restart||repeatedVerse?settingsRef.current.gap*1000:0);
      pendingContinuationRef.current=!!timeline&&next.verseId===positionRef.current!.verseId+1&&!!timeline.verses[next.verseId];
      debug('NEXT',{nextAyah:next.verseId,nextRepeat:next.repetition,wait});player.pause();isPlayingRef.current=false;pendingRef.current=next;if(wait>0)scheduleNext(next,wait);else startAt(next);
    };
    const subscription=player.addListener('playbackStatusUpdate',status=>{
      if(transitioningRef.current||armedRequestRef.current!==requestRef.current)return;
      lastStatusRef.current={isLoaded:status.isLoaded,playing:status.playing,currentTime:status.currentTime,duration:status.duration};
      if(status.error){isPlayingRef.current=false;completedRef.current=true;sourceRef.current=null;onVerseChangeRef.current?.(null);setPlaying(false);setLoading(false);setError('Le verset ne peut pas être chargé. Vérifie ta connexion et réessaie.');return;}
      if(status.isLoaded&&Date.now()-progressAt.current>250){progressAt.current=Date.now();setProgress({time:status.currentTime,duration:status.duration});}
      if(finishGuard.current&&status.isLoaded&&status.playing&&!status.didJustFinish&&status.currentTime<status.duration)finishGuard.current=false;
      if(status.isLoaded&&status.playing&&!status.isBuffering)armBoundary();else clearBoundary();
      // Some native file endings report the final position without didJustFinish.
      // Buffering or a manual pause must never advance the selected passage.
      const fileFinished=status.isLoaded&&!status.isBuffering&&status.duration>0&&status.currentTime>=status.duration;
      const segmentFinished=segmentEndRef.current!==null&&status.isLoaded&&status.playing&&status.currentTime>=segmentEndRef.current;
      if(!(status.didJustFinish||segmentFinished||fileFinished)||finishGuard.current||!isPlayingRef.current||!positionRef.current)return;
      finishBoundaryRef.current();
    });
    return()=>{for(const url of preloaded.current)clearPreloadedSource(url);preloaded.current.clear();mountedRef.current=false;requestRef.current++;subscription.remove();clearBoundary();clearPause();clearCollapse();isPlayingRef.current=false;if(sourceRef.current){player.pause();player.setActiveForLockScreen(false);}transitionQueue.current.finally(()=>player.release()).catch(e=>console.error('[AUDIO ERROR] release',e));};
  },[player]);
  useEffect(()=>{stop();rangeRef.current=sessionRange;setSelectedRange(sessionRange);setSelection(sessionMode===false?'page':'session');setChosenId(sessionRange.start);setSurahText(String(verseAt(sessionRange.start).surah));setFirstText(String(verseAt(sessionRange.start).ayah));setLastText(String(verseAt(sessionRange.end).surah===verseAt(sessionRange.start).surah?verseAt(sessionRange.end).ayah:verseAt(sessionRange.start).ayah));},[sessionRange.start,sessionRange.end]);
  useEffect(()=>{if(positionRef.current){const session=requestRef.current;transitionQueue.current=transitionQueue.current.then(async()=>{if(mountedRef.current&&session===requestRef.current){await nativeOperation('setPlaybackRate',()=>player.setPlaybackRate(speed));armBoundary();}}).catch(e=>{setError(e instanceof Error?e.message:String(e));});}},[speed]);
  useEffect(()=>{if(!command)return;setChosenId(command.id);if(command.action==='open')return;const verse=verseAt(command.id);setChosenId(command.id);setSelectedRange({start:command.id,end:command.id});setSurahText(String(verse.surah));setFirstText(String(verse.ayah));setLastText(String(verse.ayah));setSelection(command.action==='select'?'custom':'verse');if(command.action==='listen'){setCountChoice(1);settingsRef.current={...settingsRef.current,count:1,mode:'passage',autoStop:true};rangeRef.current={start:command.id,end:command.id};startAt({verseId:command.id,repetition:1});}else if(command.action==='repeat')setRepeatMode('passage');},[command?.serial]);
  const jump=(direction:-1|1)=>{const position=positionRef.current;if(!position)return;const id=Math.max(rangeRef.current.start,Math.min(rangeRef.current.end,position.verseId+direction));startAt({verseId:id,repetition:1});};
  const drag=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dy)>12&&Math.abs(gesture.dy)>Math.abs(gesture.dx)*1.4,onPanResponderRelease:(_,gesture)=>{if(gesture.dy>40)setDock(dock==='expanded'?'mini':'hidden');else if(gesture.dy< -40)setDock('expanded');}}),[dock]);
  const playPause=()=>{if(loading||transitioningRef.current){requestRef.current++;clearBoundary();clearPause();pendingRef.current=positionRef.current;pendingWaitRef.current=0;player.pause();isPlayingRef.current=false;setPlaying(false);setLoading(false);return;}if(positionRef.current&&!isPlayingRef.current&&!timerRef.current){if(pendingRef.current){scheduleNext(pendingRef.current,pendingWaitRef.current);setPlaying(true);}else if(completedRef.current)begin();else{clearPause();player.play();isPlayingRef.current=true;setPlaying(true);collapseSoon();}}else if(isPlayingRef.current||timerRef.current){clearBoundary();if(timerRef.current)pendingWaitRef.current=Math.max(0,gapDeadlineRef.current-Date.now());clearPause();clearCollapse();player.pause();isPlayingRef.current=false;setPlaying(false);}else begin();};
  const chooseRange=(range:Range)=>{setSelectedRange(range);setChosenId(range.start);setSurahText(String(verseAt(range.start).surah));setFirstText(String(verseAt(range.start).ayah));setLastText(String(verseAt(range.end).surah===verseAt(range.start).surah?verseAt(range.end).ayah:verseAt(range.start).ayah));setSelection(verseAt(range.start).surah===verseAt(range.end).surah?'custom':'session');};
  useEffect(()=>{if(selection==='page'){chooseRange(currentPageRange);setSelection('page');}},[page,currentPageRange.start,currentPageRange.end,selection==='page']);
  let displayRange=selectedRange;try{displayRange=selectionRange();}catch{/* Keep the last valid range while a field is being edited. */}
  const selectedSurah=surahs[Number(surahText)-1];
  const stepper=(title:string,value:string,set:(v:string)=>void)=><View style={{flex:1}}><Label style={{fontSize:12,color:colors.muted}}>{title}</Label><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Pressable onPress={()=>set(String(Math.max(1,Number(value)-1)))} style={{padding:8,backgroundColor:colors.soft,borderRadius:8}}><Label>−</Label></Pressable><View style={{flex:1}}><Field value={value} onChangeText={set} placeholder="1" keyboardType="number-pad" /></View><Pressable onPress={()=>set(String(Math.min(selectedSurah?.count??1,Number(value)+1)))} style={{padding:8,backgroundColor:colors.soft,borderRadius:8}}><Label>+</Label></Pressable></View></View>;
  const pill=(label:string,selected:boolean,onPress:()=>void)=><Pressable key={label} accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={{minHeight:32,paddingHorizontal:9,justifyContent:'center',backgroundColor:selected?colors.green:colors.soft,borderRadius:12,marginRight:5}}><Label style={{fontSize:11,color:selected?'white':colors.green}}>{label}</Label></Pressable>;
  if(compact&&dock==='expanded')return <View style={{maxHeight:advanced?maxPanelHeight:undefined,paddingBottom:2}}>
    <View {...drag.panHandlers} style={{alignItems:'center',paddingVertical:5}}><View style={{width:34,height:3,borderRadius:3,backgroundColor:colors.muted}}/></View>
    <View style={{flexDirection:'row',alignItems:'center'}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center',marginRight:8}}><Icon name="headphones" color={colors.green}/></View><View style={{flex:1}}><Label style={{fontWeight:'800',fontSize:14}}>Écouter un récitateur</Label><Pressable accessibilityLabel="Choisir le récitateur" onPress={()=>{setShowReciters(!showReciters);setAdvanced(true);}}><Label numberOfLines={1} style={{fontSize:11,color:colors.green}}>{reciter.name}{current?` · Écoute ${current.repetition}/${count==='continuous'?'∞':count}`:''} ⌄</Label></Pressable></View>{([['cog-outline','Réglages audio avancés',()=>setAdvanced(!advanced)],['chevron-down','Réduire le lecteur',()=>setDock('mini')],['close','Masquer le lecteur',()=>setDock('hidden')]] as const).map(([name,label,action])=><Pressable key={name} accessibilityLabel={label} onPress={action} style={{width:36,height:44,alignItems:'center',justifyContent:'center'}}><Icon name={name} size={20} color={colors.green}/></Pressable>)}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,flexShrink:0,height:32,marginVertical:6}}>{pill(selection==='page'?'Toute la page':selection==='session'?'Ma séance':selection==='verse'?'Ce verset':selection==='surah'?'Toute la sourate':'Passage',false,()=>setAdvanced(true))}{pill(reference(displayRange),false,()=>setAdvanced(true))}{pill(`Répétition ×${count==='continuous'?'∞':count}`,false,()=>{const values:(number|'continuous')[]=[1,2,3,5,10,'continuous'];setCountChoice(values[(values.indexOf(count as number|'continuous')+1)%values.length]);})}{pill(`${speed}x`,false,()=>setSpeed(speed===1?1.25:speed===1.25?0.75:1))}</ScrollView>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,marginVertical:6}}><Label style={{fontSize:11,color:colors.muted}}>{Math.floor(progress.time/60)}:{String(Math.floor(progress.time%60)).padStart(2,'0')}</Label><View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round((current?((current.verseId-rangeRef.current.start)+(progress.duration?Math.min(1,progress.time/progress.duration):0))/(rangeRef.current.end-rangeRef.current.start+1):0)*100)}} style={{flex:1,height:5,borderRadius:3,backgroundColor:colors.soft}}><View style={{height:5,borderRadius:3,backgroundColor:colors.green2,width:`${Math.min(100,Math.max(0,(current?((current.verseId-rangeRef.current.start)+(progress.duration?Math.min(1,progress.time/progress.duration):0))/(rangeRef.current.end-rangeRef.current.start+1):0)*100))}%`}}/></View><Label style={{fontSize:11,color:colors.muted}}>{current?current.verseId-rangeRef.current.start+1:0}/{(current?rangeRef.current:displayRange).end-(current?rangeRef.current:displayRange).start+1}</Label></View>
    {advanced&&<ScrollView keyboardShouldPersistTaps="handled" style={{flexShrink:1,minHeight:0}} contentContainerStyle={{paddingVertical:8}}>
      {showReciters&&reciters.map(item=><Choice key={item.id} label={item.name} selected={reciter.id===item.id} onPress={()=>{if(reciter.id!==item.id){rememberReciter(item);}setShowReciters(false);setAdvanced(false);}}/>)}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:4,marginBottom:8}}>{pill('Ma séance',selection==='session',()=>{chooseRange(sessionRange);setSelection('session');})}{pill('Ce verset',selection==='verse',()=>{const id=current?.verseId??(chosenId>=currentPageRange.start&&chosenId<=currentPageRange.end?chosenId:currentPageRange.start);chooseRange({start:id,end:id});setSelection('verse');})}{pill('Toute la page',selection==='page',()=>{chooseRange(currentPageRange);setSelection('page');})}{pill('Toute la sourate',selection==='surah',()=>{chooseRange(surahAt(current?.verseId??chosenId));setSelection('surah');})}</View>
      <Label>Sourate (1–114)</Label><Field placeholder="Sourate (1–114)" value={surahText} keyboardType="number-pad" onChangeText={value=>{setSurahText(value);setFirstText('1');setLastText('1');setSelection('custom');}}/><View style={{flexDirection:'row',gap:6}}>{stepper('Du verset',firstText,v=>{setFirstText(v);setSelection('custom');})}{stepper('Au verset',lastText,v=>{setLastText(v);setSelection('custom');})}</View>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>{counts.map(n=>pill(countLabel(n),countChoice===n,()=>{setCountChoice(n);}))}</View>{countChoice==='custom'&&<Field value={customCount} onChangeText={setCustomCount} keyboardType="number-pad" placeholder="Nombre personnalisé"/>}
      <View style={{flexDirection:'row',marginVertical:6}}>{pill('Passage complet',repeatMode==='passage',()=>setRepeatMode('passage'))}{pill('Chaque verset',repeatMode==='each-verse',()=>{setRepeatMode('each-verse');})}</View><Label>Vitesse</Label><View style={{flexDirection:'row'}}>{([0.75,1,1.25] as const).map(n=>pill(`${n}×`,speed===n,()=>setSpeed(n)))}</View><Label>Pause entre les répétitions</Label><Label style={{fontSize:11,color:colors.muted}}>Une marge technique de {DEFAULT_AYAH_GAP_MS} ms reste active entre les versets.</Label><View style={{flexDirection:'row'}}>{[0,2,5,10].map(n=>pill(`${n}s`,gap===n,()=>setGap(n)))}</View><Choice label="Arrêter à la fin des écoutes" selected={autoStop&&countChoice!=='continuous'} onPress={()=>setAutoStop(!autoStop)}/><Button small onPress={()=>{setAdvanced(false);begin();}}>Lancer ce passage</Button><Button small secondary onPress={()=>current?startAt({verseId:rangeRef.current.start,repetition:1}):begin()}>Recommencer le passage</Button>
    </ScrollView>}
    {error&&<Label style={{color:colors.red,fontSize:11}}>{error}</Label>}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12}}><Pressable accessibilityLabel="Verset précédent" onPress={()=>jump(-1)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="skip-previous" color={colors.green}/></Pressable><Pressable accessibilityLabel={playing?'Pause':'Lecture'} onPress={playPause} style={{width:44,height:44,borderRadius:22,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'}}><Icon name={playing?'pause':'play'} color="white"/></Pressable><Pressable accessibilityLabel="Verset suivant" onPress={()=>jump(1)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="skip-next" color={colors.green}/></Pressable><Pressable accessibilityLabel="Arrêter la lecture" onPress={stop} style={{minWidth:44,height:44,justifyContent:'center'}}><Label style={{fontSize:12}}>Arrêt</Label></Pressable></View>
  </View>;
  return <>
    {dock==='hidden'&&<Pressable accessibilityLabel="Rouvrir le lecteur audio" onPress={()=>setDock('mini')} style={{alignSelf:'flex-end',backgroundColor:colors.green,width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22}}><Icon name="headphones" color="white"/></Pressable>}
    {dock==='mini'&&<View {...drag.panHandlers} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4,paddingVertical:2}}><Pressable accessibilityLabel="Développer le lecteur" onPress={()=>setDock('expanded')} style={{minHeight:44,justifyContent:'center'}}><Label style={{fontSize:12,color:colors.green}}>{current?current.verseId-rangeRef.current.start+1:0}/{(current?rangeRef.current:displayRange).end-(current?rangeRef.current:displayRange).start+1}</Label></Pressable><Pressable accessibilityLabel="Verset précédent" onPress={()=>jump(-1)} style={{padding:10}}><Icon name="skip-previous" color={colors.green}/></Pressable><Pressable accessibilityLabel={playing?'Pause':'Lecture'} onPress={playPause} style={{width:44,height:44,borderRadius:22,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'}}><Icon name={playing?'pause':'play'} color="white"/></Pressable><Pressable accessibilityLabel="Verset suivant" onPress={()=>jump(1)} style={{padding:10}}><Icon name="skip-next" color={colors.green}/></Pressable><Label style={{fontSize:12}}>×{count==='continuous'?'∞':count}</Label><Pressable accessibilityLabel="Masquer le lecteur" onPress={()=>setDock('hidden')} style={{padding:10}}><Icon name="chevron-down" color={colors.green}/></Pressable></View>}
    {dock==='expanded'&&<><View {...drag.panHandlers} style={{alignItems:'center',paddingVertical:7}}><View style={{width:36,height:4,borderRadius:4,backgroundColor:colors.muted}} /></View><View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{flex:1}}><Label style={{fontWeight:'700',color:colors.green}}>{current?reference(rangeRef.current):reference(selectedRange)}</Label><Label style={{fontSize:12,color:colors.muted}}>{reciter.name} · {current?`${current.repetition}/${countChoice==='continuous'||!autoStop?'∞':count}`:'Hafs ‘an ‘Âsim'}</Label></View><Pressable accessibilityLabel="Réglages audio avancés" onPress={()=>setAdvanced(!advanced)} style={{padding:9}}><Label style={{fontSize:21}}>⚙</Label></Pressable><Pressable accessibilityLabel="Réduire le lecteur" onPress={()=>setDock('mini')} style={{padding:9}}><Label style={{fontSize:22}}>⌄</Label></Pressable><Pressable accessibilityLabel="Masquer le lecteur" onPress={()=>setDock('hidden')} style={{padding:9}}><Label style={{fontSize:19}}>×</Label></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{flexGrow:0}} contentContainerStyle={{paddingBottom:10}}>
        <Pressable accessibilityLabel="Choisir le récitateur" onPress={()=>setShowReciters(!showReciters)} style={{paddingVertical:10}}><Label style={{fontWeight:'700',color:colors.green}}>Récitateur : {reciter.name}{current?` · Écoute ${current.repetition}/${count==='continuous'?'∞':count}`:''} ⌄</Label></Pressable>
        {showReciters&&reciters.map(item=><Choice key={item.id} label={item.name} selected={reciter.id===item.id} onPress={()=>{if(reciter.id!==item.id){rememberReciter(item);}setShowReciters(false);}} />)}
        <Label style={{fontWeight:'700',marginTop:8}}>Choisir le passage</Label><Label style={{fontSize:12,color:colors.muted,marginTop:5}}>Sourate {selectedSurah?.name??'—'}</Label><Field value={surahText} onChangeText={value=>{setSurahText(value);setFirstText('1');setLastText('1');setSelection('custom');}} placeholder="Sourate (1–114)" keyboardType="number-pad" />
        {selection==='session'&&verseAt(selectedRange.start).surah!==verseAt(selectedRange.end).surah?<Label style={{fontSize:12,color:colors.muted,marginBottom:5}}>Passage sur plusieurs sourates : {reference(selectedRange)}</Label>:null}
        <View style={{flexDirection:'row',gap:8}}>{stepper('Du verset',firstText,value=>{setFirstText(value);setSelection('custom');})}{stepper('Au verset',lastText,value=>{setLastText(value);setSelection('custom');})}</View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>{[['Ce verset',()=>chooseRange({start:current?.verseId??currentPageRange.start,end:current?.verseId??currentPageRange.start})],['Toute la page',()=>chooseRange(currentPageRange)],['Toute la sourate',()=>chooseRange(surahAt(current?.verseId??currentPageRange.start))],['Ma séance',()=>{chooseRange(sessionRange);setSelection('session');}]] .map(([label,action])=><Pressable key={label as string} onPress={action as ()=>void} style={{padding:8,borderRadius:10,backgroundColor:colors.soft,borderWidth:1,borderColor:colors.softBorder}}><Label style={{fontSize:12,color:colors.green}}>{label as string}</Label></Pressable>)}</View>
        <Label style={{fontWeight:'700',marginTop:10}}>Répétitions</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{counts.map(value=><View key={value} style={{minWidth:54}}><Button small secondary={countChoice!==value} onPress={()=>{setCountChoice(value);}}>{countLabel(value)}</Button></View>)}</View>
        {countChoice==='custom'&&<Field value={customCount} onChangeText={setCustomCount} placeholder="Nombre personnalisé (1 à 999)" keyboardType="number-pad" />}
        <View style={{flexDirection:'row',gap:6}}><View style={{flex:1}}><Button small secondary={repeatMode!=='passage'} onPress={()=>setRepeatMode('passage')}>Passage complet</Button></View><View style={{flex:1}}><Button small secondary={repeatMode!=='each-verse'} onPress={()=>{setRepeatMode('each-verse');}}>Chaque verset</Button></View></View>
        <Button onPress={begin}>▶ Lancer ce passage</Button>
        {advanced&&<><Label style={{fontWeight:'700'}}>Vitesse</Label><View style={{flexDirection:'row',gap:6}}>{([0.75,1,1.25] as const).map(value=><View key={value} style={{flex:1}}><Button small secondary={speed!==value} onPress={()=>setSpeed(value)}>{String(value).replace('.',',')}×</Button></View>)}</View><Label style={{fontWeight:'700'}}>Pause entre deux écoutes</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{[0,2,5,10].map(value=><View key={value} style={{minWidth:66}}><Button small secondary={gap!==value} onPress={()=>setGap(value)}>{value?`${value} s`:'Aucune'}</Button></View>)}</View><Choice label="Arrêter à la fin des écoutes" selected={autoStop&&countChoice!=='continuous'} onPress={()=>setAutoStop(!autoStop)} /><Button small secondary onPress={()=>current?startAt({verseId:rangeRef.current.start,repetition:1}):begin()}>Recommencer le passage</Button></>}
        {error?<Label style={{color:colors.red,marginVertical:6}}>{error}</Label>:null}
      </ScrollView>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:16}}><Pressable accessibilityLabel="Verset précédent" onPress={()=>jump(-1)} style={{padding:10}}><Label style={{fontSize:25,color:colors.green}}>‹</Label></Pressable><Pressable accessibilityLabel={playing?'Pause':'Lecture'} onPress={playPause} style={{backgroundColor:colors.green,borderRadius:28,width:52,height:52,alignItems:'center',justifyContent:'center'}}><Text style={{color:'white',fontSize:22}}>{loading?'…':playing?'Ⅱ':'▶'}</Text></Pressable><Pressable accessibilityLabel="Verset suivant" onPress={()=>jump(1)} style={{padding:10}}><Label style={{fontSize:25,color:colors.green}}>›</Label></Pressable><Pressable accessibilityLabel="Arrêter la lecture" onPress={stop} style={{padding:10}}><Label style={{fontSize:12}}>Arrêt</Label></Pressable></View>
    </>}
  </>;
}
