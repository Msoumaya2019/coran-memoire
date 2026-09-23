import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,KeyboardAvoidingView,PanResponder,Platform,ScrollView,Share,TextInput,View} from 'react-native';
import {Button,Card,CheckChoice,Choice,colors,Field,Label,Title} from './ui/theme';
import {reference} from './core/quran';
import {currentUser,supabase} from './services/sync';
import * as social from './services/social';
import {setActiveConversation,updatePushPresence} from './services/notifications';

const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
const heading=(title:string)=><Label style={{fontSize:18,fontWeight:'700',color:colors.green,marginTop:18,marginBottom:8}}>{title}</Label>;

export function FriendsScreen({onClose,initialLinkId,initialCode,shareText}:{onClose:()=>void;initialLinkId?:string|null;initialCode?:string|null;shareText:string}){
  const [profile,setProfile]=useState<social.FriendProfile|null>(null);
  const [links,setLinks]=useState<social.FriendLink[]>([]);
  const [groups,setGroups]=useState<social.FriendGroup[]>([]);
  const [selected,setSelected]=useState<{id:string;kind:'link'|'group';name:string}|null>(null);
  const [overview,setOverview]=useState<social.FriendOverview|null>(null);
  const [messages,setMessages]=useState<social.ChatMessage[]>([]);
  const [members,setMembers]=useState<social.GroupMember[]>([]);
  const [sharedGoals,setSharedGoals]=useState<social.SharedGoal[]>([]);
  const [appointments,setAppointments]=useState<social.ReviewAppointment[]>([]);
  const [suspension,setSuspension]=useState<social.SocialSuspension|null>(null);
  const [myId,setMyId]=useState('');
  const [code,setCode]=useState(initialCode??''),[groupName,setGroupName]=useState('');
  const scrollRef=useRef<ScrollView>(null);
  const [draft,setDraft]=useState(''),[reason,setReason]=useState(''),[reportTarget,setReportTarget]=useState('');
  const [targetSessions,setTargetSessions]=useState('3'),[appointmentText,setAppointmentText]=useState('');
  const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const backSwipe=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,gesture)=>Platform.OS==='ios'&&gesture.x0<26&&gesture.dx>22&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.4,onPanResponderRelease:(_,gesture)=>{if(gesture.dx<75)return;if(selected){setSelected(null);setOverview(null);}else onClose();}}),[selected,onClose]);
  const room=selected?.kind==='link'?{linkId:selected.id}:{groupId:selected?.id};
  const load=async()=>{
    const user=await currentUser();setMyId(user?.id??'');
    const p=await social.ensureSocialProfile();setProfile(p);
    const [l,g,s]=await Promise.all([social.listFriendLinks(),social.listGroups(),social.mySocialSuspension()]);
    setLinks(l);setGroups(g);setSuspension(s);
  };
  const loadRoom=async()=>{
    if(!selected)return;
    setMessages(await social.listMessages(selected.kind==='link'?{linkId:selected.id}:{groupId:selected.id}));
    if(selected.kind==='link')await social.markConversationRead(selected.id);
    if(selected.kind==='group')setMembers(await social.listGroupMembers(selected.id));
    else{const [goals,dates]=await Promise.all([social.listSharedGoals(selected.id),social.listAppointments(selected.id)]);setSharedGoals(goals);setAppointments(dates);
      const link=links.find(l=>l.id===selected.id);if(link) setOverview(await social.friendOverview(link.requester_id===myId?link.recipient_id:link.requester_id));}
  };
  const act=async(fn:()=>Promise<unknown>,message='Enregistré.')=>{
    setBusy(true);try{await fn();setNotice(message);await load();if(selected)await loadRoom();}
    catch(e){setNotice(errorText(e));}finally{setBusy(false);}
  };
  useEffect(()=>{load().catch(e=>setNotice(errorText(e)));},[]);
  useEffect(()=>{if(initialCode)setCode(initialCode);},[initialCode]);
  useEffect(()=>{if(!initialLinkId)return;const link=links.find(item=>item.id===initialLinkId&&item.status==='accepted');if(link&&selected?.id!==link.id)setSelected({id:link.id,kind:'link',name:link.other?.display_name??'Ami'});},[initialLinkId,links]);
  useEffect(()=>{const linkId=selected?.kind==='link'?selected.id:null;setActiveConversation(linkId);
    const timer=linkId?setInterval(()=>updatePushPresence(linkId).catch(()=>{}),20000):null;
    return()=>{if(timer)clearInterval(timer);setActiveConversation(null);};
  },[selected?.id,selected?.kind]);
  useEffect(()=>{if(!selected)return;loadRoom().catch(e=>setNotice(errorText(e)));
    const filter=selected.kind==='link'?`link_id=eq.${selected.id}`:`group_id=eq.${selected.id}`;
    const channel=supabase?.channel(`friend-room-${selected.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_messages',filter},()=>loadRoom().catch(()=>{})).subscribe();
    const timer=setInterval(()=>loadRoom().catch(()=>{}),30000);return()=>{clearInterval(timer);if(channel)supabase?.removeChannel(channel);};
  },[selected?.id,selected?.kind]);
  const openLink=async(link:social.FriendLink)=>{
    setSelected({id:link.id,kind:'link',name:link.other?.display_name??'Ami'});
    setOverview(await social.friendOverview(link.other!.id));
  };
  const otherId=(link:social.FriendLink)=>link.requester_id===myId?link.recipient_id:link.requester_id;
  const sender=(id:string)=>id===myId?'Moi':members.find(m=>m.user_id===id)?.profile?.display_name??links.find(l=>otherId(l)===id)?.other?.display_name??'Membre';
  const send=()=>act(async()=>{await social.sendMessage(room,draft);setDraft('');},'Message envoyé.');
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} {...backSwipe.panHandlers}>
    <ScrollView ref={scrollRef} style={{flex:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,paddingBottom:45}}>
    <Button secondary onPress={selected?()=>{setSelected(null);setOverview(null);}:onClose}>← {selected?'Mes amis':'Profil'}</Button>
    <Title>{selected?selected.name:'Mes amis'}</Title>
    {notice?<Card><Label>{notice}</Label></Card>:null}
    {!selected?<>
      {!profile?<Card><Label>Connecte-toi à ton compte pour utiliser les amis.</Label></Card>:<>
        <Card><Label style={{fontWeight:'700'}}>Mon code d’invitation</Label><Label style={{fontSize:23,color:colors.green,marginVertical:8}}>{profile.invite_code}</Label><Label style={{fontSize:12,color:colors.muted}}>Partage ce code uniquement avec la personne que tu souhaites inviter.</Label><Button small secondary onPress={()=>Share.share({message:`Rejoins-moi sur Mon Coran Mémoire : coranmemoire://friend/${profile.invite_code}`}).catch(e=>setNotice(errorText(e)))}>Partager mon lien d’invitation</Button></Card>
        {heading('Mon profil partagé')}
        <Label style={{color:colors.muted,fontSize:13,marginBottom:8}}>Ton prénom, modifiable dans Profil, apparaît sur les invitations.</Label>
        <CheckChoice label="Afficher ma présence en ligne" selected={profile.share_online} onPress={()=>act(()=>social.updateSocialProfile({...profile,share_online:!profile.share_online}))} />
        <CheckChoice label="Partager ma progression avec mes amis" selected={profile.share_progress} onPress={()=>act(()=>social.updateSocialProfile({...profile,share_progress:!profile.share_progress}))} />
        <CheckChoice label="Afficher mon passage actuel" selected={profile.share_location} onPress={()=>act(()=>social.updateSocialProfile({...profile,share_location:!profile.share_location}))} />
        {heading('Inviter un ami')}
        <Field value={code} onChangeText={setCode} placeholder="Code d’invitation" />
        <Button disabled={busy||!code.trim()} onPress={()=>act(async()=>{await social.sendFriendRequest(code);setCode('');},'Invitation envoyée.')}>Envoyer l’invitation</Button>
        {heading('Invitations reçues')}
        {links.filter(l=>l.status==='pending'&&l.recipient_id===myId).map(l=><Card key={l.id}><Label>Invitation de {l.other?.display_name??'un membre'}</Label><Button small onPress={()=>act(()=>social.acceptFriend(l.id))}>Accepter</Button><Button small secondary onPress={()=>act(()=>social.declineFriend(l.id))}>Refuser</Button></Card>)}
        {heading('Mes amis')}
        {links.filter(l=>l.status==='accepted').map(l=><Card key={l.id}><Label style={{fontWeight:'700'}}>{l.other?.display_name??'Ami'}</Label><Button small onPress={()=>openLink(l).catch(e=>setNotice(errorText(e)))}>Voir le suivi et discuter</Button><Button small secondary onPress={()=>act(()=>social.removeFriend(l.id))}>Retirer cet ami</Button><Button small secondary onPress={()=>act(()=>social.blockFriend(otherId(l)))}>Bloquer</Button></Card>)}
        {links.filter(l=>l.status==='pending'&&l.requester_id===myId).map(l=><Card key={l.id}><Label>Invitation envoyée à {l.other?.display_name??'un membre'}</Label></Card>)}
        {links.filter(l=>l.status==='blocked'&&l.blocked_by===myId).map(l=><Card key={l.id}><Label>{l.other?.display_name??'Membre'} bloqué</Label><Button small secondary onPress={()=>act(()=>social.unblockFriend(otherId(l)))}>Débloquer</Button></Card>)}
        {heading('Cercles privés · 3 à 5 personnes')}
        <Field value={groupName} onChangeText={setGroupName} placeholder="Nom du cercle" />
        <Button secondary disabled={busy||groupName.trim().length<2} onPress={()=>act(async()=>{await social.createGroup(groupName.trim());setGroupName('');})}>Créer un cercle</Button>
        {groups.map(g=><Card key={g.id}><Label style={{fontWeight:'700'}}>{g.name}</Label><Button small onPress={()=>{setSelected({id:g.id,kind:'group',name:g.name});setOverview(null);}}>Ouvrir</Button></Card>)}
      </>}
    </>:<>
      {overview&&<Card><Label style={{fontWeight:'700'}}>{overview.display_name} · {overview.is_online?'En ligne':'Hors ligne'}</Label>{overview.goal_label?<><Label>{overview.goal_label} · objectif atteint : {overview.goal_percent} %</Label><Label>Cette semaine : {overview.weekly_verses} versets · {overview.weekly_sessions} séances</Label></>:<Label style={{color:colors.muted}}>Progression privée</Label>}{overview.current_start&&overview.current_end?<Label>Passage actuel : {reference({start:overview.current_start,end:overview.current_end})}</Label>:null}</Card>}
      {selected.kind==='link'&&<>
        {heading('Objectif partagé')}
        <Label style={{color:colors.muted,fontSize:13}}>Fixez ensemble un nombre de séances pour cette semaine. Chacun garde son propre programme.</Label>
        <Field value={targetSessions} onChangeText={setTargetSessions} placeholder="Séances cette semaine (1 à 14)" keyboardType="number-pad" />
        <Button secondary disabled={!Number.isInteger(Number(targetSessions))||Number(targetSessions)<1||Number(targetSessions)>14} onPress={()=>{
          const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
          const week=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
          act(()=>social.proposeSharedGoal(selected.id,week,Number(targetSessions)));
        }}>Proposer cet objectif</Button>
        {sharedGoals.map(g=><Card key={g.id}><Label>Semaine du {g.week_start} · {g.target_sessions} séances</Label><Label style={{fontSize:12,color:colors.muted}}>{g.accepted_at?'Accepté par vous deux':'En attente d’acceptation'}</Label>{!g.accepted_at&&g.proposed_by!==myId?<Button small onPress={()=>act(()=>social.acceptSharedGoal(g.id))}>Accepter</Button>:null}</Card>)}
        {heading('Rendez-vous de révision')}
        <Field value={appointmentText} onChangeText={setAppointmentText} placeholder="AAAA-MM-JJ HH:mm" />
        <Button secondary onPress={()=>{
          const match=appointmentText.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
          const date=match?new Date(`${match[1]}T${match[2]}:00`):null;
          if(!date||Number.isNaN(date.getTime())||date<=new Date()){setNotice('Entre une date et une heure futures au format AAAA-MM-JJ HH:mm.');return;}
          act(async()=>{await social.proposeAppointment(selected.id,date.toISOString());setAppointmentText('');});
        }}>Proposer un rendez-vous</Button>
        {appointments.map(a=><Card key={a.id}><Label>{new Date(a.starts_at).toLocaleString('fr-FR')}</Label><Label style={{fontSize:12,color:colors.muted}}>{a.accepted_at?'Confirmé':'En attente'}</Label>{!a.accepted_at&&a.proposed_by!==myId?<Button small onPress={()=>act(()=>social.acceptAppointment(a.id))}>Accepter</Button>:null}<Button small secondary onPress={()=>act(()=>social.cancelAppointment(a.id))}>Annuler</Button></Card>)}
      </>}
      {selected.kind==='group'&&<><Card><Label style={{fontWeight:'700'}}>Membres ({members.filter(m=>m.accepted_at).length}/5)</Label>{members.map(m=><View key={m.user_id}><Label>{m.profile?.display_name??'Membre'} · {m.role}{!m.accepted_at?' · invitation en attente':''}</Label>{!m.accepted_at&&m.user_id===myId?<Button small onPress={()=>act(()=>social.acceptGroupInvite(selected.id))}>Rejoindre</Button>:null}{!m.accepted_at&&m.user_id===myId?<Button small secondary onPress={()=>act(()=>social.declineGroupInvite(selected.id))}>Refuser</Button>:null}{m.user_id!==myId&&m.accepted_at&&members.some(x=>x.user_id===myId&&x.role==='owner')?<Button small secondary onPress={()=>act(()=>social.setGroupModerator(selected.id,m.user_id,m.role!=='moderator'))}>{m.role==='moderator'?'Retirer la modération':'Nommer modérateur'}</Button>:null}{m.user_id!==myId&&m.role!=='owner'&&members.some(x=>x.user_id===myId&&['owner','moderator'].includes(x.role))?<Button small secondary onPress={()=>act(()=>social.removeGroupMember(selected.id,m.user_id))}>Retirer du cercle</Button>:null}</View>)}</Card>{members.some(m=>m.user_id===myId&&['owner','moderator'].includes(m.role))&&links.filter(l=>l.status==='accepted').map(l=><Button key={l.id} small secondary onPress={()=>act(()=>social.inviteGroupMember(selected.id,otherId(l)))}>Inviter {l.other?.display_name??'un ami'}</Button>)}{members.some(m=>m.user_id===myId&&m.role==='owner')?<Button secondary onPress={()=>Alert.alert('Supprimer le cercle ?','Les messages de ce cercle seront supprimés définitivement.',[{text:'Annuler',style:'cancel'},{text:'Supprimer',style:'destructive',onPress:()=>act(async()=>{await social.deleteGroup(selected.id);setSelected(null);})}])}>Supprimer le cercle</Button>:null}</>}
      {heading('Discussion libre')}
      {suspension&&(!suspension.suspended_until||new Date(suspension.suspended_until)>new Date())?<Card><Label>Messagerie suspendue : {suspension.reason}</Label></Card>:null}
      {messages.map(m=><Card key={m.id} style={{marginLeft:m.sender_id===myId?30:0,marginRight:m.sender_id===myId?0:30,backgroundColor:m.sender_id===myId?colors.soft:colors.paper}}><Label style={{fontSize:12,color:colors.muted}}>{sender(m.sender_id)} · {new Date(m.created_at).toLocaleString('fr-FR')}</Label><Label style={{marginVertical:7}}>{m.body}</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Button small secondary onPress={()=>act(()=>social.hideMessageForMe(m.id))}>Masquer pour moi</Button>{!m.deleted_at&&(m.sender_id===myId||selected.kind==='group'&&members.some(x=>x.user_id===myId&&['owner','moderator'].includes(x.role)))?<Button small secondary onPress={()=>act(()=>social.deleteMessage(m.id))}>Supprimer</Button>:null}{!m.deleted_at&&m.sender_id!==myId?<Button small secondary onPress={()=>setReportTarget(m.id)}>Signaler</Button>:null}</View></Card>)}
      {reportTarget?<Card><Label>Signaler ce message à la modération</Label><Field value={reason} onChangeText={setReason} placeholder="Motif du signalement" /><Button small disabled={reason.trim().length<3} onPress={()=>act(async()=>{await social.reportMessage(reportTarget,reason);setReportTarget('');setReason('');},'Signalement envoyé.')}>Envoyer</Button><Button small secondary onPress={()=>setReportTarget('')}>Annuler</Button></Card>:null}
    </>}
    </ScrollView>
    {selected?<View style={{paddingHorizontal:18,paddingVertical:8,backgroundColor:colors.cream,borderTopWidth:1,borderColor:colors.line}}>
      <TextInput style={{minHeight:48,maxHeight:110,backgroundColor:colors.paper,borderWidth:1,borderColor:colors.line,borderRadius:14,padding:12,color:colors.green,textAlignVertical:'top'}} multiline maxLength={2000} value={draft} onChangeText={setDraft} onFocus={()=>setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}),200)} placeholder="Écris un message à tes amis…" placeholderTextColor={colors.muted} />
      <Button disabled={busy||!draft.trim()||!!suspension&&(!suspension.suspended_until||new Date(suspension.suspended_until)>new Date())} onPress={send}>Envoyer</Button>
      <Button secondary disabled={busy} small onPress={()=>act(()=>social.sendMessage(room,'Bravo pour ta régularité !','encouragement'),'Encouragement envoyé.')}>Envoyer un encouragement</Button>
      {selected.kind==='link'?<Button secondary disabled={busy} small onPress={()=>act(()=>social.sendMessage(room,shareText,'progress'),'Étape partagée avec cet ami.')}>Partager volontairement mon étape</Button>:null}
    </View>:null}
  </KeyboardAvoidingView>;
}

