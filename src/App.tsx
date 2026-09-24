import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState as DeviceAppState, BackHandler, ImageBackground, Keyboard, Linking, PanResponder, Platform, Pressable, ScrollView, StatusBar, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, Button, Card, CheckChoice, Choice, colors, Field, Label, Title, themeOptions } from './ui/theme';
import { addDays, AppState, beginnerPaces, completeSession, dateKey, dayOf, defaultState, generateProgram, goalFromPreset, goalIds, GoalPreset, goalIsAlreadyKnown, goalPresetLabels, gradeRevision, intensivePaces, isRangeKnown, LearningDirection, markKnowledge, memorizedIds, paceLabels, pacePresets, PacePreset, partialKnownRanges, postponeSession, progress, reconcileState, resetAllProgress, seedInitialRevisions, Session, stats, todayLocal, toggleKnownRange, touch, validGoal, weekdays } from './core/program';
import { pageAfterSwipe } from './core/pageNavigation';
import { expand, hizbs, juzs, normalizeRanges, pageOf, pageRange, quarters, Range, reference, surahs, verseAt, verseId, verses } from './core/quran';
import { loadState, saveState } from './services/storage';
import { changePassword, consumeAuthLink, currentUser, pullState, pushState, requestPasswordLink, signIn, signOut, supabase, syncConfigured } from './services/sync';
import {MushafPage} from './MushafPage';
import {AdminScreen,FriendsScreen} from './SocialScreens';
import {ensureSocialProfile,isSocialAdmin,publishSocialProgress,setSocialOnline,unreadMessageCount,updateSocialProfile} from './services/social';
import { Notifications, ensureNotificationPermission, notificationDestination, registerPushDevice, saveNotificationPreferences, scheduleLearningReminders, scheduleRevisionReminder, setMessagePresentationEnabled, setProgressPresentationEnabled, testLocalNotification, unregisterPushDevice, updatePushPresence } from './services/notifications';
import {AudioCommand,PassageAudioPlayer} from './PassageAudioPlayer';
import {RecitationRecorder} from './RecitationRecorder';
import {myCorrectionMarkers,syncPendingRecitations} from './services/recitations';
import {RecitationsScreen} from './RecitationsScreen';
import {gradeReviewTask,prepareReviewSchedule,reviewPlan,reviewsEnabled,ReviewTask,setReviewCycle,setReviewsEnabled,toggleDifficulty} from './core/review';

type Tab='Accueil'|'Coran'|'Programme'|'Progrès'|'Profil';
type Reader={range:Range;sessionId?:string;revisionId?:string;reviewTask?:ReviewTask;initialLanguage?:'ar'|'fr'};
const heroImages={classic:require('../assets/themes/emerald.png'),feminine:require('../assets/themes/rose.png'),lilac:require('../assets/themes/lilac.png'),night:require('../assets/themes/night.png')};
const section=(title:string)=><Label style={{fontWeight:'700',fontSize:19,marginBottom:10,marginTop:12}}>{title}</Label>;
const percent=(n:number)=>`${Math.round(n*100)} %`;
const dateText=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
const fullDate=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});

export default function App(){return <SafeAreaProvider><AppContent /></SafeAreaProvider>;}

