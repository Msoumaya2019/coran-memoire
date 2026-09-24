import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import {createAudioPlayer} from 'expo-audio';
import {Button,Card,colors,Label,Title} from './ui/theme';
import {reference,verseAt,surahs} from './core/quran';
import {GeneralFeedback,listCorrections,listGeneralFeedback,listRemoteRecitations,localRecitations,LocalRecitation,RemoteRecitation,signedAudioUrl,syncPendingRecitations,VerseCorrection} from './services/recitations';
import {supabase} from './services/sync';

const fmt=(ms:number)=>`${Math.floor(ms/60000)}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
export function RecitationsScreen({onClose}:{onClose:()=>void}){
  const [local,setLocal]=useState<LocalRecitation[]>([]),[remote,setRemote]=useState<RemoteRecitation[]>([]);
  const [selected,setSelected]=useState<RemoteRecitation|null>(null),[corrections,setCorrections]=useState<VerseCorrection[]>([]),[feedback,setFeedback]=useState<GeneralFeedback[]>([]);
  const [message,setMessage]=useState(''),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0);
  const player=useRef<ReturnType<typeof createAudioPlayer>|null>(null);
  useEffect(()=>()=>{player.current?.release();},[]);
  useEffect(()=>{const timer=setInterval(()=>{if(player.current)setPosition(player.current.currentTime);},500);return()=>clearInterval(timer);},[]);
  const load=async()=>{
    if(!supabase){setMessage('Connecte-toi pour retrouver tes récitations.');return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setMessage('Connecte-toi dans Profil pour retrouver tes récitations.');return;}
    setLocal(localRecitations(session.user.id));
    try{await syncPendingRecitations();setLocal(localRecitations(session.user.id));setRemote(await listRemoteRecitations());setMessage('');}
    catch(error){setMessage(`Les fichiers locaux restent disponibles. ${String(error)}`);}
  };
  useEffect(()=>{load().catch(error=>setMessage(String(error)));},[]);
  const open=async(item:RemoteRecitation)=>{player.current?.release();player.current=null;setPlaying(false);setPosition(0);setSelected(item);setCorrections([]);setFeedback([]);try{const [verseRows,generalRows]=await Promise.all([listCorrections(item.id),listGeneralFeedback(item.id)]);setCorrections(verseRows);setFeedback(generalRows);}catch(error){setMessage(String(error));}};
  const playCorrection=async(path:string)=>{try{player.current?.release();const uri=await signedAudioUrl(path);player.current=createAudioPlayer({uri});player.current.play();setPlaying(true);}catch(error){setMessage(String(error));}};
  const toggleAudio=async(item:RemoteRecitation)=>{
    if(playing){player.current?.pause();setPlaying(false);return;}
    if(player.current){player.current.play();setPlaying(true);return;}
    try{
      const file=local.find(row=>row.id===item.id);
      const uri=file?.uri??await signedAudioUrl(item.storage_path);
      player.current=createAudioPlayer({uri});player.current.play();setPlaying(true);
    }catch(error){setMessage(`Lecture impossible : ${String(error)}`);}
  };
  const all=[...remote];
  for(const item of local)if(!all.some(row=>row.id===item.id))all.push({id:item.id,user_id:item.userId,start_verse_id:item.start,end_verse_id:item.end,duration_ms:item.durationMs,storage_path:'',created_at:item.createdAt});
  all.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:50}}><Pressable onPress={onClose}><Label style={{fontSize:20}}>‹ Retour</Label></Pressable><Title>Mes récitations</Title><Label style={{color:colors.muted,marginTop:5,marginBottom:14}}>Enregistrements sauvegardés sur ce téléphone et synchronisés avec ton compte.</Label>
    <Button secondary onPress={()=>load().catch(error=>setMessage(String(error)))}>Actualiser et synchroniser</Button>
    {!!message&&<Card><Label style={{fontSize:13}}>{message}</Label></Card>}
    {all.map(item=>{const own=local.find(row=>row.id===item.id);const correctionCount=selected?.id===item.id?corrections.length:0;return <Card key={item.id}><Pressable onPress={()=>open(item)}><Label style={{fontWeight:'700'}}>{reference({start:item.start_verse_id,end:item.end_verse_id})}</Label><Label style={{color:colors.muted,fontSize:12,marginTop:5}}>{new Date(item.created_at).toLocaleString('fr-FR')} · {fmt(item.duration_ms)} · {own?.syncStatus==='synced'||!own?'Synchronisé':own.syncStatus==='uploading'?'En cours d’envoi':own.syncStatus==='failed'?'Échec de synchronisation':'En attente'}</Label></Pressable>
      {selected?.id===item.id&&<><Button small onPress={()=>toggleAudio(item)}>{playing?'Pause':'▶ Réécouter'}</Button><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button small secondary onPress={()=>player.current?.seekTo(Math.max(0,position-10))}>− 10 s</Button></View><View style={{flex:1}}><Button small secondary onPress={()=>player.current?.seekTo(position+10)}>+ 10 s</Button></View></View><Label style={{color:colors.muted,fontSize:12}}>Position : {fmt(position*1000)} · {correctionCount||feedback.length?'Corrigée':item.listened_at?'Écoutée':'En attente de correction'}</Label>{feedback.map(row=><View key={row.id} style={{padding:9,marginTop:7,borderRadius:8,backgroundColor:colors.soft}}><Label style={{fontWeight:'700'}}>Observation générale</Label><Label>{row.comment??'Commentaire vocal du professeur'}</Label>{row.voice_path&&<Button small secondary onPress={()=>playCorrection(row.voice_path!)}>▶ Écouter le professeur</Button>}</View>)}{corrections.map(c=><View key={c.id} style={{padding:9,marginTop:7,borderRadius:8,backgroundColor:'#FCE8E8'}}><Label style={{fontWeight:'700',color:colors.red}}>{surahs[verseAt(c.verse_id).surah-1].name} · verset {verseAt(c.verse_id).ayah}</Label><Label>{c.comment??'À retravailler'}</Label>{c.voice_path&&<Button small secondary onPress={()=>playCorrection(c.voice_path!)}>▶ Écouter la correction</Button>}<Label style={{fontSize:11,color:colors.muted}}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</Label></View>)}</>}
    </Card>;})}
    {!all.length&&<Card><Label>Aucune récitation enregistrée. Ouvre un passage du Coran pour enregistrer ta voix.</Label></Card>}
  </ScrollView>;
}
