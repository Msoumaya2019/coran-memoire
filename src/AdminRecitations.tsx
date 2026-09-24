import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import {createAudioPlayer} from 'expo-audio';
import {Button,Card,colors,Field,Label,Title} from './ui/theme';
import {reference,surahs,verseAt} from './core/quran';
import {adminCorrectionIds,GeneralFeedback,listCorrections,listGeneralFeedback,listRemoteRecitations,markRecitationListened,publishCorrections,publishGeneralFeedback,RemoteRecitation,signedAudioUrl,VerseCorrection} from './services/recitations';
import {adminProfiles,isSocialAdmin} from './services/social';
import {AdminVoiceRecorder} from './AdminVoiceRecorder';

export function AdminRecitations({onClose}:{onClose:()=>void}){
  const [items,setItems]=useState<RemoteRecitation[]>([]),[names,setNames]=useState<Record<string,string>>({}),[corrected,setCorrected]=useState<Set<string>>(new Set());
  const [selected,setSelected]=useState<RemoteRecitation|null>(null),[selectedVerses,setSelectedVerses]=useState<number[]>([]),[comments,setComments]=useState<Record<string,string>>({}),[history,setHistory]=useState<VerseCorrection[]>([]),[feedback,setFeedback]=useState<GeneralFeedback[]>([]),[generalComment,setGeneralComment]=useState(''),[voicePath,setVoicePath]=useState<string|null>(null);
  const [filter,setFilter]=useState<'all'|'pending'|'corrected'>('pending'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0);
  const player=useRef<ReturnType<typeof createAudioPlayer>|null>(null);
  useEffect(()=>()=>{player.current?.release();},[]);
  useEffect(()=>{const timer=setInterval(()=>{if(player.current)setPosition(player.current.currentTime);},500);return()=>clearInterval(timer);},[]);
  const load=async()=>{
    if(!await isSocialAdmin())throw new Error('Accès administrateur refusé.');
    const [rows,done]=await Promise.all([listRemoteRecitations(true),adminCorrectionIds()]);
    const profiles=await adminProfiles([...new Set(rows.map(row=>row.user_id))]);
    setItems(rows);setCorrected(done);setNames(Object.fromEntries(profiles.map(profile=>[profile.id,profile.display_name])));
  };
  useEffect(()=>{load().catch(error=>setMessage(String(error)));},[]);
  const open=async(item:RemoteRecitation)=>{
    player.current?.release();player.current=null;setPlaying(false);setPosition(0);setSelected(item);setSelectedVerses([]);setComments({});setGeneralComment('');setVoicePath(null);
    try{const [verseRows,generalRows]=await Promise.all([listCorrections(item.id),listGeneralFeedback(item.id)]);setHistory(verseRows);setFeedback(generalRows);}catch(error){setMessage(String(error));}
  };
  const play=async()=>{
    if(!selected)return;
    if(playing){player.current?.pause();setPlaying(false);return;}
    if(player.current){player.current.play();setPlaying(true);return;}
    try{const uri=await signedAudioUrl(selected.storage_path);player.current=createAudioPlayer({uri});player.current.play();setPlaying(true);if(!selected.listened_at){await markRecitationListened(selected.id);setSelected({...selected,listened_at:new Date().toISOString()});setItems(rows=>rows.map(row=>row.id===selected.id?{...row,listened_at:new Date().toISOString()}:row));}}catch(error){setMessage(String(error));}
  };
  const validate=async()=>{
    if(!selected||(!selectedVerses.length&&!generalComment.trim()&&!voicePath))return;
    setBusy(true);
    try{
      if(selectedVerses.length)await publishCorrections(selected,selectedVerses.map(verseId=>({verseId,comment:comments[verseId]?.trim()||'À retravailler',voicePath})));
      if(generalComment.trim()||voicePath)await publishGeneralFeedback(selected.id,generalComment,voicePath);
      setMessage('Correction validée pour cet élève. Les versets signalés rejoindront ses révisions prioritaires.');
      setSelectedVerses([]);setComments({});setGeneralComment('');setVoicePath(null);setHistory(await listCorrections(selected.id));setFeedback(await listGeneralFeedback(selected.id));await load();
    }catch(error){setMessage(String(error));}finally{setBusy(false);}
  };
  const visible=items.filter(item=>filter==='all'||(filter==='corrected')===corrected.has(item.id));
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:55}}><Pressable onPress={onClose}><Label style={{fontSize:20}}>‹ Modération</Label></Pressable><Title>Récitations des élèves</Title><Label style={{color:colors.muted,marginBottom:12}}>Enregistrements privés synchronisés, écoutés uniquement par les administrateurs autorisés.</Label>
    <View style={{flexDirection:'row',gap:6}}>{([['all','Toutes'],['pending','En attente'],['corrected','Corrigées']] as const).map(([key,label])=><View key={key} style={{flex:1}}><Button small secondary={filter!==key} onPress={()=>setFilter(key)}>{label}</Button></View>)}</View>
    <Button secondary onPress={()=>load().catch(error=>setMessage(String(error)))}>Actualiser</Button>
    {!!message&&<Card><Label style={{fontSize:13}}>{message}</Label></Card>}
    {visible.map(item=><Card key={item.id}><Pressable onPress={()=>open(item)}><Label style={{fontWeight:'700'}}>{names[item.user_id]??'Élève'} · {reference({start:item.start_verse_id,end:item.end_verse_id})}</Label><Label style={{fontSize:12,color:colors.muted,marginTop:5}}>{new Date(item.created_at).toLocaleString('fr-FR')} · {Math.round(item.duration_ms/1000)} s · {corrected.has(item.id)?'Corrigée':item.listened_at?'Écoutée':'En attente'}</Label></Pressable>
      {selected?.id===item.id&&<><Button small onPress={play}>{playing?'Pause':'▶ Écouter'}</Button><View style={{flexDirection:'row',gap:7}}><View style={{flex:1}}><Button small secondary onPress={()=>player.current?.seekTo(Math.max(0,position-10))}>− 10 s</Button></View><View style={{flex:1}}><Button small secondary onPress={()=>player.current?.seekTo(position+10)}>+ 10 s</Button></View></View><Label style={{fontSize:12,color:colors.muted}}>Position : {Math.floor(position/60)}:{Math.floor(position%60).toString().padStart(2,'0')}</Label>
        <Label style={{fontWeight:'700',marginTop:10}}>Sélectionner les versets à retravailler</Label>
        {Array.from({length:item.end_verse_id-item.start_verse_id+1},(_,i)=>item.start_verse_id+i).map(id=>{const verse=verseAt(id),active=selectedVerses.includes(id);return <View key={id} style={{padding:8,marginTop:6,borderWidth:1,borderColor:active?colors.red:colors.line,borderRadius:10,backgroundColor:active?'#FCE8E8':colors.paper}}><Pressable onPress={()=>setSelectedVerses(active?selectedVerses.filter(v=>v!==id):[...selectedVerses,id])}><Label style={{fontWeight:'700',color:active?colors.red:colors.text}}>{active?'☑':'□'} {surahs[verse.surah-1].name} · verset {verse.ayah}</Label><Label style={{fontSize:20,lineHeight:35,textAlign:'right',writingDirection:'rtl'}}>{verse.text}</Label></Pressable>{active&&<Field value={comments[id]??''} onChangeText={value=>setComments({...comments,[id]:value})} placeholder="Commentaire sur ce verset" />}</View>;})}
        <Label style={{fontWeight:'700',marginTop:12}}>Commentaire général sur la récitation</Label><Field value={generalComment} onChangeText={setGeneralComment} placeholder="Observation générale facultative" />
        <AdminVoiceRecorder key={item.id} recitationId={item.id} onUploaded={setVoicePath} />
        <Button disabled={busy||(!selectedVerses.length&&!generalComment.trim()&&!voicePath)} onPress={validate}>Valider la correction</Button>
        {history.length>0&&<><Label style={{fontWeight:'700',marginTop:10}}>Corrections précédentes</Label>{history.map(c=><Label key={c.id} style={{fontSize:12,color:colors.muted,marginTop:5}}>Verset {verseAt(c.verse_id).ayah} · {c.comment??'Commentaire vocal'} · {new Date(c.created_at).toLocaleDateString('fr-FR')}</Label>)}</>}
        {feedback.map(row=><Label key={row.id} style={{fontSize:12,color:colors.muted,marginTop:5}}>Observation générale · {row.comment??'Commentaire vocal'} · {new Date(row.created_at).toLocaleDateString('fr-FR')}</Label>)}
      </>}
    </Card>)}
    {!visible.length&&<Card><Label>Aucune récitation dans ce filtre.</Label></Card>}
  </ScrollView>;
}
