import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,View} from 'react-native';
import {createAudioPlayer} from 'expo-audio';
import {Button,Card,colors,Label,Title} from './ui/theme';
import {reference,verseAt,surahs} from './core/quran';
import {deleteLocalRecitation,deleteMyRecitation,GeneralFeedback,listCorrections,listGeneralFeedback,listRemoteRecitations,localRecitationAnalysis,localRecitations,LocalRecitation,RemoteRecitation,signedAudioUrl,syncPendingRecitations,VerseCorrection} from './services/recitations';
import {FriendLink,listFriendLinks,shareRecitation} from './services/social';
import {supabase} from './services/sync';
import {setRecitationsVisible} from './services/notifications';
import {FriendAvatar} from './ui/FriendAvatar';

const fmt=(ms:number)=>`${Math.floor(ms/60000)}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
export function RecitationsScreen({onClose,initialRecitationId}:{onClose:()=>void;initialRecitationId?:string|null}){
  const [local,setLocal]=useState<LocalRecitation[]>([]),[remote,setRemote]=useState<RemoteRecitation[]>([]);
  const [selected,setSelected]=useState<RemoteRecitation|null>(null),[corrections,setCorrections]=useState<VerseCorrection[]>([]),[feedback,setFeedback]=useState<GeneralFeedback[]>([]);
  const [message,setMessage]=useState(''),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0);
  const [friends,setFriends]=useState<FriendLink[]>([]),[sharing,setSharing]=useState<string|null>(null);
  const player=useRef<ReturnType<typeof createAudioPlayer>|null>(null);
  useEffect(()=>()=>{player.current?.release();},[]);
  useEffect(()=>{setRecitationsVisible(true);return()=>setRecitationsVisible(false);},[]);
  useEffect(()=>{const timer=setInterval(()=>{if(player.current)setPosition(player.current.currentTime);},500);return()=>clearInterval(timer);},[]);
  const load=async()=>{
    if(!supabase){setMessage('Connecte-toi pour retrouver tes récitations.');return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setMessage('Connecte-toi dans Profil pour retrouver tes récitations.');return;}
    setLocal(localRecitations(session.user.id));
    try{await syncPendingRecitations();setLocal(localRecitations(session.user.id));const [recordings,links]=await Promise.all([listRemoteRecitations(),listFriendLinks()]);setRemote(recordings);setFriends(links.filter(link=>link.status==='accepted'));setMessage('');}
    catch(error){setMessage(`Les fichiers locaux restent disponibles. ${String(error)}`);}
  };
  useEffect(()=>{load().catch(error=>setMessage(String(error)));},[]);
  const open=async(item:RemoteRecitation)=>{player.current?.release();player.current=null;setPlaying(false);setPosition(0);setSelected(item);setCorrections([]);setFeedback([]);try{const [verseRows,generalRows]=await Promise.all([listCorrections(item.id),listGeneralFeedback(item.id)]);setCorrections(verseRows);setFeedback(generalRows);}catch(error){setMessage(String(error));}};
  useEffect(()=>{const item=remote.find(row=>row.id===initialRecitationId);if(item&&selected?.id!==item.id){open(item).catch(error=>setMessage(String(error)));setSharing(item.id);}},[remote,initialRecitationId]);
  useEffect(()=>{if(!initialRecitationId||remote.some(row=>row.id===initialRecitationId))return;let attempts=0;const timer=setInterval(()=>{if(++attempts>10){clearInterval(timer);return;}load().catch(()=>{});},3000);return()=>clearInterval(timer);},[initialRecitationId,remote.some(row=>row.id===initialRecitationId)]);
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
  for(const item of local)if(!all.some(row=>row.id===item.id))all.push({id:item.id,user_id:item.userId,start_verse_id:item.start,end_verse_id:item.end,duration_ms:item.durationMs,storage_path:'',created_at:item.createdAt,recognition_summary:localRecitationAnalysis(item.id,item.userId)});
  all.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:50}}><Pressable onPress={onClose}><Label style={{fontSize:20}}>‹ Retour</Label></Pressable><Title>Mes récitations</Title><Label style={{color:colors.muted,marginTop:5,marginBottom:14}}>Enregistrements sauvegardés sur ce téléphone et synchronisés avec ton compte.</Label>
    <Button secondary onPress={()=>load().catch(error=>setMessage(String(error)))}>Actualiser et synchroniser</Button>
    {!!message&&<Card><Label style={{fontSize:13}}>{message}</Label></Card>}
    {all.map(item=>{const own=local.find(row=>row.id===item.id);const analysis=item.recognition_summary??(own?localRecitationAnalysis(item.id,own.userId):null);const correctionCount=selected?.id===item.id?corrections.length:0;return <Card key={item.id}><Pressable onPress={()=>open(item)}><Label style={{fontWeight:'700'}}>{reference({start:item.start_verse_id,end:item.end_verse_id})}</Label><Label style={{color:colors.muted,fontSize:12,marginTop:5}}>{new Date(item.created_at).toLocaleString('fr-FR')} · {fmt(item.duration_ms)} · {own?.syncStatus==='synced'||!own?'Synchronisé':own.syncStatus==='uploading'?'En cours d’envoi':own.syncStatus==='failed'?'Échec de synchronisation':'En attente'}</Label>{analysis&&<Label style={{fontSize:12,color:colors.muted,marginTop:5}}>Correction automatique expérimentale · {analysis.recognized} mots reconnus · {analysis.uncertain} à vérifier · {analysis.omitted} potentiellement omis</Label>}</Pressable>
      {selected?.id===item.id&&<><Button small onPress={()=>toggleAudio(item)}>{playing?'Pause':'▶ Réécouter'}</Button><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button small secondary onPress={()=>player.current?.seekTo(Math.max(0,position-10))}>− 10 s</Button></View><View style={{flex:1}}><Button small secondary onPress={()=>player.current?.seekTo(position+10)}>+ 10 s</Button></View></View><Label style={{color:colors.muted,fontSize:12}}>Position : {fmt(position*1000)} · {correctionCount||feedback.length?'Corrigée':item.listened_at?'Écoutée':'En attente de correction'}</Label>{feedback.map(row=><View key={row.id} style={{padding:9,marginTop:7,borderRadius:8,backgroundColor:colors.soft}}><Label style={{fontWeight:'700'}}>Observation générale</Label><Label>{row.comment??'Commentaire vocal du professeur'}</Label>{row.voice_path&&<Button small secondary onPress={()=>playCorrection(row.voice_path!)}>▶ Écouter le professeur</Button>}</View>)}{corrections.map(c=><View key={c.id} style={{padding:9,marginTop:7,borderRadius:8,backgroundColor:'#FCE8E8'}}><Label style={{fontWeight:'700',color:colors.red}}>{surahs[verseAt(c.verse_id).surah-1].name} · verset {verseAt(c.verse_id).ayah}</Label><Label>{c.comment??'À retravailler'}</Label>{c.voice_path&&<Button small secondary onPress={()=>playCorrection(c.voice_path!)}>▶ Écouter la correction</Button>}<Label style={{fontSize:11,color:colors.muted}}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</Label></View>)}</>}
      <Button small secondary disabled={!remote.some(row=>row.id===item.id)} onPress={()=>setSharing(sharing===item.id?null:item.id)}>Partager avec un ami</Button>
      {sharing===item.id&&<><Label style={{fontSize:12,color:colors.muted}}>Choisis un ami. L’envoi sera confirmé avant le partage.</Label>{friends.map(friend=><Pressable key={friend.id} onPress={()=>Alert.alert('Partager cette récitation ?',`Seul ${friend.other?.display_name??'cet ami'} pourra écouter ${reference({start:item.start_verse_id,end:item.end_verse_id})} tant que vous restez amis.`,[{text:'Annuler',style:'cancel'},{text:'Partager',onPress:()=>shareRecitation(friend.id,item.id,`Récitation vocale · ${reference({start:item.start_verse_id,end:item.end_verse_id})}`).then(()=>{setSharing(null);setMessage('Récitation partagée dans votre conversation.');}).catch(error=>setMessage(String(error)))}])} style={{flexDirection:'row',alignItems:'center',gap:10,padding:8,backgroundColor:colors.soft,borderRadius:12,marginTop:6}}><FriendAvatar name={friend.other?.display_name??'Ami'} path={friend.other?.avatar_path} size={34} /><Label style={{fontWeight:'700'}}>{friend.other?.display_name??'Ami'}</Label></Pressable>)}{!friends.length&&<Label>Aucun ami accepté pour le moment.</Label>}</>}
      <Button small secondary onPress={()=>Alert.alert('Supprimer cette récitation ?', 'Le fichier, ses corrections et les accès partagés seront supprimés. Cette action est définitive.',[{text:'Annuler',style:'cancel'},{text:'Supprimer',style:'destructive',onPress:()=>{const remove=remote.some(row=>row.id===item.id)?deleteMyRecitation(item):Promise.resolve(own&&deleteLocalRecitation(own));remove.then(()=>{player.current?.release();player.current=null;setSelected(null);setSharing(null);return load();}).catch(error=>setMessage(String(error)));}}])}>Supprimer</Button>
    </Card>;})}
    {!all.length&&<Card><Label>Aucune récitation enregistrée. Ouvre un passage du Coran pour enregistrer ta voix.</Label></Card>}
  </ScrollView>;
}