function AppContent(){
  const [state,setState]=useState<AppState>(()=>loadState());
  const [tab,setTab]=useState<Tab>('Accueil');
  const [reader,setReader]=useState<Reader|null>(null);
  const [readerFullscreen,setReaderFullscreen]=useState(false);
  const [page,setPage]=useState(1);
  const [masked,setMasked]=useState(false);
  const [revealed,setRevealed]=useState<number|null>(null);
  const [wizard,setWizard]=useState<number|null>(state.profile?.firstName?state.onboardingDone?null:0:-1);
  const [account,setAccount]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [socialView,setSocialView]=useState<'friends'|'admin'|null>(null);
  const [reviewOpen,setReviewOpen]=useState(false);
  const [recitationsOpen,setRecitationsOpen]=useState(false);
  const [reviewOnly,setReviewOnly]=useState(false);
  const [admin,setAdmin]=useState(false);
  const [passwordRecovery,setPasswordRecovery]=useState(false);
  const [pendingLinkId,setPendingLinkId]=useState<string|null>(null);
  const [pendingInviteCode,setPendingInviteCode]=useState<string|null>(null);
  const [unreadCount,setUnreadCount]=useState(0);
  const syncWarningShown=useRef(false);
  const today=todayLocal();
  useEffect(()=>{(async()=>{
    const permission=await Notifications.getPermissionsAsync();
    let granted=permission.granted||permission.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;
    if(!granted&&(await AsyncStorage.getItem('notifications-requested-on-device'))!=='yes'){
      granted=await ensureNotificationPermission(true);
      await AsyncStorage.setItem('notifications-requested-on-device','yes');
    }
    if(granted)setState(current=>{
      if(current.notifications?.permissionExplained)return current;
      const next=touch({...current,notifications:{messages:current.notifications?.messages!==false,learning:current.notifications?.learning!==false,...current.notifications,permissionExplained:true}});
      saveState(next);return next;
    });
  })().catch(()=>{});},[state.notifications?.permissionExplained]);
  const update=(next:AppState)=>{setState(next);saveState(next);if(account){pushState(next).then(()=>{syncWarningShown.current=false;}).catch(()=>{if(!syncWarningShown.current){syncWarningShown.current=true;setNotice('Sauvegarde locale effectuée. Synchronisation en attente.');}});publishSocialProgress(next).catch(()=>{});}};
  const resetAll=async()=>{
    const fresh=resetAllProgress(loadState());
    saveState(fresh);setState(fresh);setReader(null);setPage(1);setMasked(false);setRevealed(null);setTab('Accueil');setWizard(fresh.profile?.firstName?0:-1);
    setNotice('Apprentissage et révisions remis à zéro.');
    if(account)try{await pushState(fresh);await publishSocialProgress(fresh);}catch{setNotice('Remise à zéro effectuée sur ce téléphone. Synchronisation en attente.');}
  };
  useEffect(()=>{if(!state.profile?.firstName&&wizard===null)setWizard(-1);else if(!state.onboardingDone&&wizard===null)setWizard(0);},[]);
  useEffect(()=>{
    const open=(data:Record<string,unknown>|undefined)=>{const destination=notificationDestination(data);if(!destination)return;
      if(destination.kind==='program'){setReader(null);setWizard(null);setSocialView(null);setTab('Programme');}
      else if(destination.kind==='reviews'&&reviewsEnabled(loadState())){setReader(null);setWizard(null);setSocialView(null);setReviewOpen(true);}
      else if('linkId' in destination&&typeof destination.linkId==='string')setPendingLinkId(destination.linkId);
      Notifications.clearLastNotificationResponseAsync().catch(()=>{});
    };
    Notifications.getLastNotificationResponseAsync().then(response=>{if(response)open(response.notification.request.content.data);}).catch(()=>{});
    const response=Notifications.addNotificationResponseReceivedListener(event=>open(event.notification.request.content.data));
    const tokens=Notifications.addPushTokenListener(()=>{if(loadState().notifications?.permissionExplained)registerPushDevice().catch(()=>{});});
    return()=>{response.remove();tokens.remove();};
  },[]);
  useEffect(()=>{if(account&&pendingLinkId){setReader(null);setWizard(null);setSocialView('friends');}},[account,pendingLinkId]);
  useEffect(()=>{if(account&&pendingInviteCode){setReader(null);setWizard(null);setSocialView('friends');}},[account,pendingInviteCode]);
  useEffect(()=>{setMessagePresentationEnabled(state.notifications?.messages!==false);},[state.notifications?.messages]);
  useEffect(()=>{setProgressPresentationEnabled(state.notifications?.sharedProgress===true);},[state.notifications?.sharedProgress]);
  useEffect(()=>{
    scheduleLearningReminders(state.learningDays,state.onboardingDone&&state.notifications?.permissionExplained===true&&state.notifications?.learning!==false).catch(()=>{});
  },[state.onboardingDone,state.learningDays.join(','),state.notifications?.learning,state.notifications?.permissionExplained]);
  useEffect(()=>{const recent=[...new Set(Object.values(state.memorizedAt??{}).flatMap(date=>[addDays(date,1),addDays(date,2)]))];scheduleRevisionReminder([...state.revisions.map(r=>r.due),...Object.values(state.reviewDue??{}),...recent],reviewsEnabled(state)&&state.notifications?.permissionExplained===true&&state.notifications?.revision===true).catch(()=>{});},[state.revisions,state.reviewDue,state.memorizedAt,state.notifications?.revision,state.notifications?.permissionExplained,state.reviewSettings?.enabled]);
  useEffect(()=>{if(!state.onboardingDone||!reviewsEnabled(state))return;const next=prepareReviewSchedule(state);if(next!==state)update(next);},[state.onboardingDone,state.knowledge,state.memorizedAt,state.reviewSettings?.enabled,state.reviewSettings?.cycleDays]);
  useEffect(()=>{if(!account)return;
    const prefs=state.notifications;
    saveNotificationPreferences({messages:prefs?.messages!==false,friendRequests:prefs?.friendRequests!==false,sharedProgress:prefs?.sharedProgress===true,revision:prefs?.revision===true,messagePreview:prefs?.messagePreview!==false}).then(()=>{
      if(prefs?.permissionExplained&&(prefs.messages!==false||prefs.friendRequests!==false||prefs.sharedProgress===true))return registerPushDevice();
    }).catch(()=>{});
  },[account,state.notifications]);
  useEffect(()=>{if(!account){setUnreadCount(0);return;}const refresh=()=>unreadMessageCount().then(setUnreadCount).catch(()=>{});refresh();const timer=setInterval(refresh,15000);const channel=supabase?.channel('unread-private-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_messages'},refresh).subscribe();return()=>{clearInterval(timer);if(channel)supabase?.removeChannel(channel);};},[account,socialView]);
  useEffect(()=>{if(!account)return;syncPendingRecitations().catch(()=>{});const listener=DeviceAppState.addEventListener('change',status=>{if(status==='active')syncPendingRecitations().catch(()=>{});});return()=>listener.remove();},[account]);
  useEffect(()=>{if(!account)return;const refresh=async()=>{
    const rows=await myCorrectionMarkers();const current=loadState(),markers={...current.difficultyMarkers};
    for(const key of Object.keys(markers))if(markers[key].admin){const own={...markers[key]};delete own.admin;if(own.user)markers[key]=own;else delete markers[key];}
    for(const row of rows)if(!row.resolved_at)markers[row.verse_id]={...markers[row.verse_id],admin:{createdAt:row.created_at,comment:row.comment??undefined}};
    if(JSON.stringify(markers)!==JSON.stringify(current.difficultyMarkers??{}))update(touch({...current,difficultyMarkers:markers}));
  };refresh().catch(()=>{});const listener=DeviceAppState.addEventListener('change',status=>{if(status==='active')refresh().catch(()=>{});});return()=>listener.remove();},[account,recitationsOpen]);
  useEffect(()=>{
    const handle=async(url:string)=>{try{const invite=url.match(/^coranmemoire:\/\/friend\/([A-Za-z0-9_-]+)$/);if(invite){setPendingInviteCode(invite[1]);setTab('Profil');setNotice('Connecte-toi pour accepter cette invitation.');return;}const user=await consumeAuthLink(url);if(!user)return;
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
  useEffect(()=>{currentUser().then(async user=>{if(!user)return;setAccount(user.email??user.id);try{const remote=await pullState();const local=loadState();const {state:restored,shouldPush}=reconcileState(local,remote);if(restored!==local){setState(restored);saveState(restored);setWizard(restored.profile?.firstName?restored.onboardingDone?null:0:-1);}if(shouldPush)await pushState(restored);}catch{}}).catch(()=>{});},[]);
  useEffect(()=>{if(!account){setAdmin(false);return;}let active=true;
    (async()=>{try{await ensureSocialProfile();if(active){setAdmin(await isSocialAdmin());await publishSocialProgress(loadState());await setSocialOnline(true);}}catch{}})();
    const timer=setInterval(()=>{if(DeviceAppState.currentState==='active')setSocialOnline(true).catch(()=>{});},45000);
    const listener=DeviceAppState.addEventListener('change',status=>{setSocialOnline(status==='active').catch(()=>{});if(status==='active'&&loadState().notifications?.permissionExplained)registerPushDevice().catch(()=>{});else updatePushPresence(null).catch(()=>{});});
    return()=>{active=false;clearInterval(timer);listener.remove();setSocialOnline(false).catch(()=>{});};
  },[account]);
  useEffect(()=>{if(!account||!state.profile?.firstName)return;
    ensureSocialProfile().then(profile=>profile.display_name===state.profile!.firstName?undefined:updateSocialProfile({...profile,display_name:state.profile!.firstName})).catch(()=>{});
  },[account,state.profile?.firstName]);
  const openReader=(r:Reader)=>{setReader(r);setReaderFullscreen(false);setPage(pageOf(r.range.start));setMasked(false);setRevealed(null);};
  const closeReader=()=>{if(reader){const latest=loadState();const verseId=pageOf(reader.range.start)===page?reader.range.start:pageRange(page).start;update(touch({...latest,lastRead:{page,verseId,readAt:new Date().toISOString()}}));}setReader(null);setReaderFullscreen(false);};
  const edgeBack=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>Platform.OS==='ios'&&gesture.x0<26&&gesture.dx>22&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.4,
    onPanResponderRelease:(_,gesture)=>{if(gesture.dx<75)return;if(wizard!==null){if(wizard>0)setWizard(wizard-1);else if(state.onboardingDone)setWizard(null);return;}if(socialView){setSocialView(null);setPendingLinkId(null);return;}if(tab!=='Accueil')setTab('Accueil');},
  }),[wizard,socialView,tab,state.onboardingDone]);
  useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
    if(reader){closeReader();return true;}
    if(recitationsOpen){setRecitationsOpen(false);return true;}
    if(reviewOpen){setReviewOpen(false);return true;}
    if(socialView){setSocialView(null);setPendingLinkId(null);return true;}
    if(tab!=='Accueil'&&wizard===null){setTab('Accueil');return true;}
    return false;
  });return()=>subscription.remove();},[reader,page,recitationsOpen,reviewOpen,socialView,tab,wizard]);
  const statsNow=stats(state,today),prog=progress(state);
  const todaySessions=state.sessions.filter(s=>s.date===today&&s.status==='todo');
  const due=reviewsEnabled(state)?state.revisions.filter(r=>r.due<=today):[];
  const allDone=state.sessions.filter(s=>s.status==='done').length;
  const finishEstimate=state.sessions.filter(s=>s.status==='todo').at(-1)?.date;
  applyTheme(state.theme??'classic');
  return <SafeAreaView edges={readerFullscreen?['bottom']:['top','bottom']} style={{flex:1,backgroundColor:colors.cream}} {...(reader||socialView==='friends'?{}:edgeBack.panHandlers)}><StatusBar hidden={readerFullscreen} />
    {reader?<ReaderScreen reader={reader} page={page} setPage={setPage} masked={masked} setMasked={setMasked} revealed={revealed} setRevealed={setRevealed} onClose={closeReader} onReviewDone={(task,grade)=>{const next=gradeReviewTask(state,task,grade);update(next);const upcoming=reviewPlan(next).session[0];if(upcoming)openReader({range:upcoming,reviewTask:upcoming});else if(!reviewOnly&&todaySessions[0])openReader({range:todaySessions[0],sessionId:todaySessions[0].id});else closeReader();}} state={state} update={update} fullscreen={readerFullscreen} setFullscreen={setReaderFullscreen} />:
      wizard!==null?<Onboarding state={state} update={update} step={wizard} setStep={setWizard} onDone={()=>{setWizard(null);setTab('Accueil');}} />:
      socialView==='friends'?<FriendsScreen initialLinkId={pendingLinkId} initialCode={pendingInviteCode} shareText={`Mon objectif ${state.goal.label} est atteint à ${percent(prog.goal)}. Cette semaine, j’ai appris ${statsNow.week} versets.`} onClose={()=>{setSocialView(null);setPendingLinkId(null);setPendingInviteCode(null);}} />:
      socialView==='admin'?<AdminScreen onClose={()=>setSocialView(null)} />:
      recitationsOpen?<RecitationsScreen onClose={()=>setRecitationsOpen(false)} />:
      reviewOpen&&reviewsEnabled(state)?<ReviewScreen state={state} openReader={openReader} openRecitations={()=>setRecitationsOpen(true)} onClose={()=>setReviewOpen(false)} startSession={only=>{setReviewOnly(only);const task=reviewPlan(state).session[0];if(task)openReader({range:task,reviewTask:task});else if(!only&&todaySessions[0])openReader({range:todaySessions[0],sessionId:todaySessions[0].id});}} />:
      <>
        <ScrollView key={tab} contentContainerStyle={{paddingHorizontal:18,paddingBottom:30}}>
          {tab==='Accueil'&&<Home state={state} prog={prog} stat={statsNow} todaySessions={todaySessions} due={due} finishEstimate={finishEstimate} openReader={openReader} openReviews={()=>setReviewOpen(true)} setTab={setTab} unreadCount={unreadCount} openMessages={()=>{if(!account){setTab('Profil');setNotice('Connecte-toi pour accéder à tes messages.');return;}setPendingLinkId(null);setSocialView('friends');}} />}
          {tab==='Coran'&&<QuranScreen openReader={openReader} />}
          {tab==='Programme'&&<ProgramScreen state={state} update={update} openReader={openReader} openWizard={()=>setWizard(1)} />}
          {tab==='Progrès'&&<ProgressScreen state={state} prog={prog} stat={statsNow} allDone={allDone} />}
          {tab==='Profil'&&<ProfileScreen state={state} update={update} account={account} setAccount={setAccount} setNotice={setNotice} openKnowledge={()=>setWizard(0)} openGoal={()=>setWizard(1)} openFriends={()=>{setPendingLinkId(null);setSocialView('friends');}} openAdmin={()=>setSocialView('admin')} openRecitations={()=>setRecitationsOpen(true)} admin={admin} passwordRecovery={passwordRecovery} setPasswordRecovery={setPasswordRecovery} onPasswordReady={()=>{if(!state.profile?.firstName)setWizard(-1);else if(!state.onboardingDone)setWizard(0);}} onReset={resetAll} />}
        </ScrollView>
        <View style={{height:74,backgroundColor:state.theme==='night'?colors.green:colors.paper,borderTopWidth:1,borderColor:colors.line,flexDirection:'row',justifyContent:'space-around',paddingBottom:10,paddingTop:7}}>
          {(['Accueil','Coran','Programme','Progrès','Profil'] as Tab[]).map((name,i)=>{const active=tab===name,dark=state.theme==='night';return <Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:active}} onPress={()=>setTab(name)} style={{alignItems:'center',justifyContent:'center',flex:1}}><View style={{width:26,height:3,borderRadius:3,backgroundColor:active?(dark?colors.gold:colors.green):'transparent',marginBottom:3}} /><Text style={{fontSize:22,color:active?(dark?colors.gold:colors.green):(dark?'#CDD8E3':colors.muted)}}>{['⌂','▣','◇','▥','◯'][i]}</Text><Text style={{fontSize:10,fontWeight:active?'700':'500',color:active?(dark?colors.gold:colors.green):(dark?'#CDD8E3':colors.muted)}}>{name}</Text></Pressable>;})}
        </View>
      </>}
    {notice?<Pressable accessibilityRole="alert" onPress={()=>setNotice('')} style={{position:'absolute',left:18,right:18,bottom:reader||wizard!==null||socialView?18:82,zIndex:50,padding:14,backgroundColor:colors.paper,borderWidth:1,borderColor:colors.gold,borderRadius:14,elevation:8,shadowColor:'#000',shadowOpacity:0.16,shadowRadius:8}}><Label style={{fontSize:14,fontWeight:'600'}}>{notice}  ×</Label></Pressable>:null}
  </SafeAreaView>;
}

