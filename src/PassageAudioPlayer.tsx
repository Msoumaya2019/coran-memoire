import React,{useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {createAudioPlayer,setAudioModeAsync} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {audioRange,AudioPosition,nextAudioPosition,reciters,Reciter,RepeatCount,RepeatMode,resolveAudioSegment,verseAudioLabel} from './core/audio';
import {Range,reference,surahs,verseAt,verseId} from './core/quran';
import {Button,Card,Choice,colors,Field,Label} from './ui/theme';

type Selection='session'|'verse'|'custom';
const counts:(number|'custom'|'continuous')[]=[1,2,3,5,10,'custom','continuous'];
const countLabel=(value:number|'custom'|'continuous')=>value==='continuous'?'∞':value==='custom'?'Autre':String(value);

type Props={sessionRange:Range;onVerseChange?:(id:number|null)=>void};

export function PassageAudioPlayer({sessionRange,onVerseChange}:Props){
  const [open,setOpen]=useState(false);
  return <Card style={{width:'100%',marginTop:15}}><Button secondary onPress={()=>{if(open)onVerseChange?.(null);setOpen(!open);}}>{open?'Masquer le lecteur':'Écouter mon passage'}</Button>{open&&<PassageAudioControls sessionRange={sessionRange} onVerseChange={onVerseChange} />}</Card>;
}

function PassageAudioControls({sessionRange,onVerseChange}:Props){
  // Own the player so cleanup runs before release when the reader closes.
  const [player]=useState(()=>createAudioPlayer(null,{updateInterval:250}));
  const onVerseChangeRef=useRef(onVerseChange);
  onVerseChangeRef.current=onVerseChange;
  const [selection,setSelection]=useState<Selection>('session');
  const [reciter,setReciter]=useState<Reciter>(reciters[0]);
  const [chosenId,setChosenId]=useState(sessionRange.start),[surahText,setSurahText]=useState(String(surahs.find(s=>s.start<=sessionRange.start&&s.end>=sessionRange.start)?.number??1));
  const [firstText,setFirstText]=useState('1'),[lastText,setLastText]=useState('5');
  const [countChoice,setCountChoice]=useState<number|'custom'|'continuous'>(3),[customCount,setCustomCount]=useState('20');
  const [repeatMode,setRepeatMode]=useState<RepeatMode>('passage'),[gap,setGap]=useState(0),[speed,setSpeed]=useState<0.75|1|1.25>(1),[autoStop,setAutoStop]=useState(true);
  const [current,setCurrent]=useState<AudioPosition|null>(null),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const rangeRef=useRef<Range>(sessionRange),positionRef=useRef<AudioPosition|null>(null),timerRef=useRef<ReturnType<typeof setTimeout>|null>(null),pendingRef=useRef<AudioPosition|null>(null),reciterRef=useRef<Reciter>(reciter);
  reciterRef.current=reciter;
  const settingsRef=useRef({count:3 as RepeatCount,mode:'passage' as RepeatMode,gap:0,autoStop:true,speed:1});
  const finishGuard=useRef(false),isPlayingRef=useRef(false);
  const requestRef=useRef(0),mountedRef=useRef(true),sourceRef=useRef<string|null>(null),segmentEndRef=useRef<number|null>(null),pendingSeeks=useRef<Set<Promise<void>>>(new Set());
  const count:RepeatCount=countChoice==='custom'?Number(customCount):countChoice;
  settingsRef.current={count:count==='continuous'?count:Number.isInteger(count)&&count>0?count:1,mode:repeatMode,gap,autoStop,speed};

  const clearPause=()=>{if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}};
  const stop=()=>{requestRef.current++;clearPause();pendingRef.current=null;isPlayingRef.current=false;if(sourceRef.current){player.pause();player.setActiveForLockScreen(false);}finishGuard.current=false;positionRef.current=null;segmentEndRef.current=null;onVerseChangeRef.current?.(null);setCurrent(null);setPlaying(false);setLoading(false);};
  const selectionRange=():Range=>{
    if(selection==='session')return sessionRange;
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
      player.play();isPlayingRef.current=true;onVerseChangeRef.current?.(position.verseId);setPlaying(true);setLoading(false);
    }).catch(e=>{if(!mountedRef.current||request!==requestRef.current)return;isPlayingRef.current=false;setPlaying(false);setLoading(false);onVerseChangeRef.current?.(null);setError(e instanceof Error?e.message:'Lecture indisponible. Vérifie ta connexion.');});
  };
  const begin=()=>{
    try{const range=selectionRange();if(countChoice==='custom'&&(!Number.isInteger(Number(customCount))||Number(customCount)<1||Number(customCount)>999))throw new Error('Choisis entre 1 et 999 écoutes.');
      rangeRef.current=range;startAt({verseId:range.start,repetition:1});
    }catch(e){setError(e instanceof Error?e.message:'Passage invalide.');}
  };
  useEffect(()=>{
    AsyncStorage.getItem('audio-reciter-hafs').then(id=>{const saved=reciters.find(item=>item.id===id);if(saved)setReciter(saved);}).catch(()=>{});
  },[]);
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
    return()=>{mountedRef.current=false;requestRef.current++;subscription.remove();clearPause();isPlayingRef.current=false;if(sourceRef.current){player.pause();player.setActiveForLockScreen(false);}const seeks=[...pendingSeeks.current];if(seeks.length)Promise.allSettled(seeks).then(()=>player.release()).catch(()=>{});else player.release();};
  },[player]);
  useEffect(()=>{stop();rangeRef.current=sessionRange;setChosenId(sessionRange.start);},[sessionRange.start,sessionRange.end]);
  useEffect(()=>{if(current)player.setPlaybackRate(speed);},[speed]);
  const jump=(direction:-1|1)=>{if(!current)return;const id=Math.max(rangeRef.current.start,Math.min(rangeRef.current.end,current.verseId+direction));startAt({verseId:id,repetition:current.repetition});};
  return <>
    <Label style={{fontWeight:'700',fontSize:18,color:colors.green,marginTop:8}}>ÉCOUTER MON PASSAGE</Label>
    <Label style={{fontSize:13,color:colors.muted,marginBottom:8}}>{reciter.name} · Hafs ‘an ‘Âsim · lecture en ligne</Label>
    <Label style={{fontWeight:'700',marginBottom:6}}>Choisir le récitateur</Label>
    {reciters.map(item=><Choice key={item.id} label={item.name} selected={reciter.id===item.id} onPress={()=>{stop();setReciter(item);AsyncStorage.setItem('audio-reciter-hafs',item.id).catch(()=>{});}} />)}
    <Choice label="Toute la séance" selected={selection==='session'} onPress={()=>{stop();setSelection('session');}} subtitle={reference(sessionRange)} />
    <Choice label="Un verset précis" selected={selection==='verse'} onPress={()=>{stop();setSelection('verse');}} />
    {selection==='verse'&&<View style={{flexDirection:'row',gap:8,alignItems:'center',marginBottom:8}}><View style={{flex:1}}><Button secondary small onPress={()=>setChosenId(Math.max(1,chosenId-1))}>−</Button></View><Label>Verset {verseAt(chosenId).ayah}</Label><View style={{flex:1}}><Button secondary small onPress={()=>setChosenId(Math.min(6236,chosenId+1))}>+</Button></View><Label style={{color:colors.muted}}>Sourate {verseAt(chosenId).surah}</Label></View>}
    <Choice label="Sélection personnalisée" selected={selection==='custom'} onPress={()=>{stop();setSelection('custom');}} />
    {selection==='custom'&&<><Field value={surahText} onChangeText={setSurahText} placeholder="Numéro de la sourate" keyboardType="number-pad" /><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Field value={firstText} onChangeText={setFirstText} placeholder="Verset de début" keyboardType="number-pad" /></View><View style={{flex:1}}><Field value={lastText} onChangeText={setLastText} placeholder="Verset de fin" keyboardType="number-pad" /></View></View></>}
    <Label style={{fontWeight:'700',marginTop:10,marginBottom:7}}>Nombre d’écoutes</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{counts.map(value=><View key={value} style={{minWidth:66}}><Button small secondary={countChoice!==value} onPress={()=>{setCountChoice(value);if(value==='continuous')setRepeatMode('passage');}}>{countLabel(value)}</Button></View>)}</View>
    {countChoice==='custom'&&<Field value={customCount} onChangeText={setCustomCount} placeholder="Nombre personnalisé (1 à 999)" keyboardType="number-pad" />}
    <Choice label="Répéter le passage complet" selected={repeatMode==='passage'} onPress={()=>setRepeatMode('passage')} />
    <Choice label="Répéter chaque verset" selected={repeatMode==='each-verse'} onPress={()=>{setRepeatMode('each-verse');if(countChoice==='continuous')setCountChoice(3);}} />
    <Label style={{fontWeight:'700',marginTop:8}}>Pause entre deux écoutes</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{[0,2,5,10].map(value=><View key={value} style={{minWidth:66}}><Button small secondary={gap!==value} onPress={()=>setGap(value)}>{value?`${value} s`:'Aucune'}</Button></View>)}</View>
    <Label style={{fontWeight:'700',marginTop:8}}>Vitesse</Label><View style={{flexDirection:'row',gap:6}}>{([0.75,1,1.25] as const).map(value=><View key={value} style={{flex:1}}><Button small secondary={speed!==value} onPress={()=>setSpeed(value)}>{String(value).replace('.',',')}×</Button></View>)}</View>
    <Choice label="Arrêter à la fin des écoutes" selected={autoStop&&countChoice!=='continuous'} onPress={()=>setAutoStop(!autoStop)} />
    {current&&<Label style={{textAlign:'center',color:colors.green,marginVertical:8}}>{repeatMode==='passage'?'Écoute':'Répétition'} {current.repetition} {countChoice==='continuous'||!autoStop?'· en continu':`sur ${count}`} · {verseAudioLabel(current.verseId)}</Label>}
    {error?<Label style={{color:colors.red,marginVertical:6}}>{error}</Label>:null}
    <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button onPress={()=>{if(loading)return;if(current&&!playing){if(pendingRef.current){startAt(pendingRef.current);return;}clearPause();player.play();isPlayingRef.current=true;setPlaying(true);}else if(playing){player.pause();isPlayingRef.current=false;setPlaying(false);}else begin();}}>{loading?'Chargement…':playing?'Pause':current?'Reprendre':'▶ Écouter'}</Button></View><View style={{flex:1}}><Button secondary onPress={stop}>Arrêt</Button></View></View>
    <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button secondary small onPress={()=>current?startAt({verseId:rangeRef.current.start,repetition:1}):begin()}>Recommencer</Button></View><View style={{flex:1}}><Button secondary small onPress={()=>jump(-1)}>‹ Verset</Button></View><View style={{flex:1}}><Button secondary small onPress={()=>jump(1)}>Verset ›</Button></View></View>
    <Label style={{fontSize:11,color:colors.muted,marginTop:9}}>Audio : {'readId' in reciter?'MP3Quran':'Al Quran Cloud'}, {reciter.name}. Connexion nécessaire.</Label>
  </>;
}
