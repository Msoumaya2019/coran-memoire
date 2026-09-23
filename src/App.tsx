import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AppState as DeviceAppState, Image, Keyboard, Linking, PanResponder, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { applyTheme, Button, Card, CheckChoice, Choice, colors, Field, Label, Title } from './ui/theme';
import { AppState, beginnerPaces, completeSession, dateKey, dayOf, defaultState, generateProgram, goalFromPreset, goalIds, GoalPreset, goalPresetLabels, gradeRevision, intensivePaces, isRangeKnown, LearningDirection, markKnowledge, paceLabels, pacePresets, PacePreset, partialKnownRanges, postponeSession, progress, reconcileState, resetAllProgress, seedInitialRevisions, Session, stats, todayLocal, toggleKnownRange, touch, validGoal, weekdays } from './core/program';
import { pageAfterSwipe } from './core/pageNavigation';
import { expand, hizbs, juzs, normalizeRanges, pageOf, pageRange, quarters, Range, reference, surahs, verseAt, verseId, verses } from './core/quran';
import { loadState, saveState } from './services/storage';
import { changePassword, consumeAuthLink, currentUser, pullState, pushState, requestPasswordLink, signIn, signOut, supabase, syncConfigured } from './services/sync';
import { mushafImages } from './data/mushafImages';
import boundsRaw from './data/bounds.json';
import {AdminScreen,FriendsScreen} from './SocialScreens';
import {ensureSocialProfile,isSocialAdmin,publishSocialProgress,setSocialOnline,updateSocialProfile} from './services/social';
import { Notifications, notificationDestination, registerPushDevice, saveMessageNotificationPreference, scheduleLearningReminders, setMessagePresentationEnabled, testLocalNotification, unregisterPushDevice, updatePushPresence } from './services/notifications';

type Tab='Accueil'|'Coran'|'Programme'|'Progrès'|'Profil';
type Reader={range:Range;sessionId?:string;revisionId?:string};
const section=(title:string)=><Label style={{fontWeight:'700',fontSize:19,marginBottom:10,marginTop:12}}>{title}</Label>;
const percent=(n:number)=>`${Math.round(n*100)} %`;
const dateText=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});

export default function App(){return <SafeAreaProvider><AppContent /></SafeAreaProvider>;}