function Home({state,prog,stat,todaySessions,due,finishEstimate,openReader,openReviews,setTab,unreadCount,openMessages}:{state:AppState;prog:ReturnType<typeof progress>;stat:ReturnType<typeof stats>;todaySessions:Session[];due:AppState['revisions'];finishEstimate?:string;openReader:(r:Reader)=>void;openReviews:()=>void;setTab:(tab:Tab)=>void;unreadCount:number;openMessages:()=>void}){
  const theme=state.theme??'classic';
  const last=state.lastRead;
  const lastVerse=last?.verseId??todaySessions[0]?.start??state.goal.ranges[0]?.start??1;
  const lastPage=last?.page??pageOf(lastVerse);
  const lastSurah=surahs[verseAt(lastVerse).surah-1];
  const resume=()=>openReader({range:{start:lastVerse,end:lastVerse}});
  const shortcut=(label:string,glyph:string,onPress:()=>void)=><Pressable key={label} onPress={onPress} accessibilityLabel={label} style={{flex:1,alignItems:'center'}}><View style={{height:54,width:54,borderRadius:15,backgroundColor:colors.soft,borderWidth:1,borderColor:colors.softBorder,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:27,color:colors.green}}>{glyph}</Text></View><Label style={{fontSize:11,color:colors.text,marginTop:6}}>{label}</Label></Pressable>;
  return <>
    <ImageBackground source={heroImages[theme]} resizeMode="cover" style={{height:260,marginHorizontal:-18,overflow:'hidden'}} imageStyle={{width:'100%',height:'100%'}}>
      <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:25,paddingTop:24}}><View style={{flex:1}}><Text style={{color:'white',fontSize:25,fontWeight:'800',textShadowColor:'#0006',textShadowRadius:4}}>Le Coran</Text><Text style={{color:'white',fontSize:13,marginTop:4,textShadowColor:'#0008',textShadowRadius:4}}>Bonjour{state.profile?.firstName?` ${state.profile.firstName}`:''}</Text></View><Pressable accessibilityLabel={`Messages, ${unreadCount} non lus`} onPress={openMessages} style={{padding:8}}><Text style={{fontSize:24,color:'white'}}>✉</Text>{unreadCount>0&&<Text style={{color:'white',fontWeight:'800',position:'absolute',right:0,top:0,backgroundColor:colors.red,borderRadius:12,paddingHorizontal:5,fontSize:11}}>{unreadCount>99?'99+':unreadCount}</Text>}</Pressable><Pressable accessibilityLabel="Ouvrir les réglages" onPress={()=>setTab('Profil')} style={{padding:8}}><Text style={{fontSize:23,color:'white'}}>⚙</Text></Pressable></View>
    </ImageBackground>
    <Pressable onPress={resume} style={{backgroundColor:colors.paper,borderWidth:1,borderColor:colors.line,borderRadius:19,padding:18,marginTop:-46,marginBottom:16,elevation:5,shadowColor:colors.green,shadowOpacity:0.12,shadowRadius:8,shadowOffset:{width:0,height:4}}}>
      <View style={{flexDirection:'row',alignItems:'center'}}><View style={{flex:1}}><Label style={{fontWeight:'800',fontSize:17}}>Reprendre ma lecture</Label><Label style={{marginTop:10,fontSize:13}}>{lastSurah.name}</Label><Label style={{fontSize:12,color:colors.muted}}>Page {lastPage} · Verset {verseAt(lastVerse).ayah}</Label></View><View style={{width:70,height:79,borderRadius:22,backgroundColor:colors.green,borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.progress,fontSize:39}}>۞</Text></View></View>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:13}}><View style={{flex:1,height:7,backgroundColor:colors.soft,borderRadius:8}}><View style={{width:percent(prog.goal) as any,height:7,backgroundColor:colors.green2,borderRadius:8}} /></View><Label style={{fontSize:12,color:colors.green}}>{percent(prog.goal)}</Label></View>
    </Pressable>
    <View style={{flexDirection:'row',justifyContent:'space-between',gap:4,marginBottom:19}}>{[
      shortcut('Lecture','▣',resume),
      shortcut('Apprentissage','◇',()=>todaySessions[0]?openReader({range:todaySessions[0],sessionId:todaySessions[0].id}):setTab('Programme')),
      ...(reviewsEnabled(state)?[shortcut('Révisions','↻',openReviews)]:[]),
      shortcut('Traduction','文',()=>openReader({range:{start:lastVerse,end:lastVerse},initialLanguage:'fr'})),
    ]}</View>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'}}>{section('Mes objectifs')}<Pressable onPress={()=>setTab('Programme')}><Label style={{fontSize:12,color:colors.green}}>Voir tout</Label></Pressable></View>
    <Card style={{flexDirection:'row',alignItems:'center',gap:14}}><View style={{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft}}><Text style={{color:colors.green2,fontSize:28}}>◎</Text></View><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{state.goal.label}</Label><Label style={{fontSize:12,color:colors.muted,marginTop:3}}>{Math.round(prog.goal*100)} % de l’objectif · {Math.round(prog.quran*100)} % du Coran</Label><View style={{height:6,backgroundColor:colors.soft,borderRadius:6,marginTop:9}}><View style={{width:percent(prog.goal) as any,height:6,backgroundColor:colors.green2,borderRadius:6}} /></View></View></Card>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'}}>{section('Dernières lectures')}<Pressable onPress={()=>setTab('Coran')}><Label style={{fontSize:12,color:colors.green}}>Voir tout</Label></Pressable></View>
    <Pressable onPress={resume}><Card style={{flexDirection:'row',alignItems:'center',gap:13}}><View style={{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:colors.surahBadge}}><Text style={{fontSize:23,color:colors.green}}>۞</Text></View><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{lastSurah.name}</Label><Label style={{fontSize:12,color:colors.muted}}>Page {lastPage} · Verset {verseAt(lastVerse).ayah}</Label></View><View style={{width:32,height:32,borderRadius:16,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'}}><Text style={{color:'white'}}>▶</Text></View></Card></Pressable>
    {section('Aujourd’hui')}
    <Card>{todaySessions.length?<><Label style={{color:colors.muted,fontSize:13}}>PROGRAMME D’APPRENTISSAGE</Label>{todaySessions.map(s=><View key={s.id} style={{marginTop:9}}><Label style={{fontWeight:'700'}}>{reference(s)}</Label><Label style={{color:colors.muted,fontSize:13}}>{paceLabels[s.unit]}</Label></View>)}</>:<Label style={{color:colors.muted}}>Aucune nouvelle séance prévue aujourd’hui.</Label>}</Card>
    <Button disabled={!todaySessions.length} onPress={()=>todaySessions[0]&&openReader({range:todaySessions[0],sessionId:todaySessions[0].id})}>COMMENCER MON APPRENTISSAGE</Button>
    {reviewsEnabled(state)&&<Button secondary onPress={openReviews}>MES RÉVISIONS</Button>}
    <View style={{flexDirection:'row',gap:12,marginTop:18}}><Card style={{flex:1}}><Label style={{fontSize:25,fontWeight:'700',color:colors.green}}>{stat.weeklySessions}</Label><Label style={{fontSize:12,color:colors.muted}}>séances cette semaine</Label></Card><Card style={{flex:1}}><Label style={{fontSize:25,fontWeight:'700',color:colors.green}}>{stat.month}</Label><Label style={{fontSize:12,color:colors.muted}}>versets ce mois</Label></Card></View>
    <Card><Label style={{fontWeight:'700'}}>Fin estimée de l’objectif</Label><Label style={{color:colors.muted,marginTop:4}}>{finishEstimate?`Objectif atteint le ${fullDate(finishEstimate)}`:prog.goal>=1?'Objectif atteint':'Au-delà du programme généré'}</Label></Card>
  </>;
}

function ReviewScreen({state,openReader,openRecitations,onClose,startSession}:{state:AppState;openReader:(r:Reader)=>void;openRecitations:()=>void;onClose:()=>void;startSession:(only:boolean)=>void}){
  const plan=reviewPlan(state);
  const categories:[string,ReviewTask[],string][]=[
    ['Révisions prioritaires',plan.priority,'Les versets à retravailler, marqués par toi ou par le professeur.'],
    ['Révisions récentes',plan.recent,'Les versets appris pendant les trois derniers jours.'],
    ['Révisions habituelles',plan.habitual,`Cycle de ${state.reviewSettings?.cycleDays??7} jours. Les séances manquées reviennent progressivement.`],
  ];
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:55}}><Pressable onPress={onClose} accessibilityLabel="Revenir" style={{paddingVertical:7}}><Label style={{fontSize:20}}>‹ Retour</Label></Pressable><Title>Mes révisions</Title><Label style={{color:colors.muted,marginBottom:14}}>Un programme fondé sur les versets réellement mémorisés.</Label>
    <Card><Label style={{fontWeight:'700'}}>Mon suivi</Label><Label style={{color:colors.muted,marginTop:7}}>{memorizedIds(state).length} versets mémorisés · {plan.completeJuz} juz’ · {plan.completeRub} rub‘ · {plan.completeNisf} nisf</Label><Label style={{color:colors.muted,marginTop:4}}>{state.reviewHistory?.length??0} révisions effectuées · {Object.values(state.difficultyMarkers??{}).filter(marker=>marker.user||marker.admin).length} versets prioritaires</Label></Card>
    {categories.map(([title,tasks,description])=><Card key={title}><Label style={{fontSize:18,fontWeight:'700'}}>{title}</Label><Label style={{color:colors.muted,fontSize:13,marginTop:5}}>{description}</Label><Label style={{color:colors.green,fontWeight:'700',marginTop:8}}>{tasks.length} passage{tasks.length===1?'':'s'} {title==='Révisions récentes'?'en consolidation':'à revoir'}</Label>{tasks.slice(0,5).map(task=><Pressable key={task.id} onPress={()=>openReader({range:task,reviewTask:task})} style={{paddingVertical:9,borderTopWidth:1,borderColor:colors.line,marginTop:7}}><Label>{task.label==='Versets'?reference(task):`${task.label} · ${reference(task)}`} ›</Label></Pressable>)}</Card>)}
    <Button disabled={!plan.session.length&&!state.sessions.some(s=>s.date===todayLocal()&&s.status==='todo')} onPress={()=>startSession(false)}>Commencer ma séance</Button>
    <Button secondary disabled={!plan.session.length} onPress={()=>startSession(true)}>Aujourd’hui, je souhaite seulement réviser</Button>
    <Button secondary onPress={openRecitations}>Mes récitations</Button>
  </ScrollView>;
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
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{[[stat.today,'versets aujourd’hui'],[stat.week,'cette semaine'],[stat.month,'ce mois'],[stat.hizbs,'hizb terminés'],[stat.days,'jours d’apprentissage'],...(reviewsEnabled(state)?[[stat.revisions+(state.reviewHistory?.length??0),'révisions effectuées']]:[])].map(([n,l])=><Card key={String(l)} style={{width:'48%',minHeight:95,marginBottom:0}}><Label style={{fontSize:24,fontWeight:'700',color:colors.green}}>{n}</Label><Label style={{fontSize:12,color:colors.muted}}>{l}</Label></Card>)}</View>
    {section(`Historique · ${allDone} séances`)}
    {state.sessions.filter(s=>s.status==='done').slice(-30).reverse().map(s=><Card key={s.id} style={{paddingVertical:10}}><Label style={{fontSize:12,color:colors.muted}}>{s.completedDate??s.completedAt?.slice(0,10)}</Label><Label>{reference(s)}</Label></Card>)}
  </>;
}

