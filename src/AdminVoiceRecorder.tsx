import React,{useState} from 'react';
import {File} from 'expo-file-system';
import {AudioQuality,RecordingPresets,requestRecordingPermissionsAsync,setAudioModeAsync,useAudioRecorder,useAudioRecorderState} from 'expo-audio';
import {Button,colors,Label} from './ui/theme';
import {supabase} from './services/sync';

const options={...RecordingPresets.HIGH_QUALITY,numberOfChannels:1,bitRate:64000,ios:{...RecordingPresets.HIGH_QUALITY.ios,audioQuality:AudioQuality.MEDIUM}};
export function AdminVoiceRecorder({recitationId,onUploaded}:{recitationId:string;onUploaded:(path:string)=>void}){
  const recorder=useAudioRecorder(options),status=useAudioRecorderState(recorder,250);
  const [phase,setPhase]=useState<'idle'|'recording'|'paused'|'ready'|'uploaded'>('idle'),[fileUri,setFileUri]=useState<string|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const begin=async()=>{try{const permission=await requestRecordingPermissionsAsync();if(!permission.granted)throw new Error('Autorise le microphone.');await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record();setPhase('recording');setMessage('');}catch(error){setMessage(String(error));}};
  const finish=async()=>{try{await recorder.stop();await setAudioModeAsync({allowsRecording:false});setFileUri(recorder.uri);setPhase('ready');}catch(error){setMessage(String(error));}};
  const upload=async()=>{if(!supabase||!fileUri)return;setBusy(true);try{
    const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Compte indisponible.');
    const path=`feedback/${user.id}/${recitationId}-${Date.now()}.m4a`;
    const {error}=await supabase.storage.from('recitations').upload(path,await new File(fileUri).bytes(),{contentType:'audio/mp4',upsert:false});
    if(error)throw error;onUploaded(path);setPhase('uploaded');setMessage('Correction vocale jointe. Valide maintenant la correction.');
  }catch(error){setMessage(String(error));}finally{setBusy(false);}};
  return <><Label style={{fontWeight:'700',marginTop:9}}>Commentaire vocal</Label>{(phase==='recording'||phase==='paused')&&<Label style={{color:colors.red}}>{phase==='recording'?'● Enregistrement':'En pause'} · {Math.round(status.durationMillis/1000)} s</Label>}
    {phase==='idle'&&<Button small secondary onPress={begin}>● Enregistrer un commentaire vocal</Button>}
    {phase==='recording'&&<Button small secondary onPress={()=>{recorder.pause();setPhase('paused');}}>Pause</Button>}
    {phase==='paused'&&<Button small secondary onPress={()=>{recorder.record();setPhase('recording');}}>Reprendre</Button>}
    {(phase==='recording'||phase==='paused')&&<Button small onPress={finish}>Terminer</Button>}
    {phase==='ready'&&<><Button small disabled={busy} onPress={upload}>Joindre la correction vocale</Button><Button small secondary onPress={()=>{setFileUri(null);setPhase('idle');}}>Recommencer</Button></>}
    {phase==='uploaded'&&<Label style={{fontSize:12,color:colors.muted}}>Audio prêt pour la validation.</Label>}
    {!!message&&<Label style={{fontSize:12,color:colors.muted}}>{message}</Label>}
  </>;
}