function AppContent(){
  const [state,setState]=useState<AppState>(()=>loadState());
  const [tab,setTab]=useState<Tab>('Accueil');
  const [reader,setReader]=useState<Reader|null>(null);
  const [page,setPage]=useState(1);
  const [masked,setMasked]=useState(false);
  const [revealed,setRevealed]=useState<number|null>(null);
  const [wizard,setWizard]=useState<number|null>(state.profile?.firstName?state.onboardingDone?null:0:-1);
  const [account,setAccount]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [socialView,setSocialView]=useState<'friends'|'admin'|null>(null);
  const [admin,setAdmin]=useState(false);
  const [passwordRecovery,setPasswordRecovery]=useState(false);
  const [pendingLinkId,setPendingLinkId]=useState<string|null>(null);
  const today=todayLocal();
  const update=(next:AppState)=>{setState(next);saveState(next);if(account){pushState(next).catch(e=>setNotice(`Synchronisation : ${e.message}`));publishSocialProgress(next).catch(()=>{});}};
  const resetAll=async()=>{
    const fresh=resetAllProgress(loadState());
    saveState(fresh);setState(fresh);setReader(null);setPage(1);setMasked(false);setRevealed(null);setTab('Accueil');setWizard(fresh.profile?.firstName?0:-1);
    setNotice('Apprentissage et révisions remis à zéro.');
    if(account)try{await pushState(fresh);await publishSocialProgress(fresh);}catch(e:any){setNotice(`Remise à zéro effectuée sur ce téléphone. Synchronisation en attente : ${e.message}`);}
  };
  useEffect(()=>{if(!state.profile?.firstName&&wizard===null)setWizard(-1);else if(!state.onboardingDone&&wizard===null)setWizard(0);},[]);
  useEffect(()=>{
    const open=(data:Record<string,unknown>|undefined)=>{const destination=notificationDestination(data);if(!destination)return;
      if(destination.kind==='program'){setReader(null);setWizard(null);setSocialView(null);setTab('Programme');}
      else setPendingLinkId(destination.linkId);
      Notifications.clearLastNotificationResponseAsync().catch(()=>{});
    };
    Notifications.getLastNotificationResponseAsync().then(response=>{if(response)open(response.notification.request.content.data);}).catch(()=>{});
    const response=Notifications.addNotificationResponseReceivedListener(event=>open(event.notification.request.content.data));
    const tokens=Notifications.addPushTokenListener(()=>registerPushDevice().catch(()=>{}));
    return()=>{response.remove();tokens.remove();};
  },[]);
  useEffect(()=>{if(account&&pendingLinkId){setReader(null);setWizard(null);setSocialView('friends');}},[account,pendingLinkId]);
  useEffect(()=>{setMessagePresentationEnabled(state.notifications?.messages!==false);},[state.notifications?.messages]);
  useEffect(()=>{
    scheduleLearningReminders(state.learningDays,state.onboardingDone&&state.notifications?.learning!==false).catch(e=>setNotice(`Rappels : ${e.message}`));
  },[state.onboardingDone,state.learningDays.join(','),state.notifications?.learning]);
  useEffect(()=>{if(!account)return;
    saveMessageNotificationPreference(state.notifications?.messages!==false).then(()=>{
      if(state.notifications?.messages!==false)return registerPushDevice();
    }).catch(e=>setNotice(`Notifications des messages : ${e.message}`));
  },[account,state.notifications?.messages]);
  useEffect(()=>{
    const handle=async(url:string)=>{try{const user=await consumeAuthLink(url);if(!user)return;
      const remote=await pullState(),local=loadState();
      const {state:restored,shouldPush}=reconcileState(local,remote);
      if(restored!==local){setState(restored);saveState(restored);}if(shouldPush)await pushState(restored);
      setAccount(user.email??user.id);setPasswordRecovery(true);setWizard(null);setTab('Profil');
      setNotice('Lien confirmé. Choisis maintenant un mot de passe.');
    }catch(e:any){setNotice(`Lien de connexion : ${e.message}`);}};
    Linking.getInitialURL().then(url=>{if(url)handle(url);}).catch(()=>{});
    const subscription=Linking.addEventListener('url',event=>{handle(event.url);});
    return()=>subscription.remove();
  },[]);
  useEffect(()=>{currentUser().then(async user=>{if(!user)return;setAccount(user.email??user.id);try{const remote=await pullState();const local=loadState();const {state:restored,shouldPush}=reconcileState(local,remote);if(restored!==local){setState(restored);saveState(restored);setWizard(restored.profile?.firstName?restored.onboardingDone?null:0:-1);}if(shouldPush)await pushState(restored);}catch(e:any){setNotice(`Synchronisation : ${e.message}`);}}).catch(()=>{});},[]);
  useEffect(()=>{if(!account){setAdmin(false);return;}let active=true;
    (async()=>{try{await ensureSocialProfile();if(active){setAdmin(await isSocialAdmin());await publishSocialProgress(loadState());await setSocialOnline(true);}}catch(e:any){if(active)setNotice(`Espace amis : ${e.message}`);}})();
    const timer=setInterval(()=>{if(DeviceAppState.currentState==='active')setSocialOnline(true).catch(()=>{});},45000);
    const listener=DeviceAppState.addEventListener('change',status=>{setSocialOnline(status==='active').catch(()=>{});if(status==='active')registerPushDevice().catch(()=>{});else updatePushPresence(null).catch(()=>{});});
    return()=>{active=false;clearInterval(timer);listener.remove();setSocialOnline(false).catch(()=>{});};
  },[account]);
  useEffect(()=>{if(!account||!state.profile?.firstName)return;
    ensureSocialProfile().then(profile=>profile.display_name===state.profile!.firstName?undefined:updateSocialProfile({...profile,display_name:state.profile!.firstName})).catch(e=>setNotice(`Prénom des invitations : ${e.message}`));
  },[account,state.profile?.firstName]);
  const openReader=(r:Reader)=>{setReader(r);setPage(pageOf(r.range.start));setMasked(false);setRevealed(null);};
  const closeReader=()=>setReader(null);
  const statsNow=stats(state,today),prog=progress(state);
  const todaySessions=state.sessions.filter(s=>s.date===today&&s.status==='todo');
  const due=state.revisions.filter(r=>r.due<=today);
  const allDone=state.sessions.filter(s=>s.status==='done').length;
  const finishEstimate=state.sessions.filter(s=>s.status==='todo').at(-1)?.date;
  applyTheme(state.theme??'classic');
  return <SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:colors.cream}}>
    {reader?<ReaderScreen reader={reader} page={page} setPage={setPage} masked={masked} setMasked={setMasked} revealed={revealed} setRevealed={setRevealed} onClose={closeReader} state={state} update={update} />:
      wizard!==null?<Onboarding state={state} update={update} step={wizard} setStep={setWizard} onDone={()=>{setWizard(null);setTab('Accueil');}} />:
      socialView==='friends'?<FriendsScreen initialLinkId={pendingLinkId} onClose={()=>{setSocialView(null);setPendingLinkId(null);}} />:
      socialView==='admin'?<AdminScreen onClose={()=>setSocialView(null)} />:
      <>
        <ScrollView key={tab} contentContainerStyle={{paddingHorizontal:18,paddingBottom:30}}>
          {tab==='Accueil'&&<Home state={state} prog={prog} stat={statsNow} todaySessions={todaySessions} due={due} finishEstimate={finishEstimate} openReader={openReader} />}
          {tab==='Coran'&&<QuranScreen openReader={openReader} />}
          {tab==='Programme'&&<ProgramScreen state={state} update={update} openReader={openReader} openWizard={()=>setWizard(1)} />}
          {tab==='Progrès'&&<ProgressScreen state={state} prog={prog} stat={statsNow} allDone={allDone} />}
          {tab==='Profil'&&<ProfileScreen state={state} update={update} account={account} setAccount={setAccount} setNotice={setNotice} openKnowledge={()=>setWizard(0)} openGoal={()=>setWizard(1)} openFriends={()=>{setPendingLinkId(null);setSocialView('friends');}} openAdmin={()=>setSocialView('admin')} admin={admin} passwordRecovery={passwordRecovery} setPasswordRecovery={setPasswordRecovery} onPasswordReady={()=>{if(!state.profile?.firstName)setWizard(-1);else if(!state.onboardingDone)setWizard(0);}} onReset={resetAll} />}
        </ScrollView>
        <View style={{height:74,backgroundColor:colors.paper,borderTopWidth:1,borderColor:colors.line,flexDirection:'row',justifyContent:'space-around',paddingBottom:12,paddingTop:8}}>
          {(['Accueil','Coran','Programme','Progrès','Profil'] as Tab[]).map((name,i)=><Pressable key={name} onPress={()=>setTab(name)} style={{alignItems:'center',justifyContent:'center',flex:1}}><Text style={{fontSize:22,color:tab===name?colors.green:colors.muted}}>{['⌂','۞','▤','▥','◯'][i]}</Text><Text style={{fontSize:10,fontWeight:tab===name?'700':'500',color:tab===name?colors.green:colors.muted}}>{name}</Text></Pressable>)}
        </View>
      </>}
    {notice?<Pressable accessibilityRole="alert" onPress={()=>setNotice('')} style={{position:'absolute',left:18,right:18,bottom:reader||wizard!==null||socialView?18:82,zIndex:50,padding:14,backgroundColor:colors.paper,borderWidth:1,borderColor:colors.gold,borderRadius:14,elevation:8,shadowColor:'#000',shadowOpacity:0.16,shadowRadius:8}}><Label style={{fontSize:14,fontWeight:'600'}}>{notice}  ×</Label></Pressable>:null}
  </SafeAreaView>;
}

