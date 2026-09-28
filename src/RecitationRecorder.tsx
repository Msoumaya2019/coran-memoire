import {createManagedAudioPlayer as createAudioPlayer} from './services/audioFocus';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AudioQuality,RecordingPresets,requestRecordingPermissionsAsync,setAudioModeAsync,useAudioRecorder,useAudioRecorderState} from 'expo-audio';
import {Icon} from './ui/Premium';
import {Button,Card,colors,Label} from './ui/theme';
import {Range,reference} from './core/quran';
import {stopActiveAudio} from './services/audioFocus';
import type {DailyContent} from './services/dailyContents';
import {supabase} from './services/sync';
import {LocalRecitation,saveLocalRecitation,syncPendingRecitations} from './services/recitations';

const recordingOptions={...RecordingPresets.HIGH_QUALITY,numberOfChannels:1,bitRate:64000,ios:{...RecordingPresets.HIGH_QUALITY.ios,audioQuality:AudioQuality.MEDIUM}};
const duration=(ms:number)=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
const localUserId=async()=>{const {data:{session}}=await supabase!.auth.getSession();return session?.user.id;};

export function RecitationRecorder({range,invocation,onSaved,onShare,onRecordingChange,compact=false}:{range?:Range;invocation?:DailyContent;compact?:boolean;onSaved?:(item:LocalRecitation)=>void;onRecordingChange?:(active:boolean)=>void;onShare?:(item:LocalRecitation)=>void}){
  const recorder=useAudioRecorder(recordingOptions);
  const recorderState=useAudioRecorderState(recorder,250);
  const [phase,setPhase]=useState<'idle'|'recording'|'paused'|'preview'|'saved'>('idle');
  const [item,setItem]=useState<LocalRecitation|null>(null);
  const [draft,setDraft]=useState<{uri:string;durationMs:number;range?:Range;invocation?:DailyContent}|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const player=useRef<ReturnType<typeof createAudioPlayer>|null>(null);
  useEffect(()=>{onRecordingChange?.(busy||phase==='recording'||phase==='paused');},[phase,busy,onRecordingChange]);
  useEffect(()=>()=>{player.current?.release();onRecordingChange?.(false);},[onRecordingChange]);

  const begin=async()=>{
    setBusy(true);
    try{
      const userId=supabase?await localUserId():null;
      if(!userId){setMessage('Connecte-toi dans Profil pour sauvegarder et synchroniser tes récitations.');return;}
      const informed=await AsyncStorage.getItem(`recitation-info-${userId}`);
      if(informed!=='yes'){
        Alert.alert('Tes récitations','Vos récitations et prononciations enregistrées sont automatiquement sauvegardées et accessibles à l’administrateur pour permettre le suivi de votre apprentissage et vos corrections. Elles restent sur ce téléphone après synchronisation. Tu peux demander leur suppression depuis ton compte.',[
          {text:'Annuler',style:'cancel'},
          {text:'Compris, enregistrer',onPress:()=>{AsyncStorage.setItem(`recitation-info-${userId}`,'yes').then(()=>startRecording()).catch(error=>setMessage(String(error)));}},
        ]);
        return;
      }
      await startRecording();
    }catch(error){setMessage(String(error));}finally{setBusy(false);}
  };
  const recordingContext=useRef<{range?:Range;invocation?:DailyContent}>({});
  const startRecording=async()=>{
    recordingContext.current={range:range?{...range}:undefined,invocation};
    const permission=await requestRecordingPermissionsAsync();
    if(!permission.granted){setMessage('Autorise le microphone dans les réglages du téléphone.');return;}
    stopActiveAudio();
    player.current?.pause();
    await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');setMessage('');
  };
  const finish=async(save:boolean)=>{
    if(phase!=='recording'&&phase!=='paused')return;
    setBusy(true);
    try{
      const durationMs=recorder.getStatus().durationMillis;
      await recorder.stop();
      await setAudioModeAsync({allowsRecording:false});
      setPhase('idle');
      if(!save){setMessage('Enregistrement annulé. Rien n’a été envoyé.');return;}
      const userId=supabase?await localUserId():null;
      if(!userId||!recorder.uri)throw new Error('Compte ou fichier audio indisponible.');
      if(invocation||compact){setDraft({uri:recorder.uri,durationMs,...recordingContext.current});setPhase('preview');return;}
      const saved=await saveLocalRecitation(recorder.uri,range!.start,range!.end,durationMs,userId);
      setItem(saved);setPhase('saved');setMessage('Enregistré sur ce téléphone. Synchronisation automatique en cours.');onSaved?.(saved);
      syncPendingRecitations().then(()=>setMessage('Synchronisation tentée. Consulte Mes récitations pour vérifier le statut.')).catch(()=>setMessage('En attente de connexion pour la synchronisation.'));
    }catch(error){setMessage(String(error));}finally{setBusy(false);}
  };
  const saveDraft=async()=>{if(!draft||(!draft.invocation&&!draft.range))return;setBusy(true);try{const userId=await localUserId();if(!userId)throw new Error('Connexion requise.');const saved=await saveLocalRecitation(draft.uri,draft.invocation?0:draft.range!.start,draft.invocation?0:draft.range!.end,draft.durationMs,userId,draft.invocation);setItem(saved);setDraft(null);setPhase('saved');onSaved?.(saved);await syncPendingRecitations();setMessage('Sauvegardé. Consulte Mes récitations pour le statut de synchronisation.');}catch(e){setMessage(String(e));}finally{setBusy(false);}};
  const playback=()=>{
    if(!item&&!draft)return;
    player.current?.release();player.current=createAudioPlayer({uri:item?.uri??draft!.uri});player.current.play();
  };
  const restart=()=>{player.current?.pause();setDraft(null);setItem(null);setPhase('idle');setMessage('');};
  if(compact){
    const action=(label:string,icon:React.ComponentProps<typeof Icon>['name'],press:()=>void,primary=false)=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={press} style={{flex:1,minHeight:44,paddingHorizontal:4,borderRadius:14,backgroundColor:primary?colors.green:colors.soft,alignItems:'center',justifyContent:'center',opacity:busy?0.5:1}}><Icon name={icon} size={18} color={primary?'white':colors.green}/><Label style={{fontSize:11,textAlign:'center',color:primary?'white':colors.green}}>{label}</Label></Pressable>;
    return <View><Label style={{fontSize:13,color:phase==='recording'?colors.red:colors.muted,marginBottom:8}}>{phase==='recording'?'● Enregistrement':phase==='paused'?'En pause':phase==='preview'?'Prêt à réécouter':phase==='saved'?'Récitation enregistrée':'Enregistrement personnel'}{phase!=='idle'?' · '+duration(draft?.durationMs??item?.durationMs??recorderState.durationMillis):''}</Label><View style={{flexDirection:'row',gap:6}}>
      {phase==='idle'&&action('Commencer','microphone',begin,true)}
      {phase==='recording'&&action('Pause','pause',()=>{recorder.pause();setPhase('paused');})}
      {phase==='paused'&&action('Reprendre','play',()=>{recorder.record();setPhase('recording');})}
      {(phase==='recording'||phase==='paused')&&<>{action('Terminer','stop',()=>finish(true),true)}{action('Annuler','close',()=>finish(false))}</>}
      {phase==='preview'&&<>{action('Réécouter','play',playback)}{action('Recommencer','refresh',restart)}{action('Enregistrer','check',saveDraft,true)}</>}
      {phase==='saved'&&<>{action('Réécouter','play',playback)}{action('Recommencer','refresh',restart)}{item&&onShare&&action('Partager','share-variant',()=>onShare(item))}</>}
    </View>{!!message&&<Label numberOfLines={2} style={{fontSize:11,color:colors.muted,marginTop:6}}>{message}</Label>}</View>;
  }
  return <Card><Label style={{fontWeight:'700',fontSize:17}}>{invocation?'Ma prononciation':'Enregistrer ma voix'}</Label><Label style={{color:colors.muted,fontSize:13,marginTop:5}}>{invocation?invocation.title??'Invocation':range?reference(range):''} · enregistrement personnel</Label>
    {(phase==='recording'||phase==='paused')&&<Label style={{fontSize:20,color:colors.red,marginTop:10}}>{phase==='recording'?'● Enregistrement':'Ⅱ En pause'} · {duration(recorderState.durationMillis)}</Label>}
    {!!invocation&&<><Label style={{fontSize:28,lineHeight:48,textAlign:'center',writingDirection:'rtl'}}>{invocation.arabic_text}</Label><Label style={{textAlign:'center',color:colors.muted}}>{invocation.phonetic_text}</Label></>}
    {phase==='preview'&&<><Button secondary onPress={playback}>Réécouter avant sauvegarde</Button><Button secondary onPress={()=>{player.current?.pause();setDraft(null);setPhase('idle');}}>Recommencer</Button><Button disabled={busy} onPress={saveDraft}>Enregistrer</Button></>}
    {phase==='idle'&&<Button disabled={busy} onPress={begin}>● Enregistrer ma voix</Button>}
    {phase==='recording'&&<Button secondary disabled={busy} onPress={()=>{recorder.pause();setPhase('paused');}}>Pause</Button>}
    {phase==='paused'&&<Button secondary disabled={busy} onPress={()=>{recorder.record();setPhase('recording');}}>Reprendre</Button>}
    {(phase==='recording'||phase==='paused')&&<><Button disabled={busy} onPress={()=>finish(true)}>{invocation?'Arrêter':'Terminer et sauvegarder'}</Button><Button secondary disabled={busy} onPress={()=>finish(false)}>Supprimer cet enregistrement</Button></>}
    {phase==='saved'&&<><Button secondary onPress={playback}>Réécouter</Button>{item&&onShare&&<Button secondary onPress={()=>onShare(item)}>Partager avec un ami</Button>}<Button secondary onPress={()=>{player.current?.pause();setItem(null);setPhase('idle');}}>Enregistrer une autre récitation</Button></>}
    {!!message&&<Label style={{color:colors.muted,fontSize:12,marginTop:8}}>{message}</Label>}
  </Card>;
}
