import {useEffect,useRef,useState} from 'react';
import {AppState,Image} from 'react-native';
import {setAudioModeAsync} from 'expo-audio';
import {createManagedAudioPlayer,observeAudioFocusLost} from './audioFocus';
import {cachedRoqyas,deleteRoqyaDownload,downloadRoqya,fetchRoqyas,loadRoqyaLibrary,observeRoqyaDownloads,roqyaError,roqyaPlaybackUrl,saveRoqyaLibrary} from './roqya';
import {resumeRoqyaPosition,Roqya,RoqyaAudio,RoqyaLibrary,selectedRoqyaAudio} from '../core/roqya';

type TimedPlayer=ReturnType<typeof createManagedAudioPlayer>&{setSleepTimer?:(seconds:number|null)=>void};
export function useRoqya(userId?:string){
 const [catalog,setCatalog]=useState<Roqya[]>(cachedRoqyas),[library,setLibrary]=useState<RoqyaLibrary>(()=>loadRoqyaLibrary(userId));
 const [current,setCurrent]=useState<{roqya:Roqya;audio:RoqyaAudio}|null>(null);
 const [playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[speed,setSpeed]=useState(1),[error,setError]=useState(''),[catalogError,setCatalogError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const [timer,setTimerState]=useState<number|'end'|null>(null),[timerRemaining,setTimerRemaining]=useState(0),[,setDownloadVersion]=useState(0);
 const operations=useRef<Promise<void>>(Promise.resolve());
 const enqueue=(fn:()=>Promise<void>|void)=>{const job=operations.current.then(fn);operations.current=job.catch(()=>{});return job;};
 const player=useRef<ReturnType<typeof createManagedAudioPlayer>|null>(null),generation=useRef(0),latest=useRef<{roqya:Roqya;audio:RoqyaAudio}|null>(null),lib=useRef(library),owner=useRef(userId),lastPosition=useRef(0),lastDuration=useRef(0),lastSaved=useRef(0),rate=useRef(1),deadline=useRef<number|'end'|null>(null),switching=useRef(false),didListen=useRef(false),pendingResume=useRef<{generation:number;position:number;play:boolean}|null>(null);
 const remember=()=>{const active=latest.current;if(!active||!didListen.current)return;const saved={...lib.current,listens:{...lib.current.listens,[active.audio.id]:{audioId:active.audio.id,position:lastPosition.current,duration:lastDuration.current,listenedAt:new Date().toISOString()}}};lib.current=saved;saveRoqyaLibrary(saved,owner.current);setLibrary(saved);};
 const persist=(value:RoqyaLibrary)=>{lib.current=value;saveRoqyaLibrary(value,owner.current);setLibrary(value);};
 const timerCheck=()=>{if(typeof deadline.current==='number'){const remaining=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));setTimerRemaining(remaining);if(!remaining){pendingResume.current=null;generation.current++;player.current?.pause();deadline.current=null;setTimerState(null);setPlaying(false);remember();}}};
 const refresh=async()=>{setRefreshing(true);try{const rows=await fetchRoqyas();setCatalog(rows);setCatalogError('');const active=latest.current;if(active&&!rows.some(r=>r.id===active.roqya.id&&r.audios.some(a=>a.id===active.audio.id))){generation.current++;pendingResume.current=null;player.current?.pause();player.current?.clearLockScreenControls();remember();latest.current=null;setCurrent(null);setPlaying(false);setLoading(false);setError('Cette Roqya ou ce récitateur n’est plus disponible.');}}catch(e){setCatalogError(roqyaError(e));}finally{setRefreshing(false);}};
 useEffect(()=>{refresh();},[]);
 useEffect(()=>observeRoqyaDownloads(()=>setDownloadVersion(v=>v+1)),[]);
 useEffect(()=>{
  const p=createManagedAudioPlayer(null,{updateInterval:500,keepAudioSessionActive:true});player.current=p;
  const subscription=p.addListener('playbackStatusUpdate',status=>{
   if(!latest.current||switching.current)return;
   if(status.error){setError('Lecture interrompue. Vérifie ta connexion puis réessaie.');setLoading(false);setPlaying(false);return;}
   if(status.duration>0){lastDuration.current=status.duration;setDuration(status.duration);}
   const pending=pendingResume.current;
   if(status.isLoaded&&pending){pendingResume.current=null;const token=pending.generation;
    enqueue(()=>token===generation.current?p.seekTo(resumeRoqyaPosition(pending.position,status.duration)):undefined).then(()=>{if(token!==generation.current)return;p.setPlaybackRate(rate.current);if(pending.play){didListen.current=true;p.play();activateLockScreen();remember();}setLoading(false);}).catch(e=>{if(token===generation.current){setError(roqyaError(e));setLoading(false);}});return;
   }
   if(pending)return;
   if(status.playing)didListen.current=true;
   lastPosition.current=status.didJustFinish?0:status.currentTime;setPosition(lastPosition.current);setPlaying(status.playing);setLoading(status.isBuffering);
   timerCheck();
   if(status.didJustFinish){deadline.current=null;setTimerState(null);setPlaying(false);remember();}
   else if(Date.now()-lastSaved.current>5000&&status.playing){lastSaved.current=Date.now();remember();}
  });
  const focus=observeAudioFocusLost?.(p,()=>{generation.current++;pendingResume.current=null;switching.current=false;setPlaying(false);setLoading(false);remember();});
  const ticker=setInterval(timerCheck,1000),foreground=AppState.addEventListener('change',status=>{timerCheck();remember();if(status==='active')refresh();});
  return()=>{generation.current++;remember();pendingResume.current=null;subscription.remove();focus?.();foreground.remove();clearInterval(ticker);p.clearLockScreenControls();operations.current.finally(()=>p.release()).catch(()=>{});player.current=null;};
 },[]);
 useEffect(()=>{if(owner.current===userId)return;generation.current++;remember();player.current?.pause();player.current?.clearLockScreenControls();pendingResume.current=null;latest.current=null;setCurrent(null);setPlaying(false);setLoading(false);deadline.current=null;setTimerState(null);owner.current=userId;const saved=loadRoqyaLibrary(userId);lib.current=saved;setLibrary(saved);},[userId]);
 const nativeTimer=()=>{const p=player.current as TimedPlayer|null;if(typeof deadline.current==='number'){if(!p?.setSleepTimer){setError('La minuterie nécessite la nouvelle compilation de l’application.');deadline.current=null;setTimerState(null);return;}p.setSleepTimer(Math.max(0,(deadline.current-Date.now())/1000));}else p?.setSleepTimer?.(null);};
 const activateLockScreen=()=>{nativeTimer();const active=latest.current;if(!active||!player.current)return;const reciter=active.roqya.reciters.find(r=>r.id===active.audio.reciterId);const fallback=Image.resolveAssetSource(active.roqya.category==='sleep'?require('../../assets/roqya/sleep.png'):require('../../assets/roqya/lantern.png'))?.uri;player.current.setActiveForLockScreen(true,{title:active.roqya.title,artist:reciter?.name,albumTitle:'Roqya',artworkUrl:active.roqya.imageUrl??fallback},{showSeekBackward:true,showSeekForward:true});};
 const select=async(roqya:Roqya,audio=selectedRoqyaAudio(roqya,lib.current),autoPlay=true)=>{
  if(!audio||!catalog.some(r=>r.id===roqya.id&&r.audios.some(a=>a.id===audio.id))){setError('Cet audio n’est plus disponible.');return;}
  remember();didListen.current=false;switching.current=true;const token=++generation.current;pendingResume.current=null;player.current?.pause();player.current?.clearLockScreenControls();(player.current as TimedPlayer|null)?.setSleepTimer?.(null);setPlaying(false);setLoading(true);setError('');
  latest.current={roqya,audio};setCurrent({roqya,audio});persist({...lib.current,selected:{...lib.current.selected,[roqya.id]:audio.id}});
  lastPosition.current=resumeRoqyaPosition(lib.current.listens[audio.id]?.position??0,audio.duration);lastDuration.current=audio.duration;setPosition(lastPosition.current);setDuration(audio.duration);
  try{const uri=await roqyaPlaybackUrl(audio);if(token!==generation.current)return;
   await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true,shouldPlayInBackground:true,interruptionMode:'doNotMix'});if(token!==generation.current)return;
   await enqueue(()=>{if(token!==generation.current)return;pendingResume.current={generation:token,position:lastPosition.current,play:autoPlay};switching.current=false;player.current!.replace({uri});});if(token!==generation.current)return;
   setTimeout(()=>{if(token===generation.current&&pendingResume.current){pendingResume.current=null;setLoading(false);setError('L’audio ne répond pas. Réessaie ou utilise un téléchargement.');}},20000);
  }catch(e){if(token===generation.current){switching.current=false;setLoading(false);setError(roqyaError(e));}}
 };
 const toggle=async()=>{const active=latest.current;if(!active)return;setError('');try{if(player.current?.playing){player.current.pause();setPlaying(false);remember();}else if(player.current?.isLoaded&&!pendingResume.current){timerCheck();if(player.current.currentTime>=player.current.duration-1)await player.current.seekTo(0);player.current.setPlaybackRate(rate.current);didListen.current=true;player.current.play();activateLockScreen();setPlaying(true);remember();}else await select(active.roqya,active.audio,true);}catch(e){setError(roqyaError(e));}};
 const seek=async(seconds:number)=>{if(!player.current?.isLoaded||pendingResume.current)return;try{const token=generation.current;const value=Math.max(0,Math.min(lastDuration.current,seconds));await enqueue(()=>token===generation.current?player.current!.seekTo(value):undefined);if(token!==generation.current)return;lastPosition.current=value;setPosition(value);remember();}catch(e){setError(roqyaError(e));}};
 const changeSpeed=(value:number)=>{try{player.current?.setPlaybackRate(value);rate.current=value;setSpeed(value);}catch(e){setError(roqyaError(e));}};
 const setTimer=(minutes:number|'end'|null)=>{deadline.current=minutes==='end'?'end':minutes===null?null:Date.now()+minutes*60000;setTimerState(deadline.current);nativeTimer();timerCheck();};
 const favorite=(id:string)=>persist({...lib.current,favorites:lib.current.favorites.includes(id)?lib.current.favorites.filter(x=>x!==id):[...lib.current.favorites,id]});
 const download=async(audio:RoqyaAudio)=>{setError('');try{await downloadRoqya(audio);}catch(e){setError(roqyaError(e));}};
 const remove=async(audio:RoqyaAudio)=>{setError('');try{if(latest.current?.audio.id===audio.id){generation.current++;pendingResume.current=null;player.current?.pause();player.current?.replace(null);setPlaying(false);setLoading(false);remember();}deleteRoqyaDownload(audio);}catch(e){setError(roqyaError(e));}};
 const close=()=>{generation.current++;pendingResume.current=null;player.current?.pause();player.current?.clearLockScreenControls();remember();latest.current=null;setCurrent(null);setPlaying(false);setLoading(false);deadline.current=null;(player.current as TimedPlayer|null)?.setSleepTimer?.(null);setTimerState(null);};
 return {catalog,library,current,playing,loading,position,duration,speed,error,catalogError,refreshing,timer,timerRemaining,select,toggle,seek,changeSpeed,setTimer,favorite,download,remove,refresh,close};
}
export type RoqyaController=ReturnType<typeof useRoqya>;