function Home({state,prog,stat,todaySessions,due,finishEstimate,openReader}:{state:AppState;prog:ReturnType<typeof progress>;stat:ReturnType<typeof stats>;todaySessions:Session[];due:AppState['revisions'];finishEstimate?:string;openReader:(r:Reader)=>void}){
  return <>
    <View style={{paddingTop:12,paddingBottom:20}}><Label style={{color:colors.muted}}>Bonjour{state.profile?.firstName?` ${state.profile.firstName}`:''} et bienvenue dans ton programme de mémorisation.</Label><Title>Ton chemin, jour après jour</Title></View>
    <Card style={{backgroundColor:colors.green,borderColor:colors.green,padding:22}}><Label style={{color:colors.onDark,fontSize:13}}>MON OBJECTIF ACTUEL</Label><Text style={{color:'white',fontSize:23,fontWeight:'700',marginTop:7}}>{state.goal.label}</Text>{state.goal.direction==='fromNas'&&<Label style={{color:colors.onDarkSoft,fontSize:13,marginTop:5}}>Depuis An-Nâs, sourate après sourate</Label>}<View style={{height:8,backgroundColor:colors.track,borderRadius:10,marginTop:20}}><View style={{width:percent(prog.goal) as any,height:8,backgroundColor:colors.progress,borderRadius:10}} /></View><View style={{flexDirection:'row',justifyContent:'space-between',marginTop:9}}><Label style={{color:'white',fontSize:13}}>Objectif : {percent(prog.goal)}</Label><Label style={{color:colors.onDarkSoft,fontSize:13}}>Coran : {percent(prog.quran)}</Label></View></Card>
    {section('Aujourd’hui')}
    <Card>{todaySessions.length?<><Label style={{color:colors.muted,fontSize:13}}>PROGRAMME D’APPRENTISSAGE</Label>{todaySessions.map(s=><View key={s.id} style={{marginTop:9}}><Label style={{fontWeight:'700'}}>{reference(s)}</Label><Label style={{color:colors.muted,fontSize:13}}>{paceLabels[s.unit]}</Label></View>)}</>:<Label style={{color:colors.muted}}>Aucune nouvelle séance prévue aujourd’hui.</Label>}</Card>
    <Button disabled={!todaySessions.length} onPress={()=>todaySessions[0]&&openReader({range:todaySessions[0],sessionId:todaySessions[0].id})}>COMMENCER MON APPRENTISSAGE</Button>
    <Button secondary disabled={!due.length} onPress={()=>due[0]&&openReader({range:due[0],revisionId:due[0].id})}>COMMENCER MES RÉVISIONS {due.length?`(${due.length})`:''}</Button>
    <View style={{flexDirection:'row',gap:12,marginTop:18}}><Card style={{flex:1}}><Label style={{fontSize:25,fontWeight:'700',color:colors.green}}>{stat.weeklySessions}</Label><Label style={{fontSize:12,color:colors.muted}}>séances cette semaine</Label></Card><Card style={{flex:1}}><Label style={{fontSize:25,fontWeight:'700',color:colors.green}}>{stat.month}</Label><Label style={{fontSize:12,color:colors.muted}}>versets ce mois</Label></Card></View>
    <Card><Label style={{fontWeight:'700'}}>Fin estimée de l’objectif</Label><Label style={{color:colors.muted,marginTop:4}}>{finishEstimate?dateText(finishEstimate):prog.goal>=1?'Objectif atteint':'Au-delà du programme généré'}</Label></Card>
  </>;
}

function QuranScreen({openReader}:{openReader:(r:Reader)=>void}){
  const [query,setQuery]=useState('');
  const found=surahs.filter(s=>`${s.number} ${s.name} ${s.meaning}`.toLowerCase().includes(query.toLowerCase()));
  return <><View style={{paddingTop:12,paddingBottom:14}}><Title>Le Coran</Title><Label style={{color:colors.muted}}>Mushaf de Médine · Hafs ‘an ‘Âsim · 604 pages</Label></View><Field value={query} onChangeText={setQuery} placeholder="Chercher une sourate" />
    {found.map(s=><Pressable key={s.number} onPress={()=>openReader({range:{start:s.start,end:s.end}})}><Card style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:colors.surahBadge,alignItems:'center',justifyContent:'center'}}><Label style={{fontSize:13,color:colors.green}}>{s.number}</Label></View><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{s.name}</Label><Label style={{color:colors.muted,fontSize:12}}>{s.meaning} · {s.count} versets</Label></View><Label style={{fontSize:19,color:colors.green}}>{s.arabic}</Label></Card></Pressable>)}
  </>;
}

function ProgramScreen({state,update,openReader,openWizard}:{state:AppState;update:(s:AppState)=>void;openReader:(r:Reader)=>void;openWizard:()=>void}){
  const [showAll,setShowAll]=useState(false);
  const future=state.sessions.filter(s=>s.status==='todo');
  return <><View style={{paddingTop:12,paddingBottom:14}}><Title>Mon programme</Title><Label style={{color:colors.muted}}>{state.goal.label} · {paceLabels[state.pace]} par séance{state.goal.direction==='fromNas'?' · depuis An-Nâs':''}</Label></View>
    <Button secondary onPress={openWizard}>Modifier l’objectif et le rythme</Button>
    {section('À venir')}
    {(showAll?future:future.slice(0,25)).map(s=><Card key={s.id}><Label style={{fontSize:12,color:colors.gold,fontWeight:'700',textTransform:'uppercase'}}>{dateText(s.date)}</Label><Label style={{fontWeight:'700',marginTop:5}}>{reference(s)}</Label><Label style={{color:colors.muted,fontSize:13}}>{paceLabels[s.unit]} · À faire</Label><View style={{flexDirection:'row',gap:8,marginTop:10}}><View style={{flex:1}}><Button small onPress={()=>openReader({range:s,sessionId:s.id})}>Ouvrir</Button></View><View style={{flex:1}}><Button small secondary onPress={()=>update(postponeSession(state,s.id))}>Reporter</Button></View></View></Card>)}
    {!future.length&&<Card><Label>Aucune séance à venir. Vérifie ton objectif ou tes jours d’apprentissage.</Label></Card>}
    {future.length>25&&!showAll&&<Button secondary onPress={()=>setShowAll(true)}>Voir toutes les séances</Button>}
    {section('Historique')}
    {state.sessions.filter(s=>s.status!=='todo').slice(-20).reverse().map(s=><Card key={s.id} style={{paddingVertical:11}}><Label style={{fontSize:13,color:colors.muted}}>{dateText(s.date)} · {s.status==='done'?'Terminé':'Reporté'}</Label><Label>{reference(s)}</Label></Card>)}
  </>;
}