function ProfileScreen({state,update,account,setAccount,setNotice,openKnowledge,openGoal,openFriends,openAdmin,openRecitations,admin,passwordRecovery,setPasswordRecovery,onPasswordReady,onReset}:{state:AppState;update:(s:AppState)=>void;account:string|null;setAccount:(v:string|null)=>void;setNotice:(v:string)=>void;openKnowledge:()=>void;openGoal:()=>void;openFriends:()=>void;openAdmin:()=>void;openRecitations:()=>void;admin:boolean;passwordRecovery:boolean;setPasswordRecovery:(v:boolean)=>void;onPasswordReady:()=>void;onReset:()=>Promise<void>}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  const [newPassword,setNewPassword]=useState('');
  const [resetting,setResetting]=useState(false);
  const [firstName,setFirstName]=useState(state.profile?.firstName??'');
  const [deviceNotificationsAllowed,setDeviceNotificationsAllowed]=useState(false);
  const notificationPrefs:NonNullable<AppState['notifications']>=state.notifications??{messages:true,learning:true};
  useEffect(()=>{Notifications.getPermissionsAsync().then(result=>{const granted=result.granted||result.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;setDeviceNotificationsAllowed(granted);if(granted&&!notificationPrefs.permissionExplained)update(touch({...state,notifications:{...notificationPrefs,permissionExplained:true}}));}).catch(()=>{});},[]);
  const setNotification=(key:'messages'|'learning'|'friendRequests'|'sharedProgress'|'revision'|'messagePreview',value:boolean)=>update(touch({...state,notifications:{...notificationPrefs,[key]:value}}));
  const notificationSwitch=(label:string,key:'messages'|'learning'|'friendRequests'|'sharedProgress'|'revision'|'messagePreview',fallback:boolean)=><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12,gap:12}}><Label style={{flex:1}}>{label}</Label><Switch accessibilityLabel={label} value={notificationPrefs[key]??fallback} onValueChange={value=>setNotification(key,value)} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View>;
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
    <Card><Label style={{fontWeight:'700'}}>Apprentissage</Label><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:10}}><Label style={{flex:1}}>Activer l’espace Révisions</Label><Switch accessibilityLabel="Activer l’espace Révisions" value={reviewsEnabled(state)} onValueChange={value=>update(setReviewsEnabled(state,value))} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View>{reviewsEnabled(state)&&<><Label style={{color:colors.muted,fontSize:13,marginTop:12}}>Cycle des révisions habituelles</Label><View style={{flexDirection:'row',gap:5,marginTop:8}}>{([7,14,21,30] as const).map(days=><View key={days} style={{flex:1}}><Button small secondary={(state.reviewSettings?.cycleDays??7)!==days} onPress={()=>update(setReviewCycle(state,days))}>{days} j</Button></View>)}</View></>}</Card>
    <Card><Label style={{fontWeight:'700'}}>Mes récitations</Label><Label style={{color:colors.muted,fontSize:13,marginTop:6}}>Réécouter mes enregistrements et consulter les corrections du professeur.</Label><Button secondary onPress={openRecitations}>Ouvrir mes récitations</Button></Card>
    {account?<Card><Label style={{fontWeight:'700'}}>Amis et entraide</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Suivi partagé, messages et cercles privés.</Label><Button onPress={openFriends}>Ouvrir mes amis</Button>{admin?<Button secondary onPress={openAdmin}>Modérer les discussions</Button>:null}</Card>:null}
    <Card><Label style={{fontWeight:'700'}}>Synchronisation</Label>{!syncConfigured?<Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Ajoute l’URL et la clé publique de ton projet Supabase dans le fichier .env pour activer le compte.</Label>:account?<><Label style={{color:colors.muted,marginVertical:8}}>{account}</Label><Button secondary onPress={async()=>{try{await pushState(state);setNotice('Données synchronisées.');}catch(e:any){setNotice(e.message);}}}>Synchroniser maintenant</Button><Button secondary onPress={async()=>{await setSocialOnline(false).catch(()=>{});await unregisterPushDevice().catch(()=>{});await signOut();setAccount(null);setNotice('Déconnecté. Les données restent sur ce téléphone.');}}>Se déconnecter</Button></>:<><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Retrouve ta progression sur un autre téléphone.</Label><Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" keyboardType="email-address" /><Field value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry /><Button disabled={busy||!email||!password} onPress={()=>handleAuth(false)}>Se connecter</Button><Button secondary disabled={busy||!email||password.length<6} onPress={()=>handleAuth(true)}>Créer un compte</Button><Button secondary disabled={busy||!email.includes('@')} onPress={async()=>{setBusy(true);try{await requestPasswordLink(email);setNotice('Un lien vient de t’être envoyé. Ouvre-le sur ce téléphone après avoir installé la nouvelle version de l’application.');}catch(e:any){setNotice(e.message);}finally{Keyboard.dismiss();setBusy(false);}}}>Recevoir un lien pour créer ou changer mon mot de passe</Button></>}</Card>
    <Card><Label style={{fontWeight:'700'}}>Notifications</Label>{!deviceNotificationsAllowed?<><Label style={{color:colors.muted,fontSize:13,marginTop:8}}>Les notifications t’avertissent des messages et invitations, et te rappellent d’apprendre ou de réviser. Tu peux choisir chaque type ci-dessous.</Label><Button secondary onPress={()=>ensureNotificationPermission(true).then(granted=>{if(granted){setDeviceNotificationsAllowed(true);update(touch({...state,notifications:{...notificationPrefs,permissionExplained:true}}));setNotice('Notifications autorisées.');}else setNotice('Autorisation refusée. Tu peux la modifier dans les réglages du téléphone.');}).catch(()=>setNotice('Les notifications sont indisponibles sur ce téléphone.'))}>Autoriser les notifications sur ce téléphone</Button></>:null}{notificationSwitch('Messages privés','messages',true)}{notificationSwitch('Demandes d’amis','friendRequests',true)}{notificationSwitch('Progression partagée par les amis','sharedProgress',false)}{notificationSwitch('Rappels d’apprentissage','learning',true)}{reviewsEnabled(state)&&notificationSwitch('Rappels de révision','revision',false)}{notificationSwitch('Afficher le contenu des messages','messagePreview',true)}<Label style={{color:colors.muted,fontSize:13,marginTop:12}}>Jours d’apprentissage : {state.learningDays.length?[1,2,3,4,5,6,0].filter(day=>state.learningDays.includes(day)).map(day=>weekdays[day]).join(', '):'aucun'} · 19 h 00</Label>{__DEV__?<Button secondary small onPress={()=>testLocalNotification().then(()=>setNotice('Notification de test programmée dans 5 secondes.')).catch(e=>setNotice(`Test impossible : ${e.message}`))}>Tester les notifications</Button>:null}</Card>
    <Card><Label style={{fontWeight:'700'}}>Apparence</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Choisis ton univers visuel.</Label>{themeOptions.map(option=>{const selected=(state.theme??'classic')===option.key;return <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{selected}} onPress={()=>update(touch({...state,theme:option.key}))} style={{borderWidth:selected?2:1,borderColor:selected?option.swatches[0]:colors.line,borderRadius:15,padding:11,marginBottom:9,backgroundColor:colors.paper,flexDirection:'row',alignItems:'center',gap:12}}><View style={{height:54,width:47,borderRadius:9,backgroundColor:option.swatches[2],borderWidth:1,borderColor:option.swatches[1],overflow:'hidden'}}><View style={{height:21,backgroundColor:option.swatches[0]}} /><View style={{height:20,marginHorizontal:6,marginTop:-5,borderRadius:4,backgroundColor:option.swatches[2],borderColor:option.swatches[1],borderWidth:1}} /></View><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{option.name}</Label><Label style={{fontSize:12,color:colors.muted}}>{option.description}</Label><View style={{flexDirection:'row',gap:5,marginTop:5}}>{option.swatches.map(swatch=><View key={swatch} style={{width:13,height:13,borderRadius:7,backgroundColor:swatch,borderWidth:1,borderColor:'#0002'}} />)}</View></View><Label style={{fontSize:20,color:selected?colors.green2:colors.muted}}>{selected?'◉':'○'}</Label></Pressable>})}</Card>
    <Card><Label style={{fontWeight:'700'}}>Affichage du Coran</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Choisis la présentation arabe des pages.</Label><Choice label="Moushaf de Médine" subtitle="Le Coran traditionnel, avec sa mise en page classique." selected={(state.reader?.mushaf??'traditional')==='traditional'} onPress={()=>update(touch({...state,reader:{mushaf:'traditional',followAudio:state.reader?.followAudio!==false}}))} /><Choice label="Lecture simplifiée" subtitle="Lecture verset par verset, avec les règles de Tajweed en couleur." selected={state.reader?.mushaf==='tajweed'} onPress={()=>update(touch({...state,reader:{mushaf:'tajweed',followAudio:state.reader?.followAudio!==false}}))} /><Choice label="Moushaf Tajweed" subtitle="Pages traditionnelles en couleur. Le suivi sur image et l’appui long attendent les coordonnées vérifiées." selected={state.reader?.mushaf==='tajweedPages'} onPress={()=>update(touch({...state,reader:{mushaf:'tajweedPages',followAudio:state.reader?.followAudio!==false}}))} /><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8}}><Label style={{flex:1}}>Suivre automatiquement la récitation sur la page suivante</Label><Switch value={state.reader?.followAudio!==false} onValueChange={value=>update(touch({...state,reader:{mushaf:state.reader?.mushaf??'traditional',followAudio:value}}))} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View></Card>
    <Card><Label style={{fontWeight:'700'}}>Réglages</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Recommencer le questionnaire et effacer tout l’apprentissage et toutes les révisions. Ton prénom et ton thème seront conservés.</Label><Button secondary disabled={resetting} onPress={confirmReset}>Tout remettre à zéro</Button></Card>
    <Card><Label style={{fontWeight:'700'}}>Sources du Coran</Label><Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Texte Uthmani Hafs : Tanzil Project, copyright 2007–2021, licence CC BY 3.0. Texte reproduit sans modification.</Label><Pressable onPress={()=>Linking.openURL('https://tanzil.net')}><Label style={{color:colors.green2,textDecorationLine:'underline',marginTop:7}}>Voir Tanzil et les mises à jour ↗</Label></Pressable><Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Pages Hafs 1405 issues de l’IPA fournie. Pages Tajweed couleur : EasyQuran / Dar Al Maarifah, avec autorisation déclarée par le propriétaire du projet. Lecture simplifiée : annotations de cpfair sous CC BY 4.0 sur texte Tanzil Hafs 2017. Traduction française du sens : Rachid Maach, version 1.0.3, QuranEnc. Divisions juz’, hizb et rub‘ : Quran Meta. Les toumoun Hafs attendent une validation indépendante.</Label></Card>
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
  const goalAlreadyKnown=(preset:GoalPreset)=>goalIsAlreadyKnown(state,preset);
  const applyKnown=(range:Range)=>updateKnowledge(toggleKnownRange(state,range));
  const choosePaceLevel=(level:PacePreset)=>{setPaceLevel(level);update(touch({...state,pace:pacePresets[level].pace}));};
  const next=()=>{
    setError('');
    if(step===-1){const value=firstName.trim();if(!sex){setError('Choisis Homme ou Femme pour continuer.');return;}if(value.length<2||value.length>40){setError('Saisis ton prénom, de 2 à 40 caractères.');return;}update(touch({...state,profile:{sex,firstName:value}}));if(state.onboardingDone)onDone();else setStep(0);return;}
    if(step===0){if(kind!=='custom'&&goalAlreadyKnown(kind)){const nextKind=(['lastTen','sabbih','amma','toYasin','half','all'] as GoalPreset[]).find(preset=>!goalAlreadyKnown(preset));setKind(nextKind??'custom');}setStep(1);return;}
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
        {([['lastTen','Je souhaite apprendre les petites sourates (les 10 dernières)'],['sabbih','Je souhaite apprendre le Hizb Sabbih'],['amma','Je souhaite apprendre le Juz’ ‘Amma'],['toYasin','Je souhaite apprendre jusqu’à la sourate Ya-Sîn'],['half','Je souhaite mémoriser la moitié du Coran'],['all','Je souhaite mémoriser tout le Coran'],['custom','Créer un objectif personnalisé']] as [typeof kind,string][]).filter(([value])=>value==='custom'||!goalAlreadyKnown(value)).map(([value,label])=><Choice key={value} label={label} selected={kind===value} onPress={()=>setKind(value)} />)}
        {(kind==='lastTen'||kind==='sabbih'||kind==='amma'||kind==='toYasin'||kind==='half')&&<Label style={{color:colors.muted,fontSize:13,marginBottom:8}}>Apprentissage depuis An-Nâs, en remontant sourate après sourate.</Label>}
        {kind==='all'&&<>{section('Par où commencer ?')}<Choice label="Depuis Al-Fatiha" subtitle="Sourates 1 à 114" selected={direction==='fromStart'} onPress={()=>setDirection('fromStart')} /><Choice label="Depuis An-Nâs" subtitle="Sourates 114 à 1 ; versets de chaque sourate dans l’ordre" selected={direction==='fromNas'} onPress={()=>setDirection('fromNas')} /></>}
        {kind==='custom'&&<>{section('Juz’')}{juzs.map(j=><CheckChoice key={j.number} label={`Juz’ ${j.number}`} selected={selectedJuz.includes(j.number)} onPress={()=>toggle(selectedJuz,j.number,setSelectedJuz)} />)}{section('Hizb')}{hizbs.map(h=><CheckChoice key={h.number} label={`Hizb ${h.number}`} selected={selectedHizb.includes(h.number)} onPress={()=>toggle(selectedHizb,h.number,setSelectedHizb)} />)}{section('Sourates')}{surahs.map(s=><CheckChoice key={s.number} label={`${s.number}. ${s.name}`} selected={selectedSurahs.includes(s.number)} onPress={()=>toggle(selectedSurahs,s.number,setSelectedSurahs)} />)}{section('Passage précis')}<Field value={customSurah} onChangeText={setCustomSurah} placeholder="Numéro de sourate" keyboardType="number-pad" /><View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Field value={customStart} onChangeText={setCustomStart} placeholder="Verset début" keyboardType="number-pad" /></View><View style={{flex:1}}><Field value={customEnd} onChangeText={setCustomEnd} placeholder="Verset fin" keyboardType="number-pad" /></View></View><Button secondary onPress={()=>addPartial(true)}>Ajouter le passage</Button>{customRanges.map((r,i)=><Label key={i}>{reference(r)}</Label>)}</>}
      </>}
      {step===2&&<><Label style={{color:colors.muted,marginBottom:12}}>Choisis d’abord ton niveau. Les quantités proposées correspondent ensuite à ce niveau. Tu choisiras les jours à l’étape suivante.</Label>{(Object.keys(pacePresets) as PacePreset[]).map(key=><Choice key={key} label={pacePresets[key].label} subtitle={pacePresets[key].description} selected={paceLevel===key} onPress={()=>choosePaceLevel(key)} />)}{paceLevel==='beginner'&&<>{section('Combien de versets par séance ?')}{beginnerPaces.map(p=><Choice key={p} label={paceLabels[p]} selected={state.pace===p} onPress={()=>update(touch({...state,pace:p}))} />)}</>}{paceLevel==='intermediate'&&<Card><Label>Une demi-page par séance.</Label></Card>}{paceLevel==='intensive'&&<>{section('Combien par séance ?')}{intensivePaces.map(p=><Choice key={p} label={paceLabels[p]} selected={state.pace===p} onPress={()=>update(touch({...state,pace:p}))} />)}</>}</>}
      {step===3&&<><Label style={{color:colors.muted,marginBottom:12}}>Les jours non sélectionnés restent libres pour les révisions.</Label>{[1,2,3,4,5,6,0].map(d=><CheckChoice key={d} label={weekdays[d]} selected={state.learningDays.includes(d)} onPress={()=>update(touch({...state,learningDays:state.learningDays.includes(d)?state.learningDays.filter(x=>x!==d):[...state.learningDays,d]}))} />)}</>}
      {!!error&&<Label style={{color:colors.red,marginVertical:10}}>{error}</Label>}
    </ScrollView>
    <View style={{paddingHorizontal:18,paddingBottom:18,borderTopWidth:1,borderColor:colors.line,backgroundColor:colors.paper}}><View style={{flexDirection:'row',gap:10}}>{step>0&&<View style={{flex:1}}><Button secondary onPress={()=>setStep(step-1)}>Retour</Button></View>}<View style={{flex:2}}><Button onPress={next}>{step===3?'Créer mon programme':'Continuer'}</Button></View></View>{state.onboardingDone&&<Pressable onPress={onDone} style={{alignItems:'center',paddingTop:7}}><Label style={{color:colors.muted,fontSize:13}}>Fermer</Label></Pressable>}</View>
  </>;
}

