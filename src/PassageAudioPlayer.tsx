import React,{useEffect,useMemo,useRef,useState} from 'react';
import {KeyboardAvoidingView,LayoutAnimation,PanResponder,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import {createAudioPlayer,setAudioModeAsync} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {audioRange,AudioPosition,nextAudioPosition,reciters,Reciter,RepeatCount,RepeatMode,resolveAudioSegment,verseAudioLabel} from './core/audio';
import {pageRange,Range,reference,surahAt,surahs,verseAt,verseId} from './core/quran';
import {Button,Choice,colors,Field,Label} from './ui/theme';

type Selection='session'|'verse'|'custom';
const counts:(number|'custom'|'continuous')[]=[1,2,3,5,10,'custom','continuous'];
const countLabel=(value:number|'custom'|'continuous')=>value==='continuous'?'∞':value==='custom'?'Autre':String(value);

type Dock='closed'|'expanded'|'mini'|'hidden';
export type AudioCommand={serial:number;id:number;action:'listen'|'repeat'|'select'|'open'};
type Props={sessionRange:Range;page:number;command?:AudioCommand|null;onVerseChange?:(id:number|null)=>void;fullscreen?:boolean;hideLaunch?:boolean};
type ControlsProps=Props&{dock:Dock;setDock:(value:Dock)=>void};

export function PassageAudioPlayer({sessionRange,page,command,onVerseChange,fullscreen,hideLaunch}:Props){
  const [dock,setDockState]=useState<Dock>('closed');
  const setDock=(next:Dock)=>{LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);setDockState(next);};
  useEffect(()=>{if(command)setDock('expanded');},[command?.serial]);
  useEffect(()=>{if(fullscreen&&dock!=='hidden')setDock('hidden');},[fullscreen]);
  return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{backgroundColor:colors.paper,borderTopWidth:dock==='closed'?0:1,borderColor:colors.line,paddingHorizontal:12,paddingBottom:6,maxHeight:dock==='expanded'?'70%':undefined}}>
    {dock==='closed'&&!hideLaunch&&<Button onPress={()=>setDock('expanded')}>▶ Écouter mon passage par un récitateur</Button>}
    <PassageAudioControls sessionRange={sessionRange} page={page} command={command} onVerseChange={onVerseChange} dock={dock} setDock={setDock} />
  </KeyboardAvoidingView>;
}