function ProgressScreen({state,prog,stat,allDone}:{state:AppState;prog:ReturnType<typeof progress>;stat:ReturnType<typeof stats>;allDone:number}){
  const [view,setView]=useState<'Jour'|'Semaine'|'Mois'>('Semaine');
  const today=todayLocal();
  const completed=state.sessions.filter(s=>s.status==='done'&&s.completedAt);
  const count=(predicate:(s:Session)=>boolean)=>completed.filter(predicate).reduce((n,s)=>n+s.end-s.start+1,0);
  const localDate=(s:Session)=>s.completedDate??s.completedAt!.slice(0,10);
  const monday=(()=>{const d=new Date(`${today}T12:00:00`);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateKey(d);})();
  const values=view==='Jour'
    ?Array.from({length:6},(_,i)=>({label:`${i*4}h`,value:count(s=>localDate(s)===today&&Math.floor(new Date(s.completedAt!).getHours()/4)===i)}))
    :view==='Semaine'
      ?Array.from({length:7},(_,i)=>{const d=new Date(`${monday}T12:00:00`);d.setDate(d.getDate()+i);const key=dateKey(d);return {label:weekdays[d.getDay()].slice(0,2),value:count(s=>localDate(s)===key)};})
      :Array.from({length:5},(_,i)=>({label:`${i*7+1}–${Math.min((i+1)*7,new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate())}`,value:count(s=>localDate(s).slice(0,7)===today.slice(0,7)&&Number(localDate(s).slice(8,10))>=i*7+1&&Number(localDate(s).slice(8,10))<=(i+1)*7)}));
  const max=Math.max(1,...values.map(v=>v.value));
  return <><View style={{paddingTop:12,paddingBottom:14}}><Title>Ma progression</Title><Label style={{color:colors.muted}}>Chaque verset validé compte une seule fois.</Label></View>
    <View style={{flexDirection:'row',gap:8,marginBottom:12}}>{(['Jour','Semaine','Mois'] as const).map(v=><View key={v} style={{flex:1}}><Button small secondary={view!==v} onPress={()=>setView(v)}>{v.toUpperCase()}</Button></View>)}</View>
    <Card><Label style={{color:colors.muted,fontSize:13}}>CORAN MÉMORISÉ</Label><Label style={{fontSize:32,fontWeight:'700',color:colors.green}}>{percent(prog.quran)}</Label><Label style={{color:colors.muted,marginTop:8,fontSize:13}}>OBJECTIF ATTEINT</Label><Label style={{fontSize:27,fontWeight:'700',color:colors.green}}>{percent(prog.goal)}</Label></Card>
    <Card><Label style={{fontWeight:'700',marginBottom:12}}>Versets validés</Label><View style={{height:110,flexDirection:'row',alignItems:'flex-end',gap:8}}>{values.map((v,i)=><View key={i} style={{flex:1,alignItems:'center'}}><View style={{height:Math.max(5,v.value/max*80),width:'72%',borderRadius:6,backgroundColor:colors.green2}} /><Label style={{fontSize:11,color:colors.muted,marginTop:5}}>{v.label}</Label></View>)}</View></Card>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{[[stat.today,'versets aujourd’hui'],[stat.week,'cette semaine'],[stat.month,'ce mois'],[stat.hizbs,'hizb terminés'],[stat.days,'jours d’apprentissage'],[stat.revisions,'révisions effectuées']].map(([n,l])=><Card key={String(l)} style={{width:'48%',minHeight:95,marginBottom:0}}><Label style={{fontSize:24,fontWeight:'700',color:colors.green}}>{n}</Label><Label style={{fontSize:12,color:colors.muted}}>{l}</Label></Card>)}</View>
    {section(`Historique · ${allDone} séances`)}
    {state.sessions.filter(s=>s.status==='done').slice(-30).reverse().map(s=><Card key={s.id} style={{paddingVertical:10}}><Label style={{fontSize:12,color:colors.muted}}>{s.completedDate??s.completedAt?.slice(0,10)}</Label><Label>{reference(s)}</Label></Card>)}
  </>;
}