function ReaderScreen({reader,page,setPage,masked,setMasked,revealed,setRevealed,onClose,onReviewDone,state,update,fullscreen,setFullscreen}:{reader:Reader;page:number;setPage:(n:number)=>void;masked:boolean;setMasked:(v:boolean)=>void;revealed:number|null;setRevealed:(n:number|null)=>void;onClose:()=>void;onReviewDone:(task:ReviewTask,grade:'perfect'|'hesitant'|'rework')=>void;state:AppState;update:(s:AppState)=>void;fullscreen:boolean;setFullscreen:(value:boolean)=>void}){
  const {width}=useWindowDimensions();const imageWidth=Math.min(width-(fullscreen?8:28),600),imageHeight=(imageWidth-4)*3106/1920+4;
  const [playingVerseId,setPlayingVerseId]=useState<number|null>(null);
  const [language,setLanguage]=useState<'ar'|'fr'>(reader.initialLanguage??'ar'),[selectedVerse,setSelectedVerse]=useState<number|null>(null),[translationOptions,setTranslationOptions]=useState(false),[audioCommand,setAudioCommand]=useState<AudioCommand|null>(null),[commandSerial,setCommandSerial]=useState(0),[commandsVisible,setCommandsVisible]=useState(true);
  const readerScroll=useRef<ScrollView>(null);
  const showPage=(next:number)=>{setPage(next);readerScroll.current?.scrollTo({y:0,animated:false});};
  const commandsTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(commandsTimer.current)clearTimeout(commandsTimer.current);},[]);
  useEffect(()=>{if(!fullscreen)return;commandsTimer.current=setTimeout(()=>setCommandsVisible(false),4500);return()=>{if(commandsTimer.current)clearTimeout(commandsTimer.current);};},[fullscreen]);
  const revealCommands=()=>{setCommandsVisible(true);if(commandsTimer.current)clearTimeout(commandsTimer.current);if(fullscreen)commandsTimer.current=setTimeout(()=>setCommandsVisible(false),4500);};
  const followAudio=(id:number|null)=>{setPlayingVerseId(id);if(id!==null&&state.reader?.followAudio!==false&&(state.reader?.mushaf!=='tajweedPages'||language==='fr')&&pageOf(id)!==page)showPage(pageOf(id));};
  const audioAction=(id:number,action:AudioCommand['action'])=>{setAudioCommand({serial:commandSerial+1,id,action});setCommandSerial(commandSerial+1);setSelectedVerse(null);};
  const chooseMushaf=()=>Alert.alert('Affichage du Coran','Choisis une présentation.',[
    {text:'Moushaf de Médine',onPress:()=>update(touch({...state,reader:{mushaf:'traditional',followAudio:state.reader?.followAudio!==false}}))},
    {text:'Lecture simplifiée',onPress:()=>update(touch({...state,reader:{mushaf:'tajweed',followAudio:state.reader?.followAudio!==false}}))},
    {text:'Moushaf Tajweed',onPress:()=>update(touch({...state,reader:{mushaf:'tajweedPages',followAudio:state.reader?.followAudio!==false}}))},
    {text:'Annuler',style:'cancel'},
  ]);
  const swipe=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dx)>18&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.5,
    onPanResponderTerminationRequest:()=>false,
    onPanResponderRelease:(_,gesture)=>{if(Platform.OS==='ios'&&gesture.x0<28&&gesture.dx>75){onClose();return;}const next=pageAfterSwipe(page,gesture.dx,gesture.dy);if(next!==page){showPage(next);setRevealed(null);}},
  }),[page,setPage,setRevealed,onClose]);
  const from=pageOf(reader.range.start),to=pageOf(reader.range.end);
  const targetVerses=Array.from({length:reader.range.end-reader.range.start+1},(_,i)=>reader.range.start+i);
  const visible=targetVerses.filter(id=>pageOf(id)===page);
  const nextReveal=revealed===null?visible[0]:visible.find(id=>id>revealed)??visible[0];
  const validate=(kind:'done'|'work'|'postpone')=>{if(!reader.sessionId)return;const next=kind==='postpone'?postponeSession(state,reader.sessionId):completeSession(state,reader.sessionId,kind==='done');update(next);onClose();};
  const grade=(value:'perfect'|'hesitant'|'errors'|'relearn')=>{if(!reader.revisionId)return;const next=gradeRevision(state,reader.revisionId,value);update(value==='relearn'?generateProgram(next):next);onClose();};
  return <View style={{flex:1}}>
    {(!fullscreen||commandsVisible)&&<View style={{paddingHorizontal:fullscreen?8:18,paddingBottom:8,paddingTop:fullscreen?8:0,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:colors.cream}}><Pressable accessibilityLabel="Revenir à l’écran précédent" onPress={onClose} style={{padding:8}}><Label style={{fontSize:22}}>‹</Label></Pressable><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{reader.sessionId?'Séance du jour':reader.revisionId||reader.reviewTask?'Révision':'Le Coran'}</Label>{!fullscreen&&<Label style={{color:colors.muted,fontSize:12}}>{reference(reader.range)}</Label>}</View><Pressable accessibilityLabel="Changer le Moushaf" onPress={chooseMushaf} style={{padding:8,borderRadius:9,backgroundColor:colors.soft}}><Label style={{fontSize:12,color:colors.green}}>{state.reader?.mushaf==='tajweed'?'Simplifiée':state.reader?.mushaf==='tajweedPages'?'Tajweed':'Médine'} ⌄</Label></Pressable><Pressable accessibilityLabel={language==='ar'?'Voir la traduction française':'Voir le Coran en arabe'} onPress={()=>setLanguage(language==='ar'?'fr':'ar')} style={{padding:8,borderRadius:9,backgroundColor:colors.soft}}><Label style={{fontSize:13,color:colors.green}}>FR / عربي</Label></Pressable><Pressable accessibilityLabel={fullscreen?'Quitter le plein écran':'Plein écran'} onPress={()=>{if(!fullscreen){setFullscreen(true);revealCommands();}else{setFullscreen(false);setCommandsVisible(true);if(commandsTimer.current)clearTimeout(commandsTimer.current);}}} style={{padding:8}}><Label style={{fontSize:20,color:colors.green}}>{fullscreen?'⤢':'⛶'}</Label></Pressable></View>}
    <ScrollView ref={readerScroll} style={{flex:1}} contentContainerStyle={{alignItems:'center',paddingBottom:Math.max(100,fullscreen?35:100)}}>
      {(!fullscreen||commandsVisible)&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',width:imageWidth,marginBottom:7}}><Pressable onPress={()=>{showPage(Math.max(1,page-1));setRevealed(null);}}><Label style={{fontSize:22,color:colors.green}}>‹</Label></Pressable><Label style={{fontSize:13,color:colors.muted}}>Page {page} / 604 {reader.sessionId||reader.revisionId?`· passage pages ${from}–${to}`:''}</Label><Pressable onPress={()=>{showPage(Math.min(604,page+1));setRevealed(null);}}><Label style={{fontSize:22,color:colors.green}}>›</Label></Pressable></View>}
      <View {...swipe.panHandlers} style={{width:imageWidth}}><MushafPage page={page} width={imageWidth} height={imageHeight} mode={state.reader?.mushaf??'traditional'} language={language} playingVerseId={playingVerseId} difficultyIds={reviewsEnabled(state)?Object.keys(state.difficultyMarkers??{}).filter(id=>state.difficultyMarkers?.[id]?.user||state.difficultyMarkers?.[id]?.admin).map(Number):[]} sessionRange={reader.range} showSession={!!(reader.sessionId||reader.revisionId)} masked={masked} revealed={revealed} onVerseLongPress={id=>{setSelectedVerse(id);revealCommands();}} onBlankLongPress={()=>{setTranslationOptions(true);revealCommands();}} onTap={revealCommands} /></View>
      {state.reader?.mushaf==='tajweedPages'&&language==='ar'&&!fullscreen&&<Label style={{width:imageWidth,color:colors.muted,fontSize:12,marginTop:7,textAlign:'center'}}>Suivi audio et appui long sur les images indisponibles : positions des versets à vérifier pour cette édition.</Label>}
      {!fullscreen&&<><Label style={{color:colors.muted,fontSize:12,marginTop:8}}>Glisse la page à gauche ou à droite pour la tourner.</Label><Card style={{width:imageWidth,marginTop:12}}><Label style={{fontWeight:'700'}}>Réciter de mémoire</Label><Button secondary onPress={()=>{setMasked(!masked);setRevealed(null);}}>{masked?'Voir la page':'Masquer les versets pour réciter'}</Button>{masked&&<Button onPress={()=>setRevealed(nextReveal??visible[0]??null)}>Afficher le verset</Button>}</Card>
      {reader.sessionId&&<View style={{width:imageWidth,marginTop:18}}>{section('Après ma séance')}<Button onPress={()=>validate('done')}>J’ai mémorisé ce passage</Button><Button secondary onPress={()=>validate('work')}>Je dois encore le travailler</Button><Button secondary onPress={()=>validate('postpone')}>Reporter cette séance</Button></View>}
      {reader.revisionId&&<View style={{width:imageWidth,marginTop:18}}>{section('Comment s’est passée la révision ?')}<Button onPress={()=>grade('perfect')}>Parfait, sans regarder</Button><Button secondary onPress={()=>grade('hesitant')}>Quelques hésitations</Button><Button secondary onPress={()=>grade('errors')}>Plusieurs erreurs</Button><Button secondary onPress={()=>grade('relearn')}>À réapprendre</Button></View>}</>}
      {reader.reviewTask&&reviewsEnabled(state)&&<View style={{width:imageWidth,marginTop:18}}>{section('Comment s’est passée la révision ?')}<Button onPress={()=>onReviewDone(reader.reviewTask!,'perfect')}>Parfait</Button><Button secondary onPress={()=>onReviewDone(reader.reviewTask!,'hesitant')}>Quelques hésitations</Button><Button secondary onPress={()=>onReviewDone(reader.reviewTask!,'rework')}>À retravailler</Button></View>}
      {!fullscreen&&<View style={{width:imageWidth,marginTop:18}}><RecitationRecorder range={reader.range} /></View>}
    </ScrollView>
    {selectedVerse!==null&&<View style={{position:'absolute',bottom:85,left:12,right:12,zIndex:8,backgroundColor:colors.paper,padding:14,borderRadius:17,borderWidth:1,borderColor:colors.line,elevation:8}}><Label style={{fontWeight:'700',marginBottom:6}}>Verset sélectionné : {surahs[verseAt(selectedVerse).surah-1].name} {verseAt(selectedVerse).ayah}</Label><Button small onPress={()=>audioAction(selectedVerse,'listen')}>▶ Écouter ce verset</Button><Button small secondary onPress={()=>audioAction(selectedVerse,'repeat')}>🔁 Répéter ce verset</Button><Button small secondary onPress={()=>audioAction(selectedVerse,'select')}>📖 Sélectionner un passage</Button>{reviewsEnabled(state)&&<Button small secondary onPress={()=>{update(toggleDifficulty(state,selectedVerse));setSelectedVerse(null);}}>{state.difficultyMarkers?.[selectedVerse]?.user?'Retirer des révisions prioritaires':'Marquer comme difficile'}</Button>}{reviewsEnabled(state)&&state.difficultyMarkers?.[selectedVerse]?.admin?.comment&&<Label style={{fontSize:12,color:colors.red}}>À retravailler — professeur : {state.difficultyMarkers[selectedVerse].admin!.comment}</Label>}<Pressable onPress={()=>setSelectedVerse(null)} style={{alignItems:'center',padding:5}}><Label style={{color:colors.muted,fontSize:12}}>Fermer</Label></Pressable></View>}
    {translationOptions&&<View style={{position:'absolute',bottom:85,left:12,right:12,zIndex:8,backgroundColor:colors.paper,padding:14,borderRadius:17,borderWidth:1,borderColor:colors.line}}><Label style={{fontWeight:'700'}}>Lecture</Label><Button small onPress={()=>{setLanguage(language==='ar'?'fr':'ar');setTranslationOptions(false);}}>Passer en {language==='ar'?'français':'arabe'}</Button><Button secondary small onPress={()=>setTranslationOptions(false)}>Fermer</Button></View>}
    <PassageAudioPlayer sessionRange={reader.range} page={page} command={audioCommand} onVerseChange={followAudio} fullscreen={fullscreen} />
  </View>;
}