function PassageAudioControls({sessionRange,page,command,onVerseChange,dock,setDock}:ControlsProps){
  // Own the player so cleanup runs before release when the reader closes.
  const [player]=useState(()=>createAudioPlayer(null,{updateInterval:250}));
  const onVerseChangeRef=useRef(onVerseChange);
  onVerseChangeRef.current=onVerseChange;
  const [selection,setSelection]=useState<Selection>('session');
  const [selectedRange,setSelectedRange]=useState<Range>(sessionRange);
  const [reciter,setReciter]=useState<Reciter>(reciters[0]);
  const [showReciters,setShowReciters]=useState(false);
  const [chosenId,setChosenId]=useState(sessionRange.start),[surahText,setSurahText]=useState(String(surahs.find(s=>s.start<=sessionRange.start&&s.end>=sessionRange.start)?.number??1));
  const [firstText,setFirstText]=useState(String(verseAt(sessionRange.start).ayah)),[lastText,setLastText]=useState(String(verseAt(sessionRange.end).surah===verseAt(sessionRange.start).surah?verseAt(sessionRange.end).ayah:verseAt(sessionRange.start).ayah));
  const [advanced,setAdvanced]=useState(false);
  const [preferencesLoaded,setPreferencesLoaded]=useState(false);
  const [countChoice,setCountChoice]=useState<number|'custom'|'continuous'>(3),[customCount,setCustomCount]=useState('20');
  const [repeatMode,setRepeatMode]=useState<RepeatMode>('passage'),[gap,setGap]=useState(0),[speed,setSpeed]=useState<0.75|1|1.25>(1),[autoStop,setAutoStop]=useState(true);
  const [current,setCurrent]=useState<AudioPosition|null>(null),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const rangeRef=useRef<Range>(sessionRange),positionRef=useRef<AudioPosition|null>(null),timerRef=useRef<ReturnType<typeof setTimeout>|null>(null),collapseRef=useRef<ReturnType<typeof setTimeout>|null>(null),pendingRef=useRef<AudioPosition|null>(null),reciterRef=useRef<Reciter>(reciter);
  reciterRef.current=reciter;
  const settingsRef=useRef({count:3 as RepeatCount,mode:'passage' as RepeatMode,gap:0,autoStop:true,speed:1});
  const finishGuard=useRef(false),isPlayingRef=useRef(false);
  const requestRef=useRef(0),mountedRef=useRef(true),sourceRef=useRef<string|null>(null),segmentEndRef=useRef<number|null>(null),pendingSeeks=useRef<Set<Promise<void>>>(new Set());
  const count:RepeatCount=countChoice==='custom'?Number(customCount):countChoice;
  settingsRef.current={count:count==='continuous'?count:Number.isInteger(count)&&count>0?count:1,mode:repeatMode,gap,autoStop,speed};

  const clearPause=()=>{if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}};
  const clearCollapse=()=>{if(collapseRef.current){clearTimeout(collapseRef.current);collapseRef.current=null;}};
  const collapseSoon=()=>{if(collapseRef.current)return;collapseRef.current=setTimeout(()=>{collapseRef.current=null;setDock('mini');},3500);};
  const stop=()=>{requestRef.current++;clearPause();clearCollapse();pendingRef.current=null;isPlayingRef.current=false;if(sourceRef.current){player.pause();player.setActiveForLockScreen(false);}finishGuard.current=false;positionRef.current=null;segmentEndRef.current=null;onVerseChangeRef.current?.(null);setCurrent(null);setPlaying(false);setLoading(false);};
  const selectionRange=():Range=>{
    if(selection==='session')return selectedRange;
    if(selection==='verse')return {start:chosenId,end:chosenId};
    const start=verseId(Number(surahText),Number(firstText)),end=verseId(Number(surahText),Number(lastText));
    if(start===null||end===null)throw new Error('Indique une sourate et des versets existants.');
    return audioRange(start,end);
  };
  const startAt=(position:AudioPosition)=>{
    const request=++requestRef.current;
    clearPause();pendingRef.current=null;isPlayingRef.current=false;if(sourceRef.current)player.pause();positionRef.current=position;setCurrent(position);setPlaying(false);setLoading(true);setError('');finishGuard.current=true;
    resolveAudioSegment(position.verseId,reciterRef.current).then(async segment=>{
      if(!mountedRef.current||request!==requestRef.current)return;
      segmentEndRef.current=segment.endSeconds??null;
      if(sourceRef.current!==segment.url){player.replace(segment.url);sourceRef.current=segment.url;}
      player.setPlaybackRate(settingsRef.current.speed);
      player.setActiveForLockScreen(true,{title:`Coran · ${verseAudioLabel(position.verseId)}`,artist:reciterRef.current.name,albumTitle:'Hafs ‘an ‘Âsim'});
      if(segment.startSeconds!==undefined){const seek=player.seekTo(segment.startSeconds);pendingSeeks.current.add(seek);try{await seek;}finally{pendingSeeks.current.delete(seek);}}
      if(!mountedRef.current||request!==requestRef.current)return;
      player.play();isPlayingRef.current=true;onVerseChangeRef.current?.(position.verseId);setPlaying(true);setLoading(false);collapseSoon();
    }).catch(e=>{if(!mountedRef.current||request!==requestRef.current)return;isPlayingRef.current=false;setPlaying(false);setLoading(false);onVerseChangeRef.current?.(null);setError(e instanceof Error?e.message:'Lecture indisponible. Vérifie ta connexion.');});
  };
  const begin=()=>{
    try{const range=selectionRange();if(countChoice==='custom'&&(!Number.isInteger(Number(customCount))||Number(customCount)<1||Number(customCount)>999))throw new Error('Choisis entre 1 et 999 écoutes.');
      rangeRef.current=range;startAt({verseId:range.start,repetition:1});
    }catch(e){setError(e instanceof Error?e.message:'Passage invalide.');}
  };
  useEffect(()=>{
    AsyncStorage.getItem('audio-reciter-hafs').then(id=>{const saved=reciters.find(item=>item.id===id);if(saved)setReciter(saved);}).catch(()=>{});
    AsyncStorage.getItem('audio-repeat-preferences').then(raw=>{if(!raw)return;const prefs=JSON.parse(raw);if(counts.includes(prefs.countChoice))setCountChoice(prefs.countChoice);if(typeof prefs.customCount==='string')setCustomCount(prefs.customCount);if(prefs.repeatMode==='passage'||prefs.repeatMode==='each-verse')setRepeatMode(prefs.repeatMode);if([0,2,5,10].includes(prefs.gap))setGap(prefs.gap);if([0.75,1,1.25].includes(prefs.speed))setSpeed(prefs.speed);if(typeof prefs.autoStop==='boolean')setAutoStop(prefs.autoStop);}).catch(()=>{}).finally(()=>setPreferencesLoaded(true));
  },[]);
  useEffect(()=>{if(preferencesLoaded)AsyncStorage.setItem('audio-repeat-preferences',JSON.stringify({countChoice,customCount,repeatMode,gap,speed,autoStop})).catch(()=>{});},[preferencesLoaded,countChoice,customCount,repeatMode,gap,speed,autoStop]);
  useEffect(()=>{
    setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'}).catch(e=>setError(String(e)));
    const subscription=player.addListener('playbackStatusUpdate',status=>{
      if(status.error){isPlayingRef.current=false;onVerseChangeRef.current?.(null);setPlaying(false);setLoading(false);setError('Le verset ne peut pas être chargé. Vérifie ta connexion et réessaie.');return;}
      if(finishGuard.current&&status.isLoaded&&status.playing&&!status.didJustFinish)finishGuard.current=false;
      const segmentFinished=segmentEndRef.current!==null&&status.isLoaded&&status.playing&&status.currentTime>=segmentEndRef.current-0.05;
      if(!(status.didJustFinish||segmentFinished)||finishGuard.current||!isPlayingRef.current||!positionRef.current)return;
      finishGuard.current=true;
      const next=nextAudioPosition(rangeRef.current,positionRef.current,settingsRef.current.mode,settingsRef.current.count,settingsRef.current.autoStop);
      if(!next){isPlayingRef.current=false;setPlaying(false);player.setActiveForLockScreen(false);onVerseChangeRef.current?.(null);return;}
      const restart=next.verseId===rangeRef.current.start&&positionRef.current!.verseId===rangeRef.current.end;
      const repeatedVerse=settingsRef.current.mode==='each-verse'&&next.verseId===positionRef.current!.verseId&&next.repetition>positionRef.current!.repetition;
      const wait=restart||repeatedVerse?settingsRef.current.gap:0;
      if(wait){player.pause();setPlaying(false);pendingRef.current=next;timerRef.current=setTimeout(()=>startAt(next),wait*1000);}else startAt(next);
    });
    return()=>{mountedRef.current=false;requestRef.current++;subscription.remove();clearPause();clearCollapse();isPlayingRef.current=false;if(sourceRef.current){player.pause();player.setActiveForLockScreen(false);}const seeks=[...pendingSeeks.current];if(seeks.length)Promise.allSettled(seeks).then(()=>player.release()).catch(()=>{});else player.release();};
  },[player]);
  useEffect(()=>{stop();rangeRef.current=sessionRange;setSelectedRange(sessionRange);setChosenId(sessionRange.start);},[sessionRange.start,sessionRange.end]);
  useEffect(()=>{if(current)player.setPlaybackRate(speed);},[speed]);
  useEffect(()=>{if(!command||command.action==='open')return;const verse=verseAt(command.id);setChosenId(command.id);setSelectedRange({start:command.id,end:command.id});setSurahText(String(verse.surah));setFirstText(String(verse.ayah));setLastText(String(verse.ayah));setSelection(command.action==='select'?'custom':'verse');if(command.action==='listen'){setCountChoice(1);settingsRef.current={...settingsRef.current,count:1,mode:'passage',autoStop:true};rangeRef.current={start:command.id,end:command.id};startAt({verseId:command.id,repetition:1});}else if(command.action==='repeat')setRepeatMode('passage');},[command?.serial]);
  const jump=(direction:-1|1)=>{if(!current)return;const id=Math.max(rangeRef.current.start,Math.min(rangeRef.current.end,current.verseId+direction));startAt({verseId:id,repetition:current.repetition});};
  const drag=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,gesture)=>gesture.dy>12&&Math.abs(gesture.dy)>Math.abs(gesture.dx)*1.4,onPanResponderRelease:(_,gesture)=>{if(gesture.dy>40)setDock(dock==='expanded'?'mini':'hidden');}}),[dock]);
  const playPause=()=>{if(loading)return;if(current&&!playing){if(pendingRef.current)startAt(pendingRef.current);else{clearPause();player.play();isPlayingRef.current=true;setPlaying(true);collapseSoon();}}else if(playing){clearCollapse();player.pause();isPlayingRef.current=false;setPlaying(false);}else begin();};
  const chooseRange=(range:Range)=>{setSelectedRange(range);setChosenId(range.start);setSurahText(String(verseAt(range.start).surah));setFirstText(String(verseAt(range.start).ayah));setLastText(String(verseAt(range.end).surah===verseAt(range.start).surah?verseAt(range.end).ayah:verseAt(range.start).ayah));setSelection(verseAt(range.start).surah===verseAt(range.end).surah?'custom':'session');};
  const selectedSurah=surahs[Number(surahText)-1];
  const stepper=(title:string,value:string,set:(v:string)=>void)=><View style={{flex:1}}><Label style={{fontSize:12,color:colors.muted}}>{title}</Label><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Pressable onPress={()=>set(String(Math.max(1,Number(value)-1)))} style={{padding:8,backgroundColor:colors.soft,borderRadius:8}}><Label>−</Label></Pressable><View style={{flex:1}}><Field value={value} onChangeText={set} placeholder="1" keyboardType="number-pad" /></View><Pressable onPress={()=>set(String(Math.min(selectedSurah?.count??1,Number(value)+1)))} style={{padding:8,backgroundColor:colors.soft,borderRadius:8}}><Label>+</Label></Pressable></View></View>;
  return <>
    {dock==='hidden'&&<Pressable accessibilityLabel="Rouvrir le lecteur audio" onPress={()=>setDock('expanded')} style={{alignSelf:'flex-end',backgroundColor:colors.green,paddingVertical:9,paddingHorizontal:15,borderRadius:22}}><Text style={{color:'white',fontWeight:'700'}}>♪ {playing?'Ⅱ':'▶'}</Text></Pressable>}
    {dock==='mini'&&<View {...drag.panHandlers} style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:5}}><Pressable onPress={()=>setDock('expanded')} style={{flex:1}}><Label style={{fontWeight:'700',fontSize:13}}>{reference(rangeRef.current)}</Label><Label style={{color:colors.muted,fontSize:11}}>{current?`${current.repetition}/${countChoice==='continuous'||!autoStop?'∞':count}`:'Prêt à écouter'}</Label></Pressable><Pressable accessibilityLabel={playing?'Pause':'Lecture'} onPress={playPause} style={{padding:10}}><Label style={{fontSize:22,color:colors.green}}>{playing?'Ⅱ':'▶'}</Label></Pressable><Pressable accessibilityLabel="Masquer le lecteur" onPress={()=>setDock('hidden')} style={{padding:9}}><Label>⌄</Label></Pressable></View>}
    {dock==='expanded'&&<><View {...drag.panHandlers} style={{alignItems:'center',paddingVertical:7}}><View style={{width:36,height:4,borderRadius:4,backgroundColor:colors.muted}} /></View><View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{flex:1}}><Label style={{fontWeight:'700',color:colors.green}}>{current?reference(rangeRef.current):reference(selectedRange)}</Label><Label style={{fontSize:12,color:colors.muted}}>{reciter.name} · {current?`${current.repetition}/${countChoice==='continuous'||!autoStop?'∞':count}`:'Hafs ‘an ‘Âsim'}</Label></View><Pressable accessibilityLabel="Réglages audio avancés" onPress={()=>setAdvanced(!advanced)} style={{padding:9}}><Label style={{fontSize:21}}>⚙</Label></Pressable><Pressable accessibilityLabel="Réduire le lecteur" onPress={()=>setDock('mini')} style={{padding:9}}><Label style={{fontSize:22}}>⌄</Label></Pressable><Pressable accessibilityLabel="Masquer le lecteur" onPress={()=>setDock('hidden')} style={{padding:9}}><Label style={{fontSize:19}}>×</Label></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{flexGrow:0}} contentContainerStyle={{paddingBottom:10}}>
        <Pressable accessibilityLabel="Choisir le récitateur" onPress={()=>setShowReciters(!showReciters)} style={{paddingVertical:10}}><Label style={{fontWeight:'700',color:colors.green}}>Récitateur : {reciter.name} ⌄</Label></Pressable>
        {showReciters&&reciters.map(item=><Choice key={item.id} label={item.name} selected={reciter.id===item.id} onPress={()=>{if(reciter.id!==item.id){stop();setReciter(item);AsyncStorage.setItem('audio-reciter-hafs',item.id).catch(()=>{});}setShowReciters(false);}} />)}
        <Label style={{fontWeight:'700',marginTop:8}}>Choisir le passage</Label><Label style={{fontSize:12,color:colors.muted,marginTop:5}}>Sourate {selectedSurah?.name??'—'}</Label><Field value={surahText} onChangeText={value=>{setSurahText(value);setFirstText('1');setLastText('1');setSelection('custom');}} placeholder="Sourate (1–114)" keyboardType="number-pad" />
        {selection==='session'&&verseAt(selectedRange.start).surah!==verseAt(selectedRange.end).surah?<Label style={{fontSize:12,color:colors.muted,marginBottom:5}}>Passage sur plusieurs sourates : {reference(selectedRange)}</Label>:null}
        <View style={{flexDirection:'row',gap:8}}>{stepper('Du verset',firstText,value=>{setFirstText(value);setSelection('custom');})}{stepper('Au verset',lastText,value=>{setLastText(value);setSelection('custom');})}</View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>{[['Ce verset',()=>chooseRange({start:current?.verseId??pageRange(page).start,end:current?.verseId??pageRange(page).start})],['Toute la page',()=>chooseRange(pageRange(page))],['Toute la sourate',()=>chooseRange(surahAt(current?.verseId??pageRange(page).start))],['Ma séance',()=>{chooseRange(sessionRange);setSelection('session');}]] .map(([label,action])=><Pressable key={label as string} onPress={action as ()=>void} style={{padding:8,borderRadius:10,backgroundColor:colors.soft,borderWidth:1,borderColor:colors.softBorder}}><Label style={{fontSize:12,color:colors.green}}>{label as string}</Label></Pressable>)}</View>
        <Label style={{fontWeight:'700',marginTop:10}}>Répétitions</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{counts.map(value=><View key={value} style={{minWidth:54}}><Button small secondary={countChoice!==value} onPress={()=>{setCountChoice(value);if(value==='continuous')setRepeatMode('passage');}}>{countLabel(value)}</Button></View>)}</View>
        {countChoice==='custom'&&<Field value={customCount} onChangeText={setCustomCount} placeholder="Nombre personnalisé (1 à 999)" keyboardType="number-pad" />}
        <View style={{flexDirection:'row',gap:6}}><View style={{flex:1}}><Button small secondary={repeatMode!=='passage'} onPress={()=>setRepeatMode('passage')}>Passage complet</Button></View><View style={{flex:1}}><Button small secondary={repeatMode!=='each-verse'} onPress={()=>{setRepeatMode('each-verse');if(countChoice==='continuous')setCountChoice(3);}}>Chaque verset</Button></View></View>
        <Button onPress={begin}>▶ Lancer ce passage</Button>
        {advanced&&<><Label style={{fontWeight:'700'}}>Vitesse</Label><View style={{flexDirection:'row',gap:6}}>{([0.75,1,1.25] as const).map(value=><View key={value} style={{flex:1}}><Button small secondary={speed!==value} onPress={()=>setSpeed(value)}>{String(value).replace('.',',')}×</Button></View>)}</View><Label style={{fontWeight:'700'}}>Pause entre deux écoutes</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{[0,2,5,10].map(value=><View key={value} style={{minWidth:66}}><Button small secondary={gap!==value} onPress={()=>setGap(value)}>{value?`${value} s`:'Aucune'}</Button></View>)}</View><Choice label="Arrêter à la fin des écoutes" selected={autoStop&&countChoice!=='continuous'} onPress={()=>setAutoStop(!autoStop)} /><Button small secondary onPress={()=>current?startAt({verseId:rangeRef.current.start,repetition:1}):begin()}>Recommencer le passage</Button></>}
        {error?<Label style={{color:colors.red,marginVertical:6}}>{error}</Label>:null}
      </ScrollView>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:16}}><Pressable accessibilityLabel="Verset précédent" onPress={()=>jump(-1)} style={{padding:10}}><Label style={{fontSize:25,color:colors.green}}>‹</Label></Pressable><Pressable accessibilityLabel={playing?'Pause':'Lecture'} onPress={playPause} style={{backgroundColor:colors.green,borderRadius:28,width:52,height:52,alignItems:'center',justifyContent:'center'}}><Text style={{color:'white',fontSize:22}}>{loading?'…':playing?'Ⅱ':'▶'}</Text></Pressable><Pressable accessibilityLabel="Verset suivant" onPress={()=>jump(1)} style={{padding:10}}><Label style={{fontSize:25,color:colors.green}}>›</Label></Pressable><Pressable accessibilityLabel="Arrêter la lecture" onPress={stop} style={{padding:10}}><Label style={{fontSize:12}}>Arrêt</Label></Pressable></View>
    </>}
  </>;
}