function ProfileScreen({state,update,account,setAccount,setNotice,openKnowledge,openGoal,openFriends,openAdmin,admin,passwordRecovery,setPasswordRecovery,onPasswordReady,onReset}:{state:AppState;update:(s:AppState)=>void;account:string|null;setAccount:(v:string|null)=>void;setNotice:(v:string)=>void;openKnowledge:()=>void;openGoal:()=>void;openFriends:()=>void;openAdmin:()=>void;admin:boolean;passwordRecovery:boolean;setPasswordRecovery:(v:boolean)=>void;onPasswordReady:()=>void;onReset:()=>Promise<void>}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  const [newPassword,setNewPassword]=useState('');
  const [resetting,setResetting]=useState(false);
  const [firstName,setFirstName]=useState(state.profile?.firstName??'');
  useEffect(()=>setFirstName(state.profile?.firstName??''),[state.profile?.firstName]);
  const saveFirstName=()=>{const value=firstName.trim();if(value.length<2||value.length>40){setNotice('Saisis un prénom de 2 à 40 caractères.');return;}update(touch({...state,profile:{sex:state.profile?.sex??'Homme',firstName:value}}));setNotice('Prénom enregistré pour ton profil et tes invitations.');};
  const confirmReset=()=>Alert.alert('Tout remettre à zéro ?','Tes connaissances, séances, révisions, statistiques et choix de programme seront effacés. Ton compte et les pages du Coran seront conservés. Cette action ne peut pas être annulée.',[
    {text:'Annuler',style:'cancel'},
    {text:'Tout remettre à zéro',style:'destructive',onPress:()=>{setResetting(true);onReset().catch((e:any)=>setNotice(`Réinitialisation impossible : ${e.message}`)).finally(()=>setResetting(false));}},
  ]);
  const handleAuth=async(register:boolean)=>{setBusy(true);try{const user=await signIn(email.trim(),password,register);if(user){setAccount(user.email??user.id);const remote=await pullState();const {state:restored,shouldPush}=reconcileState(state,remote);if(restored!==state)update(restored);if(shouldPush)await pushState(restored);setNotice(restored!==state?'Tes données ont été retrouvées.':register?'Compte créé. Vérifie ton courriel si une confirmation est demandée.':'Synchronisation activée.');}else setNotice('Vérifie ton courriel pour confirmer le compte.');}catch(e:any){setNotice(e.message??'Connexion impossible.');}finally{Keyboard.dismiss();setBusy(false);}};
  return <><View style={{paddingTop:12,paddingBottom:14}}><Title>Mon profil</Title><Label style={{color:colors.muted}}>Tes préférences et tes données</Label></View>
    <Card><Label style={{fontWeight:'700'}}>Mon prénom</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Ce prénom apparaît dans les invitations envoyées à tes amis.</Label><Field value={firstName} onChangeText={setFirstName} placeholder="Ton prénom" autoCapitalize="words" /><Button secondary onPress={saveFirstName}>Enregistrer mon prénom</Button></Card>
    {passwordRecovery&&account?<Card><Label style={{fontWeight:'700'}}>Choisir mon mot de passe</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Utilise au moins 8 caractères. Ton mot de passe reste privé.</Label><Field value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau mot de passe" secureTextEntry /><Button disabled={busy||newPassword.length<8} onPress={async()=>{setBusy(true);try{await changePassword(newPassword);setNewPassword('');setPasswordRecovery(false);setNotice('Mot de passe enregistré. Ton compte est prêt.');onPasswordReady();}catch(e:any){setNotice(e.message);}finally{Keyboard.dismiss();setBusy(false);}}}>Enregistrer mon mot de passe</Button></Card>:null}
    <Card><Label style={{fontWeight:'700'}}>Connaissances</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Modifier les sourates, juz’, hizb et passages déjà appris.</Label><Button secondary onPress={openKnowledge}>Modifier mes connaissances</Button></Card>
    <Card><Label style={{fontWeight:'700'}}>Objectif et rythme</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>{state.goal.label} · {paceLabels[state.pace]}</Label><Button secondary onPress={openGoal}>Modifier mon programme</Button></Card>
    {account?<Card><Label style={{fontWeight:'700'}}>Amis et entraide</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Suivi partagé, messages et cercles privés.</Label><Button onPress={openFriends}>Ouvrir mes amis</Button>{admin?<Button secondary onPress={openAdmin}>Modérer les discussions</Button>:null}</Card>:null}
    <Card><Label style={{fontWeight:'700'}}>Synchronisation</Label>{!syncConfigured?<Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Ajoute l’URL et la clé publique de ton projet Supabase dans le fichier .env pour activer le compte.</Label>:account?<><Label style={{color:colors.muted,marginVertical:8}}>{account}</Label><Button secondary onPress={async()=>{try{await pushState(state);setNotice('Données synchronisées.');}catch(e:any){setNotice(e.message);}}}>Synchroniser maintenant</Button><Button secondary onPress={async()=>{await setSocialOnline(false).catch(()=>{});await unregisterPushDevice().catch(()=>{});await signOut();setAccount(null);setNotice('Déconnecté. Les données restent sur ce téléphone.');}}>Se déconnecter</Button></>:<><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Retrouve ta progression sur un autre téléphone.</Label><Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" keyboardType="email-address" /><Field value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry /><Button disabled={busy||!email||!password} onPress={()=>handleAuth(false)}>Se connecter</Button><Button secondary disabled={busy||!email||password.length<6} onPress={()=>handleAuth(true)}>Créer un compte</Button><Button secondary disabled={busy||!email.includes('@')} onPress={async()=>{setBusy(true);try{await requestPasswordLink(email);setNotice('Un lien vient de t’être envoyé. Ouvre-le sur ce téléphone après avoir installé la nouvelle version de l’application.');}catch(e:any){setNotice(e.message);}finally{Keyboard.dismiss();setBusy(false);}}}>Recevoir un lien pour créer ou changer mon mot de passe</Button></>}</Card>
    <Card><Label style={{fontWeight:'700'}}>Notifications</Label><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12,gap:12}}><Label style={{flex:1}}>Messages privés</Label><Switch accessibilityLabel="Notifications des messages privés" value={state.notifications?.messages!==false} onValueChange={messages=>update(touch({...state,notifications:{messages,learning:state.notifications?.learning!==false}}))} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12,gap:12}}><Label style={{flex:1}}>Rappels d’apprentissage</Label><Switch accessibilityLabel="Rappels d’apprentissage" value={state.notifications?.learning!==false} onValueChange={learning=>update(touch({...state,notifications:{messages:state.notifications?.messages!==false,learning}}))} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View><Label style={{color:colors.muted,fontSize:13,marginTop:12}}>Jours : {state.learningDays.length?[1,2,3,4,5,6,0].filter(day=>state.learningDays.includes(day)).map(day=>weekdays[day]).join(', '):'aucun'} · 19 h 00</Label>{__DEV__?<Button secondary small onPress={()=>testLocalNotification().then(()=>setNotice('Notification de test programmée dans 5 secondes.')).catch(e=>setNotice(`Test impossible : ${e.message}`))}>Tester les notifications</Button>:null}</Card>
    <Card><Label style={{fontWeight:'700'}}>Apparence</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Choisis les couleurs de ton application.</Label><Choice label="Thème Vert" selected={(state.theme??'classic')==='classic'} onPress={()=>update(touch({...state,theme:'classic'}))} /><Choice label="Thème Rose" selected={state.theme==='feminine'} onPress={()=>update(touch({...state,theme:'feminine'}))} /></Card>
    <Card><Label style={{fontWeight:'700'}}>Réglages</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Recommencer le questionnaire et effacer tout l’apprentissage et toutes les révisions. Ton prénom et ton thème seront conservés.</Label><Button secondary disabled={resetting} onPress={confirmReset}>Tout remettre à zéro</Button></Card>
    <Card><Label style={{fontWeight:'700'}}>Sources du Coran</Label><Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Texte Uthmani Hafs : Tanzil Project, copyright 2007–2021, licence CC BY 3.0. Texte reproduit sans modification.</Label><Pressable onPress={()=>Linking.openURL('https://tanzil.net')}><Label style={{color:colors.green2,textDecorationLine:'underline',marginTop:7}}>Voir Tanzil et les mises à jour ↗</Label></Pressable><Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Pages Hafs 1405 issues de l’IPA fournie. Divisions juz’, hizb et rub‘ : Quran Meta. Les toumoun Hafs attendent une validation indépendante.</Label></Card>
  </>;
}

