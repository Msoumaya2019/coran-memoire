import React,{useEffect,useRef,useState} from 'react';
import {Alert,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AudioQuality,createAudioPlayer,RecordingPresets,requestRecordingPermissionsAsync,setAudioModeAsync,useAudioRecorder,useAudioRecorderState} from 'expo-audio';
import {Button,Card,colors,Label} from './ui/theme';
import {Range,reference} from './core/quran';
import {supabase} from './services/sync';
import {LocalRecitation,saveLocalRecitation,syncPendingRecitations} from './services/recitations';

const recordingOptions={...RecordingPresets.HIGH_QUALITY,numberOfChannels:1,bitRate:64000,ios:{...RecordingPresets.HIGH_QUALITY.ios,audioQuality:AudioQuality.MEDIUM}};
const duration=(ms:number)=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
const localUserId=async()=>{const {data:{session}}=await supabase!.auth.getSession();return session?.user.id;};

export function RecitationRecorder({range,onSaved}:{range:Range;onSaved?:(item:LocalRecitation)=>void}){
  const recorder=useAudioRecorder(recordingOptions);
  const recorderState=useAudioRecorderState(recorder,250);
  const [phase,setPhase]=useState<'idle'|'recording'|'paused'|'saved'>('idle');
  const [item,setItem]=useState<LocalRecitation|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const player=useRef<ReturnType<typeof createAudioPlayer>|null>(null);
  useEffect(()=>()=>{player.current?.release();},[]);

  const begin=async()=>{
    setBusy(true);
    try{
      const userId=supabase?await localUserId():null;
      if(!userId){setMessage('Connecte-toi dans Profil pour sauvegarder et synchroniser tes récitations.');return;}
      const informed=await AsyncStorage.getItem(`recitation-info-${userId}`);
      if(informed!=='yes'){
        Alert.alert('Tes récitations','Vos récitations enregistrées sont automatiquement sauvegardées et accessibles à l’administrateur pour permettre le suivi de votre apprentissage et vos corrections. Elles restent sur ce téléphone après synchronisation. Tu peux demander leur suppression depuis ton compte.',[
          {text:'Annuler',style:'cancel'},
          {text:'Compris, enregistrer',onPress:()=>{AsyncStorage.setItem(`recitation-info-${userId}`,'yes').then(()=>startRecording()).catch(error=>setMessage(String(error)));}},
        ]);
        return;
      }
      await startRecording();
    }catch(error){setMessage(String(error));}finally{setBusy(false);}
  };
  const startRecording=async()=>{
    const permission=await requestRecordingPermissionsAsync();
    if(!permission.granted){setMessage('Autorise le microphone dans les réglages du téléphone.');return;}
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
      const saved=await saveLocalRecitation(recorder.uri,range.start,range.end,durationMs,userId);
      setItem(saved);setPhase('saved');setMessage('Enregistré sur ce téléphone. Synchronisation automatique en cours.');onSaved?.(saved);
      syncPendingRecitations().then(()=>setMessage('Synchronisation tentée. Consulte Mes récitations pour vérifier le statut.')).catch(()=>setMessage('En attente de connexion pour la synchronisation.'));
    }catch(error){setMessage(String(error));}finally{setBusy(false);}
  };
  const playback=()=>{
    if(!item)return;
    player.current?.release();player.current=createAudioPlayer({uri:item.uri});player.current.play();
  };
  return <Card><Label style={{fontWeight:'700',fontSize:17}}>Écoute ma récitation</Label><Label style={{color:colors.muted,fontSize:13,marginTop:5}}>{reference(range)} · enregistrement personnel</Label>
    {(phase==='recording'||phase==='paused')&&<Label style={{fontSize:20,color:colors.red,marginTop:10}}>{phase==='recording'?'● Enregistrement':'Ⅱ En pause'} · {duration(recorderState.durationMillis)}</Label>}
    {phase==='idle'&&<Button disabled={busy} onPress={begin}>● Enregistrer ma voix</Button>}
    {phase==='recording'&&<Button secondary disabled={busy} onPress={()=>{recorder.pause();setPhase('paused');}}>Pause</Button>}
    {phase==='paused'&&<Button secondary disabled={busy} onPress={()=>{recorder.record();setPhase('recording');}}>Reprendre</Button>}
    {(phase==='recording'||phase==='paused')&&<><Button disabled={busy} onPress={()=>finish(true)}>Terminer et sauvegarder</Button><Button secondary disabled={busy} onPress={()=>finish(false)}>Supprimer cet enregistrement</Button></>}
    {phase==='saved'&&<><Button secondary onPress={playback}>Réécouter</Button><Button secondary onPress={()=>{player.current?.pause();setItem(null);setPhase('idle');}}>Enregistrer une autre récitation</Button></>}
    {!!message&&<Label style={{color:colors.muted,fontSize:12,marginTop:8}}>{message}</Label>}
  </Card>;
}