export function AdminScreen({onClose}:{onClose:()=>void}){
  const [reports,setReports]=useState<social.MessageReport[]>([]);
  const [messages,setMessages]=useState<social.ChatMessage[]>([]);
  const [suspensions,setSuspensions]=useState<social.SocialSuspension[]>([]);
  const [names,setNames]=useState<Record<string,string>>({});
  const [reason,setReason]=useState(''),[target,setTarget]=useState(''),[notice,setNotice]=useState('');
  const [duration,setDuration]=useState<'1'|'7'|'30'|'forever'>('7');
  const load=async()=>{
    if(!await social.isSocialAdmin())throw new Error('Accès administrateur refusé.');
    const [r,m,s]=await Promise.all([social.listAdminReports(),social.listAdminMessages(),social.listSocialSuspensions()]);
    setReports(r);setMessages(m);setSuspensions(s);
    const people=await social.adminProfiles([...m.map(x=>x.sender_id),...r.map(x=>x.reporter_id),...s.map(x=>x.user_id)]);
    setNames(Object.fromEntries(people.map(x=>[x.id,x.display_name])));
  };
  const act=async(fn:()=>Promise<unknown>)=>{try{await fn();await load();setNotice('Action enregistrée.');}catch(e){setNotice(errorText(e));}};
  useEffect(()=>{load().catch(e=>setNotice(errorText(e)));},[]);
  const suspend=async()=>{
    const until=duration==='forever'?null:new Date(Date.now()+Number(duration)*86400000).toISOString();
    await act(()=>social.suspendMember(target,reason.trim(),until));setTarget('');setReason('');
  };
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:45}}>
    <Button secondary onPress={onClose}>← Profil</Button><Title>Modération</Title>
    <Label style={{color:colors.muted}}>Signalements et discussions entre membres. Les actions sont vérifiées par Supabase.</Label>
    {notice?<Card><Label>{notice}</Label></Card>:null}
    <Button secondary onPress={()=>load().catch(e=>setNotice(errorText(e)))}>Actualiser</Button>
    {heading(`Signalements ouverts · ${reports.length}`)}
    {reports.map(r=>{const m=messages.find(x=>x.id===r.message_id);return <Card key={r.id}>
      <Label style={{fontWeight:'700'}}>{names[r.reporter_id]??'Membre'} a signalé un message</Label>
      <Label>Motif : {r.reason}</Label><Label>Message : {r.excerpt}</Label>
      <Label style={{fontSize:12,color:colors.muted}}>Auteur : {m?names[m.sender_id]??m.sender_id:'message plus ancien'} · {new Date(r.created_at).toLocaleString('fr-FR')}</Label>
      <Button small onPress={()=>act(async()=>{await social.deleteMessage(r.message_id);await social.resolveReport(r.id);})}>Supprimer le message et clôturer</Button>
      <Button small secondary onPress={()=>act(()=>social.resolveReport(r.id))}>Classer sans suppression</Button>
      {m?<Button small secondary onPress={()=>setTarget(m.sender_id)}>Suspendre l’auteur</Button>:null}
    </Card>;})}
    {target?<Card><Label style={{fontWeight:'700'}}>Suspendre {names[target]??'ce membre'} de la messagerie</Label>
      <Field value={reason} onChangeText={setReason} placeholder="Motif (obligatoire)" />
      {(['1','7','30','forever'] as const).map(d=><Choice key={d} label={d==='forever'?'Sans date de fin':`${d} jour${d==='1'?'':'s'}`} selected={duration===d} onPress={()=>setDuration(d)} />)}
      <Button disabled={reason.trim().length<3} onPress={suspend}>Confirmer la suspension</Button><Button secondary onPress={()=>setTarget('')}>Annuler</Button>
    </Card>:null}
    {heading('Suspensions actives')}
    {suspensions.filter(s=>!s.suspended_until||new Date(s.suspended_until)>new Date()).map(s=><Card key={s.user_id}>
      <Label style={{fontWeight:'700'}}>{names[s.user_id]??s.user_id}</Label><Label>{s.reason}</Label>
      <Label style={{fontSize:12,color:colors.muted}}>{s.suspended_until?`Jusqu’au ${new Date(s.suspended_until).toLocaleDateString('fr-FR')}`:'Sans date de fin'}</Label>
      <Button small secondary onPress={()=>act(()=>social.unsuspendMember(s.user_id))}>Lever la suspension</Button>
    </Card>)}
    {heading('Messages récents')}
    {messages.map(m=><Card key={m.id}><Label style={{fontSize:12,color:colors.muted}}>{names[m.sender_id]??m.sender_id} · {new Date(m.created_at).toLocaleString('fr-FR')}</Label><Label>{m.body}</Label>{!m.deleted_at?<><Button small secondary onPress={()=>act(()=>social.deleteMessage(m.id))}>Supprimer</Button><Button small secondary onPress={()=>setTarget(m.sender_id)}>Suspendre l’auteur</Button></>:null}</Card>)}
  </ScrollView>;
}