function Onboarding({state,update,step,setStep,onDone}:{state:AppState;update:(s:AppState)=>void;step:number;setStep:(n:number|null)=>void;onDone:()=>void}){
  const [sex,setSex]=useState<'Homme'|'Femme'|null>(state.profile?.sex??null);
  const [firstName,setFirstName]=useState(state.profile?.firstName??'');
  const [partSurah,setPartSurah]=useState(''),[partStart,setPartStart]=useState(''),[partEnd,setPartEnd]=useState('');
  const [paceLevel,setPaceLevel]=useState<PacePreset>(state.pace==='halfPage'?'intermediate':intensivePaces.includes(state.pace)?'intensive':'beginner');
  const [kind,setKind]=useState<GoalPreset|'custom'>(()=>(Object.keys(goalPresetLabels) as GoalPreset[]).find(key=>goalPresetLabels[key]===state.goal.label)??'custom');
  const [direction,setDirection]=useState<LearningDirection>(state.goal.direction??'fromNas');
  const [selectedJuz,setSelectedJuz]=useState<number[]>([]),[selectedHizb,setSelectedHizb]=useState<number[]>([]),[selectedSurahs,setSelectedSurahs]=useState<number[]>([]);
  const [customSurah,setCustomSurah]=useState(''),[customStart,setCustomStart]=useState(''),[customEnd,setCustomEnd]=useState('');
  const [customRanges,setCustomRanges]=useState<Range[]>(state.goal.label==='Objectif personnalisé'||state.goal.label.startsWith('Juz’ ')||state.goal.label.startsWith('Hizb ')?state.goal.ranges:[]);
  const [error,setError]=useState('');
  const updateKnowledge=(next:AppState)=>update(state.onboardingDone?generateProgram(seedInitialRevisions(next)):next);
  const toggle=(list:number[],value:number,set:(v:number[])=>void)=>set(list.includes(value)?list.filter(x=>x!==value):[...list,value]);
  const addPartial=(goal:boolean)=>{
    const s=Number(goal?customSurah:partSurah),a=Number(goal?customStart:partStart),b=Number(goal?customEnd:partEnd);
    const first=verseId(s,a),last=verseId(s,b);
    if(!first||!last||first>last){setError('Indique une sourate et des versets valides.');return;}
    if(goal){setCustomRanges(normalizeRanges([...customRanges,{start:first,end:last}]));setCustomSurah('');setCustomStart('');setCustomEnd('');}
    else{updateKnowledge(markKnowledge(state,{start:first,end:last},'perfect'));setPartSurah('');setPartStart('');setPartEnd('');}
    setError('');
  };
  const selectedLevel=(r:Range)=>isRangeKnown(state,r);
  const applyKnown=(range:Range)=>updateKnowledge(toggleKnownRange(state,range));
  const choosePaceLevel=(level:PacePreset)=>{setPaceLevel(level);update(touch({...state,pace:pacePresets[level].pace}));};
  const next=()=>{
    setError('');
    if(step===-1){const value=firstName.trim();if(!sex){setError('Choisis Homme ou Femme pour continuer.');return;}if(value.length<2||value.length>40){setError('Saisis ton prénom, de 2 à 40 caractères.');return;}update(touch({...state,profile:{sex,firstName:value}}));if(state.onboardingDone)onDone();else setStep(0);return;}
    if(step===0){setStep(1);return;}
    if(step===1){
      if(kind!=='custom'){const goal=goalFromPreset(kind,kind==='all'?direction:'fromNas');update(touch({...state,goal}));setStep(2);return;}
      const ranges=normalizeRanges([...selectedJuz.map(n=>juzs[n-1]),...selectedSurahs.map(n=>surahs[n-1]),...selectedHizb.map(n=>hizbs[n-1]),...customRanges]);
      if(!validGoal(ranges)){setError('Choisis au moins l’équivalent d’un hizb complet. Les passages déjà mémorisés comptent dans cet objectif.');return;}
      update(touch({...state,goal:{label:'Objectif personnalisé',ranges,direction:'fromStart'}}));setStep(2);return;
    }
    if(step===2){const allowed=paceLevel==='beginner'?beginnerPaces:paceLevel==='intermediate'?['halfPage']:intensivePaces;if(!allowed.includes(state.pace)){setError('Choisis une quantité parmi celles du niveau sélectionné.');return;}setStep(3);return;}
    if(!state.learningDays.length){setError('Sélectionne au moins un jour d’apprentissage.');return;}
    const done=generateProgram(seedInitialRevisions(touch({...state,onboardingDone:true})));update(done);onDone();
  };
  return <><View style={{paddingHorizontal:18,paddingBottom:8}}><Label style={{fontSize:12,color:colors.gold,fontWeight:'700'}}>{step===-1?'BIENVENUE':`CONFIGURATION · ${step+1}/4`}</Label><Title>{step===-1?'Faisons connaissance':['Que connais-tu déjà ?','Quel est ton objectif ?','Quel rythme souhaites-tu ?','Quels jours souhaites-tu apprendre ?'][step]}</Title></View>
    <ScrollView contentContainerStyle={{paddingHorizontal:18,paddingBottom:15}}>
      {step===-1&&<><Label style={{color:colors.muted,marginBottom:14}}>Pour personnaliser ton parcours, indique d’abord si tu es un homme ou une femme, puis ton prénom. Seul ton prénom sera montré dans les invitations.</Label><Choice label="Homme" selected={sex==='Homme'} onPress={()=>setSex('Homme')} /><Choice label="Femme" selected={sex==='Femme'} onPress={()=>setSex('Femme')} />{sex&&<><Label style={{fontWeight:'700',marginTop:16,marginBottom:8}}>Quel est ton prénom ?</Label><Field value={firstName} onChangeText={setFirstName} placeholder="Ton prénom" autoCapitalize="words" /></>}</>}
      {step===0&&<>
        <Label style={{color:colors.muted,marginBottom:12}}>Coche les sourates que tu connais déjà par cœur. Ajoute aussi les passages dont tu ne connais qu’une partie. Tu pourras modifier cette liste plus tard.</Label>
        {section('Passages partiellement mémorisés')}
        <Field value={partSurah} onChangeText={setPartSurah} placeholder="Numéro de sourate (1–114)" keyboardType="number-pad" /><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Field value={partStart} onChangeText={setPartStart} placeholder="Verset de début" keyboardType="number-pad" /></View><View style={{flex:1}}><Field value={partEnd} onChangeText={setPartEnd} placeholder="Verset de fin" keyboardType="number-pad" /></View></View><Button secondary onPress={()=>addPartial(false)}>Ajouter ce passage</Button>{partialKnownRanges(state).map(r=><Card key={`${r.start}-${r.end}`}><Label style={{fontSize:14}}>{reference(r)}</Label><Button small secondary onPress={()=>updateKnowledge(markKnowledge(state,r,'learning'))}>Retirer ce passage</Button></Card>)}
        {section('Sourates connues par cœur')}{surahs.map(s=><CheckChoice key={s.number} label={`${s.number}. ${s.name}`} subtitle={s.meaning} selected={selectedLevel(s)} onPress={()=>applyKnown(s)} />)}
        {section('Juz’ déjà connus')}{juzs.map(j=><CheckChoice key={j.number} label={`Juz’ ${j.number}`} selected={selectedLevel(j)} onPress={()=>applyKnown(j)} />)}
        {section('Hizb déjà connus')}{hizbs.map(h=><CheckChoice key={h.number} label={`Hizb ${h.number}`} selected={selectedLevel(h)} onPress={()=>applyKnown(h)} />)}
      </>}
      {step===1&&<>
        {([['lastTen','Je souhaite apprendre les petites sourates (les 10 dernières)'],['sabbih','Je souhaite apprendre le Hizb Sabbih'],['amma','Je souhaite apprendre le Juz’ ‘Amma'],['toYasin','Je souhaite apprendre jusqu’à la sourate Ya-Sîn'],['half','Je souhaite mémoriser la moitié du Coran'],['all','Je souhaite mémoriser tout le Coran'],['custom','Créer un objectif personnalisé']] as [typeof kind,string][]).map(([value,label])=><Choice key={value} label={label} selected={kind===value} onPress={()=>setKind(value)} />)}
        {(kind==='lastTen'||kind==='sabbih'||kind==='amma'||kind==='toYasin'||kind==='half')&&<Label style={{color:colors.muted,fontSize:13,marginBottom:8}}>Apprentissage depuis An-Nâs, en remontant sourate après sourate.</Label>}
        {kind==='all'&&<>{section('Par où commencer ?')}<Choice label="Depuis Al-Fatiha" subtitle="Sourates 1 à 114" selected={direction==='fromStart'} onPress={()=>setDirection('fromStart')} /><Choice label="Depuis An-Nâs" subtitle="Sourates 114 à 1 ; versets de chaque sourate dans l’ordre" selected={direction==='fromNas'} onPress={()=>setDirection('fromNas')} /></>}
        {kind==='custom'&&<>{section('Juz’')}{juzs.map(j=><CheckChoice key={j.number} label={`Juz’ ${j.number}`} selected={selectedJuz.includes(j.number)} onPress={()=>toggle(selectedJuz,j.number,setSelectedJuz)} />)}{section('Hizb')}{hizbs.map(h=><CheckChoice key={h.number} label={`Hizb ${h.number}`} selected={selectedHizb.includes(h.number)} onPress={()=>toggle(selectedHizb,h.number,setSelectedHizb)} />)}{section('Sourates')}{surahs.map(s=><CheckChoice key={s.number} label={`${s.number}. ${s.name}`} selected={selectedSurahs.includes(s.number)} onPress={()=>toggle(selectedSurahs,s.number,setSelectedSurahs)} />)}{section('Passage précis')}<Field value={customSurah} onChangeText={setCustomSurah} placeholder="Numéro de sourate" keyboardType="number-pad" /><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Field value={customStart} onChangeText={setCustomStart} placeholder="Verset début" keyboardType="number-pad" /></View><View style={{flex:1}}><Field value={customEnd} onChangeText={setCustomEnd} placeholder="Verset fin" keyboardType="number-pad" /></View></View><Button secondary onPress={()=>addPartial(true)}>Ajouter le passage</Button>{customRanges.map((r,i)=><Label key={i}>{reference(r)}</Label>)}</>}
      </>}
      {step===2&&<><Label style={{color:colors.muted,marginBottom:12}}>Choisis d’abord ton niveau. Les quantités proposées correspondent ensuite à ce niveau. Tu choisiras les jours à l’étape suivante.</Label>{(Object.keys(pacePresets) as PacePreset[]).map(key=><Choice key={key} label={pacePresets[key].label} subtitle={pacePresets[key].description} selected={paceLevel===key} onPress={()=>choosePaceLevel(key)} />)}{paceLevel==='beginner'&&<>{section('Combien de versets par séance ?')}{beginnerPaces.map(p=><Choice key={p} label={paceLabels[p]} selected={state.pace===p} onPress={()=>update(touch({...state,pace:p}))} />)}</>}{paceLevel==='intermediate'&&<Card><Label>Une demi-page par séance.</Label></Card>}{paceLevel==='intensive'&&<>{section('Combien par séance ?')}{intensivePaces.map(p=><Choice key={p} label={paceLabels[p]} selected={state.pace===p} onPress={()=>update(touch({...state,pace:p}))} />)}</>}</>}
      {step===3&&<><Label style={{color:colors.muted,marginBottom:12}}>Les jours non sélectionnés restent libres pour les révisions.</Label>{[1,2,3,4,5,6,0].map(d=><Choice key={d} label={weekdays[d]} selected={state.learningDays.includes(d)} onPress={()=>update(touch({...state,learningDays:state.learningDays.includes(d)?state.learningDays.filter(x=>x!==d):[...state.learningDays,d]}))} />)}</>}
      {!!error&&<Label style={{color:colors.red,marginVertical:10}}>{error}</Label>}
    </ScrollView>
    <View style={{paddingHorizontal:18,paddingBottom:18,borderTopWidth:1,borderColor:colors.line,backgroundColor:colors.paper}}><View style={{flexDirection:'row',gap:10}}>{step>0&&<View style={{flex:1}}><Button secondary onPress={()=>setStep(step-1)}>Retour</Button></View>}<View style={{flex:2}}><Button onPress={next}>{step===3?'Créer mon programme':'Continuer'}</Button></View></View>{state.onboardingDone&&<Pressable onPress={onDone} style={{alignItems:'center',paddingTop:7}}><Label style={{color:colors.muted,fontSize:13}}>Fermer</Label></Pressable>}</View>
  </>;
}

