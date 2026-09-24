import React,{useEffect,useRef,useState} from 'react';
import {Alert,ScrollView,View} from 'react-native';
import {Button,Card,Choice,colors,Field,Label,Title} from './ui/theme';
import {AdminNotificationHistory,AdminNotificationRecipient,listAdminNotificationHistory,listAdminNotificationRecipients,sendAdminNotification} from './services/adminNotifications';

const requestId=()=>`admin-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function AdminNotifications({onClose}:{onClose:()=>void}){
  const [recipients,setRecipients]=useState<AdminNotificationRecipient[]>([]);
  const [history,setHistory]=useState<AdminNotificationHistory[]>([]);
  const [target,setTarget]=useState<string|null>(null),[search,setSearch]=useState('');
  const [title,setTitle]=useState(''),[body,setBody]=useState('');
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const currentRequest=useRef(requestId());
  const load=async()=>{const [people,sent]=await Promise.all([listAdminNotificationRecipients(),listAdminNotificationHistory()]);setRecipients(people);setHistory(sent);};
  useEffect(()=>{load().catch(error=>setNotice(error.message??String(error)));},[]);
  const change=()=>{currentRequest.current=requestId();setNotice('');};
  const send=async()=>{
    setBusy(true);
    try{
      const result=await sendAdminNotification(target,title.trim(),body.trim(),currentRequest.current);
      setNotice(`Envoi lancé pour ${result.recipient_count} élève${result.recipient_count>1?'s':''} sur ${result.device_count} appareil${result.device_count>1?'s':''}.`);
      currentRequest.current=requestId();setTitle('');setBody('');await load();
    }catch(error:any){setNotice(error.message??String(error));}
    finally{setBusy(false);}
  };
  const confirm=()=>Alert.alert('Envoyer cette notification ?',`${target?recipients.find(item=>item.user_id===target)?.display_name??'Un élève':'Tous les élèves éligibles'}\n\n${title.trim()}\n${body.trim()}`,[{text:'Annuler',style:'cancel'},{text:'Envoyer',onPress:()=>{send().catch(()=>{});}}]);
  const filtered=recipients.filter(item=>item.display_name.toLocaleLowerCase('fr-FR').includes(search.toLocaleLowerCase('fr-FR')));
  const eligible=target?recipients.some(item=>item.user_id===target):recipients.length>0;
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:45}} keyboardShouldPersistTaps="handled">
    <Button secondary onPress={onClose}>← Modération</Button><Title>Notifications personnalisées</Title>
    <Label style={{color:colors.muted}}>Envoie un rappel ponctuel aux élèves ayant autorisé les notifications de l’application. Les préférences de chacun sont respectées.</Label>
    {notice?<Card><Label>{notice}</Label></Card>:null}
    <Card><Label style={{fontWeight:'700'}}>Destinataire</Label>
      <Choice label={`Tous les élèves éligibles (${recipients.length})`} selected={target===null} onPress={()=>{change();setTarget(null);}} />
      <Field value={search} onChangeText={setSearch} placeholder="Rechercher un élève" />
      {filtered.map(person=><Choice key={person.user_id} label={`${person.display_name} · ${person.device_count} appareil${person.device_count>1?'s':''}`} selected={target===person.user_id} onPress={()=>{change();setTarget(person.user_id);}} />)}
    </Card>
    <Card><Label style={{fontWeight:'700'}}>Rédiger le message</Label>
      <Field value={title} onChangeText={value=>{change();setTitle(value);}} placeholder="Titre (3 à 80 caractères)" maxLength={80} />
      <Field value={body} onChangeText={value=>{change();setBody(value);}} placeholder="Message (3 à 500 caractères)" multiline maxLength={500} />
      <Label style={{color:colors.muted,fontSize:12}}>Aperçu</Label>
      <View style={{padding:12,borderRadius:12,backgroundColor:colors.soft,marginVertical:8}}><Label style={{fontWeight:'700'}}>{title.trim()||'Titre de la notification'}</Label><Label>{body.trim()||'Ton message apparaîtra ici.'}</Label></View>
      <Button disabled={busy||!eligible||title.trim().length<3||body.trim().length<3} onPress={confirm}>{busy?'Envoi en cours…':'Envoyer la notification'}</Button>
    </Card>
    <Label style={{fontWeight:'700',marginTop:14}}>Derniers envois</Label>
    {history.map(item=><Card key={item.id}><Label style={{fontWeight:'700'}}>{item.title}</Label><Label>{item.body}</Label><Label style={{fontSize:12,color:colors.muted}}>{new Date(item.created_at).toLocaleString('fr-FR')} · {item.recipient_count} élève(s), {item.device_count} appareil(s) · {item.target_user_id?recipients.find(person=>person.user_id===item.target_user_id)?.display_name??'Un élève':'Tous'}</Label></Card>)}
  </ScrollView>;
}