function ReaderScreen({reader,page,setPage,masked,setMasked,revealed,setRevealed,onClose,state,update}:{reader:Reader;page:number;setPage:(n:number)=>void;masked:boolean;setMasked:(v:boolean)=>void;revealed:number|null;setRevealed:(n:number|null)=>void;onClose:()=>void;state:AppState;update:(s:AppState)=>void}){
  const {width}=useWindowDimensions();const imageWidth=Math.min(width-28,600),imageHeight=imageWidth*3106/1920;
  const swipe=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dx)>18&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.5,
    onPanResponderTerminationRequest:()=>false,
    onPanResponderRelease:(_,gesture)=>{const next=pageAfterSwipe(page,gesture.dx,gesture.dy);if(next!==page){setPage(next);setRevealed(null);}},
  }),[page,setPage,setRevealed]);
  const from=pageOf(reader.range.start),to=pageOf(reader.range.end);
  const bounds=(boundsRaw as Record<string,number[][]>)[String(page)]||[];
  const targetVerses=Array.from({length:reader.range.end-reader.range.start+1},(_,i)=>reader.range.start+i);
  const visible=targetVerses.filter(id=>pageOf(id)===page);
  const nextReveal=revealed===null?visible[0]:visible.find(id=>id>revealed)??visible[0];
  const validate=(kind:'done'|'work'|'postpone')=>{if(!reader.sessionId)return;const next=kind==='postpone'?postponeSession(state,reader.sessionId):completeSession(state,reader.sessionId,kind==='done');update(next);onClose();};
  const grade=(value:'perfect'|'hesitant'|'errors'|'relearn')=>{if(!reader.revisionId)return;const next=gradeRevision(state,reader.revisionId,value);update(value==='relearn'?generateProgram(next):next);onClose();};
  return <><View style={{paddingHorizontal:18,paddingBottom:8,flexDirection:'row',alignItems:'center',gap:10}}><Pressable onPress={onClose} style={{padding:8}}><Label style={{fontSize:22}}>‹</Label></Pressable><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{reader.sessionId?'Séance du jour':reader.revisionId?'Révision':'Le Coran'}</Label><Label style={{color:colors.muted,fontSize:12}}>{reference(reader.range)}</Label></View><Label style={{color:colors.gold,fontSize:13}}>HAFS</Label></View>
    <ScrollView contentContainerStyle={{alignItems:'center',paddingBottom:25}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',width:imageWidth,marginBottom:7}}><Pressable onPress={()=>{setPage(Math.min(604,page+1));setRevealed(null);}}><Label style={{fontSize:22,color:colors.green}}>‹</Label></Pressable><Label style={{fontSize:13,color:colors.muted}}>Page {page} / 604 {reader.sessionId||reader.revisionId?`· passage pages ${from}–${to}`:''}</Label><Pressable onPress={()=>{setPage(Math.max(1,page-1));setRevealed(null);}}><Label style={{fontSize:22,color:colors.green}}>›</Label></Pressable></View>
      <View {...swipe.panHandlers} style={{width:imageWidth,height:imageHeight}}>{masked?<View style={{width:imageWidth,height:imageHeight,backgroundColor:'#FFFDF4',borderWidth:2,borderColor:colors.beige,borderRadius:9,padding:20,alignItems:'center',justifyContent:'center'}}><Label style={{color:colors.gold,fontSize:25}}>۞</Label><Label style={{color:colors.muted,textAlign:'center',marginTop:14}}>Récite les versets de mémoire.</Label>{revealed!==null&&visible.includes(revealed)&&<Label style={{fontSize:25,lineHeight:48,textAlign:'center',writingDirection:'rtl',marginTop:25}}>{verseAt(revealed).text} ۞</Label>}</View>:
        <View style={{width:imageWidth,height:imageHeight,backgroundColor:'white',borderWidth:2,borderColor:colors.beige,borderRadius:9,overflow:'hidden',shadowColor:'#000',shadowOpacity:0.12,shadowRadius:10}}><Image source={mushafImages[page]} style={{width:imageWidth-4,height:imageHeight-4}} resizeMode="stretch" />
          {(reader.sessionId||reader.revisionId)&&bounds.filter(row=>{const id=verseId(row[0],row[1]);return id!==null&&id>=reader.range.start&&id<=reader.range.end;}).map((row,i)=><View key={i} pointerEvents="none" style={{position:'absolute',left:row[3]/1920*(imageWidth-4),top:row[5]/3106*(imageHeight-4),width:(row[4]-row[3])/1920*(imageWidth-4),height:(row[6]-row[5])/3106*(imageHeight-4),backgroundColor:'rgba(179,149,89,0.19)',borderRadius:4}} />)}
        </View>}</View>
      <Label style={{color:colors.muted,fontSize:12,marginTop:8}}>Glisse la page à gauche ou à droite pour la tourner.</Label>
      <View style={{width:imageWidth,marginTop:12}}><Button secondary onPress={()=>{setMasked(!masked);setRevealed(null);}}>{masked?'Voir la page':'Masquer les versets pour réciter'}</Button>{masked&&<Button onPress={()=>setRevealed(nextReveal??visible[0]??null)}>Afficher le verset</Button>}</View>
      {reader.sessionId&&<View style={{width:imageWidth,marginTop:18}}>{section('Après ma séance')}<Button onPress={()=>validate('done')}>J’ai mémorisé ce passage</Button><Button secondary onPress={()=>validate('work')}>Je dois encore le travailler</Button><Button secondary onPress={()=>validate('postpone')}>Reporter cette séance</Button></View>}
      {reader.revisionId&&<View style={{width:imageWidth,marginTop:18}}>{section('Comment s’est passée la révision ?')}<Button onPress={()=>grade('perfect')}>Parfait, sans regarder</Button><Button secondary onPress={()=>grade('hesitant')}>Quelques hésitations</Button><Button secondary onPress={()=>grade('errors')}>Plusieurs erreurs</Button><Button secondary onPress={()=>grade('relearn')}>À réapprendre</Button></View>}
    </ScrollView>
  </>;
}
