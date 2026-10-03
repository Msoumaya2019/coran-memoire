import {DownloadSourceChoice,QuranDownload} from './ui/QuranDownload';
import {quranDownloaded} from './services/quranDownload';
import {initialAccountAccess} from './core/offlineAccess';
import {sourceVersePage,sourcePageRange as rangeForSource} from './core/sourceNavigation';
import {useConnectivity} from './services/connectivity';
import {observeOfflineSync,flushPendingSync} from './services/offlineSync';
import {isZipSource,zipSources,zipPageData,zipVersePage,zipPageRange} from './core/quranSources';
import {scheduledDate,upcomingSessions,weeklyProgress} from './core/weeklyProgress';
import {completeConsolidation} from './core/review';
import {StudyBanner,StudyCompletionSheet,StudyResumeCard} from './ui/StudySession';
import {studyKey,studyMetrics,studyRangeLabel,remainingStudyRange,resumeStudyTask,validateStudyProgress} from './core/studyProgress';
import {quranPaperOptions,quranPaperColor} from './core/readerAppearance';
import {ZoomableReader} from './ui/ZoomableReader';
import {loadTestPage} from './coranTest/loadPage';
import {CoranTestScreen} from './coranTest/CoranTestScreen';
import {ReaderMoreSheet} from './ui/ReaderMoreSheet';
import {ReaderFloatingActions} from './ui/ImmersiveReaderChrome';
import {readerOverlayState,testVersePage,testPageRange,originalPageWidth,originalPageHeight} from './coranTest/model';
import {ReviewDashboard} from './ReviewDashboard';
import {RevisionBottomActionBar} from './ui/RevisionBottomActionBar';
import {BookmarksScreen} from './BookmarksScreen';
import {saveBookmark,useBookmark,visibleBookmarks} from './core/bookmarks';
import {AppTopNavigation,IslamicHero,Icon,IconName,GoldIcon,ProgressRing,ProgressTrack,premiumShadow} from './ui/Premium';
import {frenchVerse} from './core/readerData';
import {HomeIcon,HomeIconKind,iconBackgrounds} from './ui/HomeIcon';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState as DeviceAppState, BackHandler, ImageBackground, Keyboard, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, StatusBar, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, Button, Card, CheckChoice, Choice, colors, Field, Label, Title, themeOptions } from './ui/theme';
import { accountState, addDays, AppState, beginnerPaces, completeSession, dateKey, dayOf, defaultState, generateProgram, goalFromPreset, goalIds, GoalPreset, goalIsAlreadyKnown, goalPresetLabels, gradeRevision, intensivePaces, isRangeKnown, LearningDirection, markKnowledge, memorizedIds, paceLabels, pacePresets, PacePreset, partialKnownRanges, postponeSession, progress, resetAllProgress, seedInitialRevisions, Session, stats, todayLocal, toggleKnownRange, touch, validGoal, weekdays } from './core/program';
import { pageAfterSwipe } from './core/pageNavigation';
import { fitMushafPage } from './core/readerLayout';
import { expand, hizbs, juzs, normalizeRanges, pageOf, pageRange, quarters, Range, reference, surahs, verseAt, verseId, verses } from './core/quran';
import { saveMutation,enqueueState,pendingOperations,loadAccountState, loadState, saveState } from './services/storage';
import { changePassword, consumeAuthLink, currentUser, pullState, pushState, requestPasswordLink, resendSignupConfirmation, signIn, signOut, supabase, syncConfigured } from './services/sync';
import {MushafPage} from './MushafPage';
import {SurahPicker} from './SurahPicker';
import {stopActiveAudio} from './services/audioFocus';
import tajweedDimensions from './data/mushaf-tajweed-dimensions.json';
import {AdminScreen,FriendsScreen} from './SocialScreens';
import {ProfileHeaderButton} from './ui/ProfileHeaderButton';
import {clearFriendsSnapshot,ensureSocialProfile,FriendProfile,isSocialAdmin,mySocialProfile,prefetchFriendsSnapshot,publishSocialProgress,setSocialOnline,unreadMessageCount,updateSocialProfile} from './services/social';
import { Notifications, syncLearningReminder, ensureNotificationPermission, notificationDestination, registerPushDevice, pushDiagnostic, saveNotificationPreferences, scheduledReminderCounts, setAdminMessagePresentationEnabled, setCorrectionPresentationEnabled, setMessagePresentationEnabled, setProgressPresentationEnabled, testLocalNotification, unregisterPushDevice, updatePushPresence } from './services/notifications';
import {AudioCommand,PassageAudioPlayer} from './PassageAudioPlayer';
import {RecitationRecorder} from './RecitationRecorder';
import {myCorrectionMarkers,syncPendingRecitations} from './services/recitations';
import {RecitationsScreen} from './RecitationsScreen';
import {gradeReviewTask,prepareReviewSchedule,reviewPlan,reviewsEnabled,ReviewTask,setReviewCycle,setReviewsEnabled,toggleDifficulty} from './core/review';
import {chooseAvatar,removeAvatar,stageAvatar,syncStagedAvatar,uploadAvatar} from './services/avatars';
import {FriendAvatar} from './ui/FriendAvatar';
import {DailyContentsScreen,TodayContents} from './DailyContentsScreen';
import {MessagingButton} from './ui/MessagingButton';

type Tab='Accueil'|'Coran'|'Programme'|'Progrès'|'Amis';
type Reader={range:Range;sessionId?:string;revisionId?:string;reviewTask?:ReviewTask;consolidation?:boolean;initialLanguage?:'ar'|'fr'};
const heroImages={classic:require('../assets/themes/emerald.png'),feminine:require('../assets/themes/rose.png'),lilac:require('../assets/themes/lilac.png'),night:require('../assets/themes/night.png')};
const section=(title:string)=><Label style={{fontWeight:'700',fontSize:19,marginBottom:10,marginTop:12}}>{title}</Label>;
const percent=(n:number)=>`${Math.round(n*100)} %`;
const dateText=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
const fullDate=(key:string)=>new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});

export default function App(){return <SafeAreaProvider><AppContent /></SafeAreaProvider>;}

function AppContent(){
  const [state,setState]=useState<AppState>(()=>loadState());
  const connectivity=useConnectivity();
  useEffect(()=>observeOfflineSync(()=>setState(loadState())),[]);
  const [tab,setTab]=useState<Tab>('Accueil');
  const [utilityView,setUtilityView]=useState<'profile'|'settings'|null>(null);
  const [reader,setReader]=useState<Reader|null>(null);
  const [readerFullscreen,setReaderFullscreen]=useState(false);
  const [page,setPage]=useState(1);
  const [wizard,setWizard]=useState<number|null>(state.profile?.firstName?state.onboardingDone?null:0:-1);
  const [account,setAccount]=useState<string|null>(state.userId??null);
  const [accountIntro,setAccountIntro]=useState<'checking'|'show'|'done'>(initialAccountAccess(state));
  const [notice,setNotice]=useState('');
  const wizardStep=(value:AppState)=>value.onboardingDone?null:value.onboardingStep??(value.profile?.firstName?0:-1);
  const setWizardStep=(step:number|null)=>{setWizard(step);const latest=loadState();if(step!==null&&!latest.onboardingDone)update(touch({...latest,onboardingStep:step}));};
  const [socialView,setSocialView]=useState<'friends'|'admin'|null>(null);
  const [dailyOpen,setDailyOpen]=useState(false),[dailyId,setDailyId]=useState<string>();
  const [reviewOpen,setReviewOpen]=useState(false);
  const [reviewDate,setReviewDate]=useState(todayLocal());
  useEffect(()=>{const refresh=()=>setReviewDate(todayLocal());const subscription=DeviceAppState.addEventListener('change',status=>{if(status==='active')refresh();});const timer=setInterval(refresh,30000);return()=>{subscription.remove();clearInterval(timer);};},[]);
  const [recitationsOpen,setRecitationsOpen]=useState(false);
  const [pendingRecitationId,setPendingRecitationId]=useState<string|null>(null);
  const [reviewOnly,setReviewOnly]=useState(false);
  const [admin,setAdmin]=useState(false);
  const [passwordRecovery,setPasswordRecovery]=useState(false);
  const [pendingLinkId,setPendingLinkId]=useState<string|null>(null);
  const [pendingInviteCode,setPendingInviteCode]=useState<string|null>(null);
  const [unreadCount,setUnreadCount]=useState(0);
  const syncWarningShown=useRef(false);
  const accountGeneration=useRef(0);
  const today=todayLocal();
  useEffect(()=>{if(!account||accountIntro!=='done'||!state.onboardingDone)return;(async()=>{
    const permission=await Notifications.getPermissionsAsync();
    let granted=permission.granted||permission.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL||permission.ios?.status===Notifications.IosAuthorizationStatus.EPHEMERAL;
    if(!granted&&(await AsyncStorage.getItem('notifications-requested-on-device'))!=='yes'){
      granted=await ensureNotificationPermission(true);
      await AsyncStorage.setItem('notifications-requested-on-device','yes');
    }
    if(granted)setState(current=>{
      if(current.notifications?.permissionExplained)return current;
      const next=touch({...current,notifications:{...current.notifications,messages:current.notifications?.messages!==false,learning:false,permissionExplained:true}});
      saveState(next);return next;
    });
  })().catch(error=>console.warn('[Push] permission setup failed',error));},[account,accountIntro,state.onboardingDone,state.notifications?.permissionExplained]);
  const update=(next:AppState)=>{saveMutation(next);setState(next);if(account){flushPendingSync().then(()=>{syncWarningShown.current=false;setState(loadState());}).catch(()=>{if(!syncWarningShown.current){syncWarningShown.current=true;setNotice('Sauvegarde locale effectuée. Synchronisation en attente.');}});publishSocialProgress(next).catch(()=>{});}};
  const activateAccount=async(user:{id:string;email?:string})=>{
    const generation=accountGeneration.current;
    if(state.userId&&state.userId!==user.id)clearFriendsSnapshot();
    const remote=await pullState();
    if(generation!==accountGeneration.current)throw new Error('Restauration annulée');
    const cached=loadAccountState(user.id);const result=pendingOperations(user.id).length&&cached?{state:cached,shouldPush:true}:accountState(user.id,cached,remote);
    saveState(result.state);setState(result.state);setAccount(user.email??user.id);
    setWizard(wizardStep(result.state));
    if(result.shouldPush){enqueueState(result.state);flushPendingSync().catch(error=>{console.warn('[Account] Sync',error);setNotice('Données restaurées. Synchronisation en attente.');});}
    setAccountIntro('done');
    if(user.email)syncStagedAvatar(user.email).catch(()=>{});
    return result.state;
  };
  const leaveAccount=()=>{
    accountGeneration.current++;
    clearFriendsSnapshot();
    const fresh=defaultState();saveState(fresh);setState(fresh);setAccount(null);
    setReader(null);setReviewOpen(false);setRecitationsOpen(false);setPendingRecitationId(null);setSocialView(null);setUtilityView(null);setTab('Accueil');setWizard(-1);setAccountIntro('show');
  };
  const restoreSession=async()=>{const restorationGeneration=accountGeneration.current;if(!loadState().userId)setAccountIntro('show');if(loadState().userId){setAccount(loadState().userId!);setAccountIntro('done');}else setAccountIntro('show');try{if(!supabase){setNotice('La connexion au serveur est indisponible.');if(!loadState().userId)setAccountIntro('show');return;}const {data,error}=await supabase.auth.getSession();if(error)throw error;if(!data.session){if(!loadState().userId)setAccountIntro('show');return;}const user=data.session.user;try{await activateAccount(user);}catch(error){if(restorationGeneration!==accountGeneration.current)return;const cached=loadAccountState(user.id);if(!cached)throw error;saveState(cached);setState(cached);setAccount(user.email??user.id);setWizard(wizardStep(cached));setAccountIntro('done');setNotice('Compte restauré hors ligne. Synchronisation en attente.');}}catch(error:any){if(restorationGeneration!==accountGeneration.current)return;console.warn('[Account] Restoration failed',error);setNotice(`Restauration impossible : ${error?.message??'Vérifie ta connexion.'}`);if(!loadState().userId)setAccountIntro('show');}};
  useEffect(()=>{restoreSession();const foreground=DeviceAppState.addEventListener('change',status=>{if(status==='active'){restoreSession();flushPendingSync().catch(()=>{});}});const timer=setInterval(()=>flushPendingSync().catch(()=>{}),30000);return()=>{clearInterval(timer);foreground.remove();};},[]);
  const resetAll=async()=>{
    const fresh=resetAllProgress(loadState());
    saveState(fresh);setState(fresh);setReader(null);setPage(1);setTab('Accueil');setWizard(fresh.profile?.firstName?0:-1);
    setNotice('Apprentissage et révisions remis à zéro.');
    if(account)try{await pushState(fresh);await publishSocialProgress(fresh);}catch{setNotice('Remise à zéro effectuée sur ce téléphone. Synchronisation en attente.');}
  };
  useEffect(()=>{if(!state.profile?.firstName&&wizard===null)setWizard(-1);else if(!state.onboardingDone&&wizard===null)setWizard(0);},[]);
  useEffect(()=>{
    const open=(data:Record<string,unknown>|undefined)=>{const destination=notificationDestination(data);if(!destination)return;
      if(destination.kind==='program'){setReader(null);setWizard(null);setSocialView(null);setTab('Programme');}
      else if(destination.kind==='reviews'&&reviewsEnabled(loadState())){setReader(null);setWizard(null);setSocialView(null);setReviewOpen(true);}
      else if(destination.kind==='recitation'){setReader(null);setWizard(null);setSocialView(null);setPendingRecitationId(destination.recitationId);setRecitationsOpen(true);}
      else if('linkId' in destination&&typeof destination.linkId==='string')setPendingLinkId(destination.linkId);
      Notifications.clearLastNotificationResponseAsync().catch(()=>{});
    };
    Notifications.getLastNotificationResponseAsync().then(response=>{if(response)open(response.notification.request.content.data);}).catch(()=>{});
    const response=Notifications.addNotificationResponseReceivedListener(event=>open(event.notification.request.content.data));
    const received=Notifications.addNotificationReceivedListener(event=>{if(__DEV__)console.log('[Push] received',{platform:Platform.OS,kind:event.request.content.data?.kind,appState:DeviceAppState.currentState});});
    const tokens=Notifications.addPushTokenListener(()=>{if(loadState().notifications?.permissionExplained)registerPushDevice().catch(error=>console.warn('[Push] token refresh failed',error));});
    return()=>{response.remove();tokens.remove();received.remove();};
  },[]);
  useEffect(()=>{if(account&&pendingLinkId){setReader(null);setWizard(null);setUtilityView(null);setTab('Amis');setSocialView('friends');}},[account,pendingLinkId]);
  useEffect(()=>{if(account&&pendingInviteCode){setReader(null);setWizard(null);setUtilityView(null);setTab('Amis');setSocialView('friends');}},[account,pendingInviteCode]);
  useEffect(()=>{setMessagePresentationEnabled(state.notifications?.messages!==false);},[state.notifications?.messages]);
  useEffect(()=>{setProgressPresentationEnabled(state.notifications?.sharedProgress===true);},[state.notifications?.sharedProgress]);
  useEffect(()=>{setCorrectionPresentationEnabled(state.notifications?.corrections!==false);},[state.notifications?.corrections]);
  useEffect(()=>{setAdminMessagePresentationEnabled(state.notifications?.adminMessages!==false);},[state.notifications?.adminMessages]);
  useEffect(()=>{if(!account||!state.onboardingDone)return;syncLearningReminder(state.notifications?.learning===true).catch(error=>console.warn('[Push] learning reminder failed',error));},[account,state.onboardingDone,state.notifications?.learning]);
  useEffect(()=>{if(!state.onboardingDone||!reviewsEnabled(state))return;const next=prepareReviewSchedule(state);if(next!==state)update(next);},[state.onboardingDone,state.knowledge,state.memorizedAt,state.reviewSettings?.enabled,state.reviewSettings?.cycleDays,state.reviewSettings?.mode,state.reviewSettings?.dailyQuantity,reviewDate]);
  useEffect(()=>{if(!account)return;
    const prefs=state.notifications;
    saveNotificationPreferences({messages:prefs?.messages!==false,friendRequests:prefs?.friendRequests!==false,sharedProgress:prefs?.sharedProgress===true,revision:false,corrections:prefs?.corrections!==false,adminMessages:prefs?.adminMessages!==false,messagePreview:prefs?.messagePreview!==false}).catch(error=>console.warn('[Push] preference sync failed',error));
    if(prefs?.permissionExplained&&(prefs.messages!==false||prefs.friendRequests!==false||prefs.sharedProgress===true||prefs.corrections!==false||prefs.adminMessages!==false))registerPushDevice().catch(error=>console.warn('[Push] device registration failed',error));
  },[account,state.notifications]);
  useEffect(()=>{if(!account){setUnreadCount(0);return;}const refresh=()=>unreadMessageCount().then(setUnreadCount).catch(()=>{});refresh();const timer=setInterval(refresh,15000);const channel=supabase?.channel('unread-private-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_messages'},refresh).subscribe();const foreground=DeviceAppState.addEventListener('change',status=>{if(status==='active')refresh();});return()=>{clearInterval(timer);foreground.remove();if(channel)supabase?.removeChannel(channel);};},[account,socialView]);
  useEffect(()=>{if(!account)return;syncPendingRecitations().catch(()=>{});const listener=DeviceAppState.addEventListener('change',status=>{if(status==='active')syncPendingRecitations().catch(()=>{});});return()=>listener.remove();},[account]);
  useEffect(()=>{if(!account)return;const refresh=async()=>{
    const rows=await myCorrectionMarkers();const current=loadState(),markers={...current.difficultyMarkers};
    for(const key of Object.keys(markers))if(markers[key].admin){const own={...markers[key]};delete own.admin;if(own.user)markers[key]=own;else delete markers[key];}
    for(const row of rows)if(!row.resolved_at)markers[row.verse_id]={...markers[row.verse_id],admin:{createdAt:row.created_at,comment:row.comment??undefined}};
    if(JSON.stringify(markers)!==JSON.stringify(current.difficultyMarkers??{}))update(touch({...current,difficultyMarkers:markers}));
  };refresh().catch(()=>{});const listener=DeviceAppState.addEventListener('change',status=>{if(status==='active')refresh().catch(()=>{});});return()=>listener.remove();},[account,recitationsOpen]);
  useEffect(()=>{
    const handle=async(url:string)=>{try{const invite=url.match(/^coranmemoire:\/\/friend\/([A-Za-z0-9_-]+)$/);if(invite){setPendingInviteCode(invite[1]);setUtilityView('profile');setNotice('Connecte-toi pour accepter cette invitation.');return;}const user=await consumeAuthLink(url);if(!user)return;
      const restored=await activateAccount(user);
      const parsedLink=new URL(url);
      const linkType=new URLSearchParams(parsedLink.hash.replace(/^#/,'')).get('type')??parsedLink.searchParams.get('type');
      const recovering=linkType==='recovery';setPasswordRecovery(recovering);
      setWizard(recovering?null:wizardStep(restored));setUtilityView('profile');
      setNotice(recovering?'Lien confirmé. Choisis maintenant un mot de passe.':'Adresse confirmée. Ton compte est prêt.');
    }catch(e:any){setNotice(`Lien de connexion : ${e.message}`);}};
    Linking.getInitialURL().then(url=>{if(url)handle(url);}).catch(()=>{});
    const subscription=Linking.addEventListener('url',event=>{handle(event.url);});
    return()=>subscription.remove();
  },[]);
  useEffect(()=>{if(!account){setAdmin(false);return;}let active=true;
    (async()=>{try{await ensureSocialProfile();if(active){setAdmin(await isSocialAdmin());await publishSocialProgress(loadState());await setSocialOnline(true);}}catch{}})();
    const timer=setInterval(()=>{if(DeviceAppState.currentState==='active')setSocialOnline(true).catch(()=>{});},45000);
    const listener=DeviceAppState.addEventListener('change',status=>{setSocialOnline(status==='active').catch(()=>{});if(status==='active'&&loadState().notifications?.permissionExplained)registerPushDevice().catch(error=>console.warn('[Push] resume registration failed',error));else updatePushPresence(null).catch(error=>console.warn('[Push] presence reset failed',error));});
    return()=>{active=false;clearInterval(timer);listener.remove();setSocialOnline(false).catch(()=>{});};
  },[account]);
  useEffect(()=>{if(!account||!state.profile?.firstName)return;
    ensureSocialProfile().then(profile=>profile.display_name===state.profile!.firstName?undefined:updateSocialProfile({...profile,display_name:state.profile!.firstName})).catch(()=>{});
  },[account,state.profile?.firstName]);
  useEffect(()=>{if(!account||!state.userId)return;const timer=setTimeout(()=>prefetchFriendsSnapshot(state.userId!),1200);return()=>clearTimeout(timer);},[account,state.userId]);
  const openReader=(request:Reader)=>{let r=request;const mode=r.sessionId?'learning':'revision',id=r.sessionId??r.reviewTask?.id??r.revisionId;const record=id?loadState().studyProgress?.[studyKey(mode,id)]:undefined;if(record?.status==='partial')r={...r,range:remainingStudyRange(record,record)!};setReader(r);const original=loadState().reader?.mushaf==='coranTest';setReaderFullscreen(false);setPage(sourceVersePage(loadState().reader?.mushaf??'coranTest',r.range.start,loadState().lastRead?.verseId===r.range.start?loadState().lastRead?.page:undefined));};
  const closeReader=()=>{if(reader){const latest=loadState(),source=latest.reader?.mushaf??'coranTest';const range=rangeForSource(source,page);const prior=latest.lastRead;const verseId=prior&&sourceVersePage(source,prior.verseId,page)===page?prior.verseId:sourceVersePage(source,reader.range.start,page)===page?reader.range.start:range.start;update(touch({...latest,lastRead:{page,verseId,readAt:new Date().toISOString()},...(source==='coranTest'?{reader:{...latest.reader,mushaf:'coranTest',followAudio:latest.reader?.followAudio!==false,testPage:page}}:{})}));}setReader(null);setReaderFullscreen(false);};
  const edgeBack=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>Platform.OS==='ios'&&gesture.x0<26&&gesture.dx>22&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.4,
    onPanResponderRelease:(_,gesture)=>{if(gesture.dx<75)return;if(dailyOpen){setDailyOpen(false);setDailyId(undefined);return;}if(wizard!==null){if(wizard>0)setWizard(wizard-1);else if(state.onboardingDone)setWizard(null);return;}if(utilityView){setUtilityView(null);return;}if(socialView){setSocialView(null);setPendingLinkId(null);return;}if(tab!=='Accueil')setTab('Accueil');},
  }),[dailyOpen,wizard,socialView,utilityView,tab,state.onboardingDone]);
  useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
    if(dailyOpen){setDailyOpen(false);return true;}
    if(reader){closeReader();return true;}
    if(recitationsOpen){setRecitationsOpen(false);setPendingRecitationId(null);return true;}
    if(utilityView){setUtilityView(null);return true;}
    if(reviewOpen){setReviewOpen(false);return true;}
    if(socialView){setSocialView(null);setPendingLinkId(null);return true;}
    if(tab!=='Accueil'&&wizard===null){setTab('Accueil');return true;}
    return false;
  });return()=>subscription.remove();},[dailyOpen,reader,page,recitationsOpen,reviewOpen,socialView,utilityView,tab,wizard]);
  const statsNow=stats(state,today),prog=progress(state);
  const todaySessions=state.sessions.filter(s=>scheduledDate(s)===today&&s.status==='todo');
  const due=reviewsEnabled(state)?state.revisions.filter(r=>r.due<=today):[];
  const allDone=state.sessions.filter(s=>s.status==='done').length;
  const finishEstimate=state.sessions.filter(s=>s.status==='todo').at(-1)?.date;
  applyTheme(state.theme??'lilac');

  return <View style={{flex:1,backgroundColor:colors.soft}}><SafeAreaView edges={['top','bottom']} style={{flex:1,backgroundColor:colors.soft}} {...(reader||socialView==='friends'||tab==='Amis'?{}:edgeBack.panHandlers)}><StatusBar barStyle="dark-content" />{(connectivity.offline||connectivity.restored)&&<View accessibilityLiveRegion="polite" style={{paddingHorizontal:14,paddingVertical:6,backgroundColor:colors.soft}}><Label style={{fontSize:11,color:colors.muted,textAlign:'center'}}>{connectivity.offline?'Mode hors connexion — les modifications seront synchronisées automatiquement':'Connexion rétablie'}</Label></View>}
    {!reader&&accountIntro==='done'&&wizard===null&&!reviewOpen&&!recitationsOpen&&!dailyOpen&&socialView!=='admin'&&<AppTopNavigation tab={tab} onTab={name=>{setTab(name);setSocialView(null);}} firstName={state.profile?.firstName} onProfile={()=>setUtilityView('profile')} onSettings={()=>setUtilityView('settings')} title={utilityView==='profile'?'Profil':utilityView==='settings'?'Réglages':'Apprendre le Coran'} showTabs={!utilityView} onBack={utilityView?()=>setUtilityView(null):undefined}/>}

    {accountIntro==='checking'?<View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Label>Ouverture de l’application…</Label></View>:accountIntro==='show'?<AccountWelcome onAuthenticated={activateAccount} onRetry={restoreSession} />:reader?<ReaderScreen reader={reader} page={page} setPage={setPage} onClose={closeReader} onHome={()=>{closeReader();setTab('Accueil');}} onChangeSurah={s=>{setReader({range:{start:s.start,end:s.end}});setPage(state.reader?.mushaf==='coranTest'?testVersePage(s.start):isZipSource(state.reader?.mushaf??'')?zipVersePage(state.reader!.mushaf as 'coran_1441',s.start):pageOf(s.start));}} onShareRecitation={id=>{setPendingRecitationId(id);setReader(null);setRecitationsOpen(true);}} onStudyValidated={()=>{setReader(null);setReaderFullscreen(false);setTab('Programme');setReviewOpen(!!(reader?.reviewTask||reader?.revisionId));}} onReviewDone={(task,grade)=>{const next=gradeReviewTask(state,task,grade);update(next);const upcoming=reviewPlan(next).session[0];if(upcoming)openReader({range:upcoming,reviewTask:upcoming});else if(!reviewOnly&&todaySessions[0])openReader({range:todaySessions[0],sessionId:todaySessions[0].id});else closeReader();}} state={state} update={update} fullscreen={readerFullscreen} setFullscreen={setReaderFullscreen} />:
      dailyOpen?<DailyContentsScreen userId={state.userId} initialId={dailyId} onClose={()=>{setDailyOpen(false);setDailyId(undefined);}} />:
      wizard!==null?<Onboarding state={state} update={update} step={wizard} setStep={setWizardStep} onDone={()=>{setWizard(null);setTab('Accueil');}} />:
      recitationsOpen?<RecitationsScreen onViewInvocation={id=>{setDailyId(id);setDailyOpen(true);}} initialRecitationId={pendingRecitationId} onClose={()=>{setRecitationsOpen(false);setPendingRecitationId(null);}} />:
      utilityView?<ScrollView contentContainerStyle={{paddingHorizontal:18,paddingBottom:35}}><ProfileScreen mode={utilityView} state={state} update={update} account={account} onAuthenticated={activateAccount} onSignedOut={leaveAccount} setNotice={setNotice} openKnowledge={()=>setWizard(0)} openGoal={()=>setWizard(1)} openFriends={()=>{setUtilityView(null);setTab('Amis');setSocialView('friends');}} openAdmin={()=>{setUtilityView(null);setSocialView('admin');}} openRecitations={()=>setRecitationsOpen(true)} admin={admin} passwordRecovery={passwordRecovery} setPasswordRecovery={setPasswordRecovery} onPasswordReady={()=>{if(!state.profile?.firstName)setWizard(-1);else if(!state.onboardingDone)setWizard(0);}} onReset={resetAll} /></ScrollView>:
      socialView==='friends'||tab==='Amis'?<FriendsScreen userId={state.userId??null} initialLinkId={pendingLinkId} initialCode={pendingInviteCode} shareText={`Mon objectif ${state.goal.label} est atteint à ${percent(prog.goal)}. Cette semaine, j’ai appris ${statsNow.week} versets.`} onUnreadChange={()=>unreadMessageCount().then(setUnreadCount).catch(()=>{})} onClose={()=>{setSocialView(null);setPendingLinkId(null);setPendingInviteCode(null);setTab('Accueil');}} />:
      socialView==='admin'?<AdminScreen onClose={()=>setSocialView(null)} />:
      reviewOpen&&reviewsEnabled(state)?<ReviewDashboard state={state} update={update} onClose={()=>setReviewOpen(false)} onRecitations={()=>setRecitationsOpen(true)} onStatistics={()=>{setReviewOpen(false);setTab('Progrès');}} onTask={task=>{setReviewOnly(true);openReader({range:task,reviewTask:task,consolidation:task.category==='recent'});}} onStart={()=>{setReviewOnly(true);const task=reviewPlan(state).session[0];if(task)openReader({range:task,reviewTask:task,consolidation:task.category==='recent'});}} />:
      <>
        <ScrollView key={tab} contentContainerStyle={{paddingHorizontal:18,paddingBottom:30}}>
          {tab==='Accueil'&&<Home openDaily={()=>{setDailyId(undefined);setDailyOpen(true);}} state={state} prog={prog} stat={statsNow} todaySessions={todaySessions} due={due} finishEstimate={finishEstimate} openReader={openReader} openReviews={()=>setReviewOpen(true)} setTab={setTab} openSettings={()=>setUtilityView('settings')} unreadCount={unreadCount} openMessages={()=>{if(!account){setUtilityView('profile');setNotice('Connecte-toi pour accéder à tes messages.');return;}setPendingLinkId(null);setTab('Amis');setSocialView('friends');}} />}
          {tab==='Coran'&&<QuranScreen state={state} update={update} openReader={openReader} />}
          {tab==='Programme'&&<ProgramScreen state={state} update={update} openReader={openReader} openWizard={()=>setWizard(1)} openReviews={()=>setReviewOpen(true)} />}
          {tab==='Progrès'&&<ProgressScreen state={state} prog={prog} stat={statsNow} allDone={allDone} />}
        </ScrollView>
      </>}
    {notice?<Pressable accessibilityRole="alert" onPress={()=>setNotice('')} style={{position:'absolute',left:18,right:18,bottom:18,zIndex:50,padding:14,backgroundColor:colors.paper,borderWidth:1,borderColor:colors.gold,borderRadius:14,elevation:8,shadowColor:'#000',shadowOpacity:0.16,shadowRadius:8}}><Label style={{fontSize:14,fontWeight:'600'}}>{notice}  ×</Label></Pressable>:null}
  </SafeAreaView></View>;
}

function AccountWelcome({onAuthenticated,onRetry}:{onAuthenticated:(user:{id:string;email?:string})=>Promise<AppState>;onRetry:()=>void}){
  const [mode,setMode]=useState<'login'|'signup'|null>(null);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [photoUri,setPhotoUri]=useState<string|null>(null);
  const submit=async(register:boolean)=>{
    setBusy(true);setMessage('');
    try{
      if(register&&photoUri)await stageAvatar(email.trim(),photoUri);
      const user=await signIn(email.trim(),password,register);
      if(user){await onAuthenticated(user);return;}
      if(register)setMessage('Un courriel de confirmation t’a été envoyé. Ouvre le lien sur ce téléphone, puis commence ton programme.');
      else setMessage('Connexion impossible. Vérifie ton adresse et ton mot de passe.');
    }catch(error:any){setMessage(error?.message??'Une erreur est survenue. Réessaie.');}
    finally{Keyboard.dismiss();setBusy(false);}
  };
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,justifyContent:'center',paddingHorizontal:24,paddingVertical:30}}>
    <View style={{alignItems:'center',marginBottom:24}}><Label style={{fontSize:36,color:colors.green}}>۞</Label><Title>Bienvenue</Title><Label style={{textAlign:'center',color:colors.muted,marginTop:6}}>Crée ton compte pour retrouver ton apprentissage sur tous tes appareils.</Label></View>
    {!mode?<Card><Button onPress={()=>setMode('login')}>Se connecter</Button><Button secondary onPress={()=>setMode('signup')}>Créer mon compte</Button><Button secondary small onPress={onRetry}>Réessayer la restauration de ma session</Button></Card>:<Card>
      <Label style={{fontSize:18,fontWeight:'700',marginBottom:12}}>{mode==='signup'?'Créer mon compte':'Se connecter'}</Label>
      <Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" keyboardType="email-address" autoCapitalize="none" />
      <Field value={password} onChangeText={setPassword} placeholder="Mot de passe (au moins 6 caractères)" secureTextEntry />
      {mode==='signup'&&<Pressable onPress={()=>chooseAvatar().then(uri=>{if(uri)setPhotoUri(uri);}).catch(error=>setMessage(error?.message??'Photo indisponible.'))} style={{flexDirection:'row',alignItems:'center',gap:12,marginVertical:12}}><FriendAvatar name="Apprenant" uri={photoUri} size={44} /><Label style={{color:colors.green2}}>Ajouter une photo (facultatif)</Label></Pressable>}
      <Button disabled={busy||!email.includes('@')||(mode==='signup'?password.length<6:!password)} onPress={()=>submit(mode==='signup')}>{busy?'Connexion…':mode==='signup'?'Créer mon compte':'Se connecter'}</Button>
      {mode==='login'&&<Button secondary small disabled={busy||!email.includes('@')} onPress={()=>requestPasswordLink(email).then(()=>setMessage('Un lien de réinitialisation a été envoyé.')).catch(error=>setMessage(error.message))}>Mot de passe oublié</Button>}
      {mode==='signup'&&message&&<Button secondary small disabled={busy||!email.includes('@')} onPress={()=>resendSignupConfirmation(email).then(()=>setMessage('Courriel de confirmation renvoyé.')).catch(error=>setMessage(error.message))}>Renvoyer la confirmation</Button>}
      {message?<Label style={{marginTop:12,color:colors.text}}>{message}</Label>:null}
      <Button secondary small disabled={busy} onPress={()=>{setMode(null);setMessage('');}}>Retour</Button>
    </Card>}
  </ScrollView>;
}

function Home({openDaily,state,prog,stat,todaySessions,due,finishEstimate,openReader,openReviews,setTab,openSettings,unreadCount,openMessages}:{state:AppState;prog:ReturnType<typeof progress>;stat:ReturnType<typeof stats>;todaySessions:Session[];due:AppState['revisions'];finishEstimate?:string;openReader:(r:Reader)=>void;openReviews:()=>void;setTab:(tab:Tab)=>void;openSettings:()=>void;unreadCount:number;openMessages:()=>void;openDaily:()=>void}){
  const theme=state.theme??'lilac';
  const last=state.lastRead;
  const lastVerse=last?.verseId??todaySessions[0]?.start??state.goal.ranges[0]?.start??1;
  const lastPage=last?.page??pageOf(lastVerse);
  const lastSurah=surahs[verseAt(lastVerse).surah-1];
  const resume=()=>openReader({range:{start:lastVerse,end:lastVerse}});
  const shortcut=(label:string,kind:HomeIconKind,onPress:()=>void)=><Pressable key={label} onPress={onPress} accessibilityLabel={label} style={{flex:1,alignItems:'center'}}><View style={{height:48,width:48,borderRadius:15,backgroundColor:colors.paper,borderWidth:1,borderColor:colors.softBorder,alignItems:'center',justifyContent:'center',shadowColor:colors.green,shadowOpacity:0.06,shadowRadius:3,elevation:1}}><Icon name={kind==='book'?'book-open-page-variant':kind==='learn'?'school':kind==='review'?'autorenew':kind==='translate'?'translate':'mosque'} size={30} /></View><Label style={{fontSize:11,color:colors.text,marginTop:6,textAlign:'center'}}>{label}</Label></Pressable>;
  return <>
    <IslamicHero theme={theme} title={`As Salamou Alaykoum${state.profile?.firstName?` ${state.profile.firstName}`:''}`} subtitle="Que le Majestueux veille sur toi"><View style={{alignSelf:'flex-end',marginTop:10}}><MessagingButton unreadCount={unreadCount} onPress={openMessages}/></View></IslamicHero>
    <Pressable onPress={resume} style={{backgroundColor:colors.paper,borderWidth:1,borderColor:colors.line,borderRadius:19,padding:18,marginTop:-46,marginBottom:16,elevation:5,shadowColor:colors.green,shadowOpacity:0.12,shadowRadius:8,shadowOffset:{width:0,height:4}}}>
      <View style={{flexDirection:'row',alignItems:'center'}}><View style={{flex:1}}><Label style={{fontWeight:'800',fontSize:17}}>Reprendre ma lecture</Label><Label style={{marginTop:10,fontSize:24,fontWeight:'800',color:colors.green}}>{lastSurah.name}</Label><Label numberOfLines={1} style={{fontSize:23,lineHeight:40,textAlign:'right',writingDirection:'rtl',marginVertical:4}}>{verseAt(lastVerse).text}</Label><Label numberOfLines={2} style={{fontSize:12,lineHeight:19,color:colors.muted,marginBottom:6}}>{frenchVerse(lastVerse)?.translation}</Label><Label style={{fontSize:12,color:colors.muted}}>Page {lastPage} · Verset {verseAt(lastVerse).ayah}</Label></View><View style={{width:70,height:79,borderRadius:22,backgroundColor:iconBackgrounds.resume,borderWidth:2,borderColor:colors.gold,alignItems:'center',justifyContent:'center'}}><HomeIcon kind="resume" size={61} /></View></View>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:13}}><View style={{flex:1,height:7,backgroundColor:colors.soft,borderRadius:8}}><View style={{width:percent(prog.goal) as any,height:7,backgroundColor:colors.green2,borderRadius:8}} /></View><Label style={{fontSize:12,color:colors.green}}>{percent(prog.goal)}</Label></View>
    </Pressable>
    <View style={{flexDirection:'row',justifyContent:'space-between',gap:4,marginBottom:19}}>{[
      shortcut('Lecture','book',resume),
      shortcut('Apprentissage','learn',()=>todaySessions[0]?openReader({range:todaySessions[0],sessionId:todaySessions[0].id}):setTab('Programme')),
      ...(reviewsEnabled(state)?[shortcut('Révisions','review',openReviews)]:[]),
      shortcut('Traduction','translate',()=>openReader({range:{start:lastVerse,end:lastVerse},initialLanguage:'fr'})),
      shortcut('Rappels & Invocations','reminders',openDaily),
    ]}</View>
    <TodayContents theme={state.theme??'lilac'} userId={state.userId} />
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'}}>{section('Mes objectifs')}<Pressable onPress={()=>setTab('Programme')}><Label style={{fontSize:12,color:colors.green}}>Voir tout</Label></Pressable></View>
    <Card style={{flexDirection:'row',alignItems:'center',gap:14}}><ProgressRing value={prog.goal} size={62}><Icon name="book-open-outline" color={colors.green} size={24}/></ProgressRing><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{state.goal.label}</Label><Label style={{fontSize:12,color:colors.muted,marginTop:3}}>{Math.round(prog.goal*100)} % de l’objectif · {Math.round(prog.quran*100)} % du Coran</Label><View style={{height:6,backgroundColor:colors.soft,borderRadius:6,marginTop:9}}><View style={{width:percent(prog.goal) as any,height:6,backgroundColor:colors.green2,borderRadius:6}} /></View></View></Card>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'}}>{section('Dernières lectures')}<Pressable onPress={()=>setTab('Coran')}><Label style={{fontSize:12,color:colors.green}}>Voir tout</Label></Pressable></View>
    <Pressable onPress={resume}><Card style={{flexDirection:'row',alignItems:'center',gap:13}}><View style={{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:colors.surahBadge}}><Text style={{fontSize:23,color:colors.green}}>۞</Text></View><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{lastSurah.name}</Label><Label style={{fontSize:12,color:colors.muted}}>Page {lastPage} · Verset {verseAt(lastVerse).ayah}</Label></View><View style={{width:32,height:32,borderRadius:16,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'}}><Text style={{color:'white'}}>▶</Text></View></Card></Pressable>
    {section('Mon apprentissage aujourd’hui')}
    <Card>{todaySessions.length?<><Label style={{color:colors.muted,fontSize:13}}>PROGRAMME D’APPRENTISSAGE</Label>{todaySessions.map(s=><View key={s.id} style={{marginTop:9}}><Label style={{fontWeight:'700'}}>{reference(s)}</Label><Label style={{color:colors.muted,fontSize:13}}>{paceLabels[s.unit]}</Label></View>)}</>:<Label style={{color:colors.muted}}>Aucune nouvelle séance prévue aujourd’hui.</Label>}</Card>
    <Button disabled={!todaySessions.length} onPress={()=>todaySessions[0]&&openReader({range:todaySessions[0],sessionId:todaySessions[0].id})}>COMMENCER MON APPRENTISSAGE</Button>
    {reviewsEnabled(state)&&<Button secondary onPress={openReviews}>MES RÉVISIONS</Button>}
    <View style={{flexDirection:'row',gap:12,marginTop:18}}><Card style={{flex:1}}><Label style={{fontSize:25,fontWeight:'700',color:colors.green}}>{stat.weeklySessions}</Label><Label style={{fontSize:12,color:colors.muted}}>séances cette semaine</Label></Card><Card style={{flex:1}}><Label style={{fontSize:25,fontWeight:'700',color:colors.green}}>{stat.month}</Label><Label style={{fontSize:12,color:colors.muted}}>versets ce mois</Label></Card></View>
    <Card><Label style={{fontWeight:'700'}}>Fin estimée de l’objectif</Label><Label style={{color:colors.muted,marginTop:4}}>{finishEstimate?`Objectif atteint le ${fullDate(finishEstimate)}`:prog.goal>=1?'Objectif atteint':'Au-delà du programme généré'}</Label></Card>
  </>;
}


function QuranScreen({openReader,state,update}:{openReader:(r:Reader)=>void;state:AppState;update:(state:AppState)=>void}){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'meccan'|'medinan'>('all');
 useEffect(()=>{loadTestPage(state.reader?.testPage??1).catch(error=>console.warn('[Coran avec règles de Tajwid] Préchargement',error));},[state.reader?.testPage]);
 const known=useMemo(()=>new Set(memorizedIds(state)),[state.knowledge]);
 const found=surahs.filter(s=>`${s.number} ${s.name} ${s.meaning} ${s.arabic}`.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||(filter==='meccan'?s.isMeccan:!s.isMeccan)));
 return <><IslamicHero compact theme={state.theme} title="Le Coran" subtitle="Mushaf de Médine · Hafs ‘an ‘Âsim · 604 pages"/><View style={{flexDirection:'row',alignItems:'center',gap:8,marginVertical:12}}><Icon name="magnify" color={colors.green}/><View style={{flex:1}}><Field value={query} onChangeText={setQuery} placeholder="Rechercher une sourate"/></View><Pressable accessibilityLabel="Filtrer les sourates" onPress={()=>Alert.alert('Filtrer les sourates','Lieu de révélation',[{text:'Toutes',onPress:()=>setFilter('all')},{text:'Mecquoises',onPress:()=>setFilter('meccan')},{text:'Médinoises',onPress:()=>setFilter('medinan')},{text:'Annuler',style:'cancel'}])} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="tune" color={colors.green}/></Pressable></View>
 <Button secondary onPress={()=>{update(touch({...state,reader:{...state.reader,mushaf:'coranTest',followAudio:state.reader?.followAudio!==false}}));openReader({range:pageRange(state.reader?.testPage??state.lastRead?.page??1)});}}>Coran avec règles de Tajwid</Button>
 {filter!=='all'&&<Button small secondary onPress={()=>setFilter('all')}>Afficher toutes les sourates</Button>}
 {found.map(s=>{let count=0;for(let id=s.start;id<=s.end;id++)if(known.has(id))count++;return <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${s.name}`} key={s.number} onPress={()=>openReader({range:{start:s.start,end:s.end}})}><Card style={{padding:13,...premiumShadow}}><View style={{flexDirection:'row',gap:11,alignItems:'center'}}><View style={{width:38,height:38,borderRadius:19,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}><Label style={{fontWeight:'700',color:colors.green}}>{s.number}</Label></View><View style={{flex:1}}><Label style={{fontWeight:'800',fontSize:17}}>{s.name}</Label><Label numberOfLines={2} style={{fontSize:12,color:colors.muted,marginTop:3}}>{s.meaning}</Label></View><View style={{maxWidth:'42%',alignItems:'flex-end'}}><Label style={{fontSize:24,color:colors.green,textAlign:'right'}}>{s.arabic}</Label><Label style={{fontSize:10,color:colors.muted,textAlign:'right'}}>{s.isMeccan?'Mecquoise':'Médinoise'} · {s.count} versets</Label></View></View><View style={{marginTop:10}}><ProgressTrack value={count/s.count}/></View></Card></Pressable>})}
 {!found.length&&<Label>Aucune sourate trouvée.</Label>}</>;
}

function ProgramScreen({state,update,openReader,openWizard,openReviews}:{state:AppState;update:(s:AppState)=>void;openReader:(r:Reader)=>void;openWizard:()=>void;openReviews:()=>void}){
 const [showAll,setShowAll]=useState(false);const future=upcomingSessions(state),prog=progress(state),plan=reviewPlan(state);
 const reviewed=new Set((state.reviewHistory??[]).flatMap(h=>Array.from({length:h.end-h.start+1},(_,i)=>h.start+i))),learned=memorizedIds(state);
 const revisionProgress=learned.length?learned.filter(id=>reviewed.has(id)).length/learned.length:0;
 return <><IslamicHero theme={state.theme} title="Mon programme" subtitle={`${state.goal.label} · ${paceLabels[state.pace]} par séance${state.goal.direction==='fromNas'?' · depuis An-Nâs':''}`}/> {Object.values(state.studyProgress??{}).filter(r=>r.mode==='learning'&&r.status==='partial'&&state.sessions.some(s=>s.id===r.id&&s.status==='todo')).map(record=><StudyResumeCard key={record.id} record={record} onResume={()=>openReader({range:remainingStudyRange(record,record)!,sessionId:record.id})}/>)}<View style={{flexDirection:'row',gap:10,marginTop:Object.values(state.studyProgress??{}).some(r=>r.mode==='learning'&&r.status==='partial')?0:-28,marginBottom:12}}>{([{name:'Apprentissage',icon:'book-open-page-variant',text:'Nouveaux versets à mémoriser',badge:future.length?'Prochaine séance':'Objectif terminé',value:prog.goal,action:()=>{if(future[0])openReader({range:future[0],sessionId:future[0].id});else openWizard();}},...(reviewsEnabled(state)?[{name:'Révision',icon:'clipboard-check-outline',text:'Passages déjà appris',badge:plan.session.length?'À revoir bientôt':'À jour',value:revisionProgress,action:openReviews}]:[])] as const).map(item=><Pressable key={item.name} accessibilityRole="button" onPress={item.action} style={{flex:1,padding:15,borderWidth:1,borderColor:colors.line,borderRadius:23,backgroundColor:colors.paper,alignItems:'center',...premiumShadow}}><GoldIcon name={item.icon as IconName}/><Label style={{fontSize:17,fontWeight:'800',marginTop:12}}>{item.name}</Label><Label style={{fontSize:12,color:colors.muted,textAlign:'center',lineHeight:18,marginVertical:7}}>{item.text}</Label><Label style={{color:colors.green,backgroundColor:colors.soft,padding:7,borderRadius:12,fontSize:11,textAlign:'center',marginBottom:10}}>{item.badge}</Label><View style={{width:'100%'}}><ProgressTrack value={item.value}/><Label style={{fontSize:11,textAlign:'right',color:colors.green,marginTop:4}}>{percent(item.value)}</Label></View></Pressable>)}</View>

 <Card><Label style={{fontWeight:'700'}}>Objectif de la semaine · {percent(weeklyProgress(state).ratio)}</Label><ProgressTrack value={weeklyProgress(state).ratio}/><Label style={{fontSize:12}}>{weeklyProgress(state).done} / {weeklyProgress(state).total} séances prévues</Label></Card><Pressable accessibilityRole="button" onPress={openWizard}><Card style={{backgroundColor:colors.soft,flexDirection:'row',alignItems:'center',gap:12,padding:16}}><Icon name="tune" color={colors.green}/><Label style={{flex:1,fontWeight:'700',color:colors.green}}>Modifier l’objectif et le rythme</Label><Icon name="chevron-right" color={colors.green}/></Card></Pressable>
 {state.sessions.some(s=>s.status==='todo'&&scheduledDate(s)<todayLocal())&&<Card><Label style={{fontWeight:'700',marginBottom:8}}>À rattraper</Label>{state.sessions.filter(s=>s.status==='todo'&&scheduledDate(s)<todayLocal()).slice(0,10).map(session=><Button key={session.id} secondary small onPress={()=>openReader({range:session,sessionId:session.id})}>{dateText(scheduledDate(session))} · {reference(session)}</Button>)}</Card>}<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>{section('À venir')}<Pressable onPress={()=>setShowAll(!showAll)} style={{minHeight:44,justifyContent:'center'}}><Label style={{fontSize:12,color:colors.green}}>{showAll?'Réduire':'Voir tout'}</Label></Pressable></View>
 {(showAll?future:future.slice(0,25)).map(session=>{const d=new Date(`${scheduledDate(session)}T12:00:00`),surah=surahs[verseAt(session.start).surah-1];return <Pressable key={session.id} accessibilityRole="button" accessibilityLabel={`Ouvrir ${reference(session)}`} onPress={()=>openReader({range:session,sessionId:session.id})}><Card style={{padding:12,flexDirection:'row',gap:12,alignItems:'center',...premiumShadow}}><View style={{width:46,borderRadius:12,paddingVertical:7,backgroundColor:colors.soft,alignItems:'center'}}><Label style={{fontSize:10,color:colors.green}}>{d.toLocaleDateString('fr-FR',{weekday:'short'}).toUpperCase()}</Label><Label style={{fontSize:24,fontWeight:'800',color:colors.green}}>{d.getDate()}</Label><Label style={{fontSize:9,color:colors.gold}}>{d.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase()}</Label></View><View style={{flex:1}}><Label style={{fontSize:11,color:colors.green,marginBottom:4}}>{scheduledDate(session)===todayLocal()?'Aujourd’hui':scheduledDate(session)===addDays(todayLocal(),1)?'Demain':dateText(scheduledDate(session))}</Label><Label style={{fontWeight:'800'}}>{reference(session)}</Label><Label style={{fontSize:12,color:colors.muted,marginTop:6}}>{paceLabels[session.unit]} · {session.end-session.start+1} versets</Label></View><Label style={{fontSize:23,color:colors.green,maxWidth:'23%'}}>{surah.arabic}</Label><Icon name="chevron-right" color={colors.green}/></Card></Pressable>})}
 {!future.length&&<Card><Label>Aucune séance prévue sur les 10 prochains jours. Vérifie ton objectif ou tes jours d’apprentissage.</Label></Card>}
 {section('Historique')}{state.sessions.filter(s=>s.status!=='todo').slice(-20).reverse().map(s=><Card key={s.id} style={{paddingVertical:11}}><Label style={{fontSize:13,color:colors.muted}}>{dateText(s.date)} · {s.status==='done'?'Terminé':'Reporté'}</Label><Label>{reference(s)}</Label></Card>)}</>;
}

function ProgressScreen({state,prog,stat,allDone}:{state:AppState;prog:ReturnType<typeof progress>;stat:ReturnType<typeof stats>;allDone:number}){
  const [view,setView]=useState<'Jour'|'Semaine'|'Mois'>('Semaine');
  const today=todayLocal();
  const tracked=Object.values(state.studyProgress??{}).filter(r=>r.mode==='learning');
  const completed:Session[]=[...state.sessions.filter(s=>s.status==='done'&&s.completedAt&&!tracked.some(r=>r.id===s.id)),...tracked.flatMap(r=>r.validations.map((v,i)=>({id:`${r.id}-${i}`,start:v.start,end:v.end,date:v.date,unit:'verse1' as const,status:'done' as const,completedDate:v.date,completedAt:v.validatedAt??`${v.date}T12:00:00`})) )];
  const count=(predicate:(s:Session)=>boolean)=>completed.filter(predicate).reduce((n,s)=>n+s.end-s.start+1,0);
  const localDate=(s:Session)=>s.completedDate??s.completedAt!.slice(0,10);
  const monday=(()=>{const d=new Date(`${today}T12:00:00`);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateKey(d);})();
  const values=view==='Jour'
    ?Array.from({length:6},(_,i)=>({label:`${i*4}h`,value:count(s=>localDate(s)===today&&Math.floor(new Date(s.completedAt!).getHours()/4)===i)}))
    :view==='Semaine'
      ?Array.from({length:7},(_,i)=>{const d=new Date(`${monday}T12:00:00`);d.setDate(d.getDate()+i);const key=dateKey(d);return {label:weekdays[d.getDay()].slice(0,2),value:count(s=>localDate(s)===key)};})
      :Array.from({length:5},(_,i)=>({label:`${i*7+1}–${Math.min((i+1)*7,new Date(Number(today.slice(0,4)),Number(today.slice(5,7)),0).getDate())}`,value:count(s=>localDate(s).slice(0,7)===today.slice(0,7)&&Number(localDate(s).slice(8,10))>=i*7+1&&Number(localDate(s).slice(8,10))<=(i+1)*7)}));
  const max=Math.max(1,...values.map(v=>v.value));
  return <><IslamicHero theme={state.theme} title="Ma progression" subtitle="Chaque verset validé compte une seule fois."/>
    <View style={{flexDirection:'row',gap:8,marginBottom:12}}>{(['Jour','Semaine','Mois'] as const).map(v=><View key={v} style={{flex:1}}><Button small secondary={view!==v} onPress={()=>setView(v)}>{v.toUpperCase()}</Button></View>)}</View>
    <View style={{alignItems:'center',marginVertical:14,paddingBottom:15}}><ProgressRing value={prog.goal} size={240} strokeColor="#C76D91"><Icon name="bullseye-arrow" size={36}/><Label style={{fontSize:18,fontWeight:'700'}}>Objectif atteint</Label><Label style={{fontSize:34,fontWeight:'800',color:colors.green}}>{goalIds(state).filter(id=>memorizedIds(state).includes(id)).length} / {goalIds(state).length}</Label><Label style={{color:colors.muted}}>versets</Label></ProgressRing><View style={{marginTop:-38,alignSelf:'flex-end',...premiumShadow}}><ProgressRing value={prog.quran} size={112}><Icon name="book-open-page-variant" size={20}/><Label style={{color:colors.green,fontWeight:'800',fontSize:20}}>{percent(prog.quran)}</Label><Label style={{fontSize:10}}>Coran mémorisé</Label></ProgressRing></View></View>
    <Card><Label style={{fontWeight:'700',marginBottom:12}}>Versets validés {view==='Semaine'?'cette semaine':view==='Mois'?'ce mois':'aujourd’hui'} · {values.reduce((n,v)=>n+v.value,0)} versets</Label><View style={{height:110,flexDirection:'row',alignItems:'flex-end',gap:8}}>{values.map((v,i)=><View key={i} style={{flex:1,alignItems:'center'}}><View style={{height:Math.max(5,v.value/max*80),width:'72%',borderRadius:6,backgroundColor:colors.green2}} /><Label style={{fontSize:11,color:colors.muted,marginTop:5}}>{v.label}</Label></View>)}</View></Card>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{[[stat.today,'versets aujourd’hui'],[stat.week,'cette semaine'],[stat.month,'ce mois'],[`${stat.hizbs} / ${hizbs.length}`,'hizb terminés'],[stat.days,'jours d’apprentissage'],...(reviewsEnabled(state)?[[stat.revisions+(state.reviewHistory?.length??0),'révisions effectuées']]:[])].map(([n,l])=><Card key={String(l)} style={{width:'47%',flexGrow:1,minHeight:105,marginBottom:0}}><Label style={{fontSize:24,fontWeight:'700',color:colors.green}}>{n}</Label><Label style={{fontSize:12,color:colors.muted}}>{l}</Label></Card>)}</View>
    {section(`Historique · ${allDone} séances`)}
    {state.sessions.filter(s=>s.status==='done').slice(-30).reverse().map(s=><Card key={s.id} style={{paddingVertical:10}}><Label style={{fontSize:12,color:colors.muted}}>{s.completedDate??s.completedAt?.slice(0,10)}</Label><Label>{reference(s)}</Label></Card>)}
  </>;
}

function ProfileScreen({mode,state,update,account,onAuthenticated,onSignedOut,setNotice,openKnowledge,openGoal,openFriends,openAdmin,openRecitations,admin,passwordRecovery,setPasswordRecovery,onPasswordReady,onReset}:{mode:'profile'|'settings';state:AppState;update:(s:AppState)=>void;account:string|null;onAuthenticated:(user:{id:string;email?:string})=>Promise<AppState>;onSignedOut:()=>void;setNotice:(v:string)=>void;openKnowledge:()=>void;openGoal:()=>void;openFriends:()=>void;openAdmin:()=>void;openRecitations:()=>void;admin:boolean;passwordRecovery:boolean;setPasswordRecovery:(v:boolean)=>void;onPasswordReady:()=>void;onReset:()=>Promise<void>}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  const [newPassword,setNewPassword]=useState('');
  const [resetting,setResetting]=useState(false);
  const [firstName,setFirstName]=useState(state.profile?.firstName??'');
  const [photoUri,setPhotoUri]=useState<string|null>(null);
  const [friendProfile,setFriendProfile]=useState<FriendProfile|null>(null);
  useEffect(()=>{let active=true;setFriendProfile(null);if(account)mySocialProfile().then(profile=>{if(active)setFriendProfile(profile);}).catch(()=>{});return()=>{active=false;};},[account]);
  const setFriendPreference=async(key:'share_online'|'share_progress'|'share_location')=>{if(!friendProfile)return;const next={...friendProfile,[key]:!friendProfile[key]};await updateSocialProfile(next);setFriendProfile(next);};
  const [deviceNotificationsAllowed,setDeviceNotificationsAllowed]=useState(false);
  const notificationPrefs:NonNullable<AppState['notifications']>=state.notifications??{messages:true,learning:false};
  useEffect(()=>{Notifications.getPermissionsAsync().then(result=>{const granted=result.granted||result.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;setDeviceNotificationsAllowed(granted);if(granted&&!notificationPrefs.permissionExplained)update(touch({...state,notifications:{...notificationPrefs,permissionExplained:true}}));}).catch(()=>{});},[]);
  const setNotification=(key:'messages'|'learning'|'friendRequests'|'sharedProgress'|'revision'|'corrections'|'adminMessages'|'messagePreview',value:boolean)=>update(touch({...state,notifications:{...notificationPrefs,[key]:value}}));
  const notificationSwitch=(label:string,key:'messages'|'learning'|'friendRequests'|'sharedProgress'|'revision'|'corrections'|'adminMessages'|'messagePreview',fallback:boolean)=><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12,gap:12}}><Label style={{flex:1}}>{label}</Label><Switch accessibilityLabel={label} value={notificationPrefs[key]??fallback} onValueChange={value=>setNotification(key,value)} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View>;
  useEffect(()=>setFirstName(state.profile?.firstName??''),[state.profile?.firstName]);
  const saveFirstName=()=>{const value=firstName.trim();if(value.length<2||value.length>40){setNotice('Saisis un prénom de 2 à 40 caractères.');return;}update(touch({...state,profile:{sex:state.profile?.sex??'Homme',firstName:value}}));setNotice('Prénom enregistré pour ton profil et tes invitations.');};
  const pickPhoto=async()=>{try{const uri=await chooseAvatar();if(!uri)return;setPhotoUri(uri);if(account){await uploadAvatar(uri);setFriendProfile(await mySocialProfile());setNotice('Photo de profil enregistrée.');}}catch(error){if(account)setPhotoUri(null);setNotice(String(error));}};
  const deletePhoto=()=>Alert.alert('Supprimer ta photo ?', 'Ton avatar affichera la première lettre de ton prénom.',[{text:'Annuler',style:'cancel'},{text:'Supprimer',style:'destructive',onPress:()=>removeAvatar().then(()=>mySocialProfile()).then(setFriendProfile).then(()=>{setPhotoUri(null);setNotice('Photo supprimée.');}).catch(error=>setNotice(String(error)))}]);
  const confirmReset=()=>Alert.alert('Tout remettre à zéro ?','Tes connaissances, séances, révisions, statistiques et choix de programme seront effacés. Ton compte et les pages du Coran seront conservés. Cette action ne peut pas être annulée.',[
    {text:'Annuler',style:'cancel'},
    {text:'Tout remettre à zéro',style:'destructive',onPress:()=>{setResetting(true);onReset().catch((e:any)=>setNotice(`Réinitialisation impossible : ${e.message}`)).finally(()=>setResetting(false));}},
  ]);
  const confirmPreferenceReset=()=>Alert.alert('Réinitialiser les préférences ?', 'Le thème, l’affichage du Coran, les notifications, le cycle de révision et le partage avec les amis retrouveront leurs valeurs initiales. Les apprentissages et récitations seront conservés.',[
    {text:'Annuler',style:'cancel'},
    {text:'Réinitialiser',onPress:()=>{const defaults=defaultState();update(touch({...state,theme:defaults.theme,reader:defaults.reader,notifications:defaults.notifications,reviewSettings:defaults.reviewSettings}));if(friendProfile)updateSocialProfile({...friendProfile,share_online:false,share_location:false,share_progress:false}).then(()=>setFriendProfile({...friendProfile,share_online:false,share_location:false,share_progress:false})).catch(error=>setNotice(String(error)));setNotice('Préférences réinitialisées.');}},
  ]);
  const handleAuth=async(register:boolean)=>{setBusy(true);try{if(register&&photoUri)await stageAvatar(email.trim(),photoUri);const user=await signIn(email.trim(),password,register);if(user){await onAuthenticated(user);setNotice(register?'Compte créé. Configure ton nouvel apprentissage.':'Tes données de ce compte ont été retrouvées.');}else{if(register)onSignedOut();setNotice('Vérifie ton courriel pour confirmer le compte.');}}catch(e:any){setNotice(e.message??'Connexion impossible.');}finally{Keyboard.dismiss();setBusy(false);}};
  return <>{mode==='profile'&&<><View style={{paddingTop:12,paddingBottom:14}}><Title>Mon profil</Title><Label style={{color:colors.muted}}>Tes préférences et tes données</Label></View>
    <Card><Label style={{fontWeight:'700'}}>Mon prénom</Label><View style={{flexDirection:'row',alignItems:'center',gap:12,marginTop:10}}><FriendAvatar name={firstName||'Apprenant'} path={friendProfile?.avatar_path} uri={photoUri} size={64} /><View style={{flex:1}}><Button small secondary onPress={pickPhoto}>{account?'Choisir ou modifier ma photo':'Ajouter une photo (facultatif)'}</Button>{account&&friendProfile?.avatar_path?<Button small secondary onPress={deletePhoto}>Supprimer ma photo</Button>:null}</View></View><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Ce prénom apparaît dans les invitations envoyées à tes amis.</Label><Field value={firstName} onChangeText={setFirstName} placeholder="Ton prénom" autoCapitalize="words" /><Button secondary onPress={saveFirstName}>Enregistrer mon prénom</Button><Label style={{fontWeight:'700',marginTop:16}}>Compte et synchronisation</Label>{!syncConfigured?<Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Ajoute l’URL et la clé publique de ton projet Supabase dans le fichier .env pour activer le compte.</Label>:account?<><Label style={{color:colors.muted,marginVertical:8}}>{account}</Label><Button secondary onPress={async()=>{try{await pushState(state);setNotice('Données synchronisées.');}catch(e:any){setNotice(e.message);}}}>Synchroniser maintenant</Button><Button secondary onPress={async()=>{await setSocialOnline(false).catch(()=>{});await unregisterPushDevice().catch(()=>{});await signOut();onSignedOut();setNotice('Déconnecté. Les données de ce compte restent sauvegardées séparément sur ce téléphone.');}}>Se déconnecter</Button></>:<><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Retrouve ta progression sur un autre téléphone.</Label><Field value={email} onChangeText={setEmail} placeholder="Adresse e-mail" keyboardType="email-address" /><Field value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry /><Button disabled={busy||!email||!password} onPress={()=>handleAuth(false)}>Se connecter</Button><Button secondary disabled={busy||!email||password.length<6} onPress={()=>handleAuth(true)}>Créer un compte</Button><Button secondary disabled={busy||!email.includes('@')} onPress={async()=>{setBusy(true);try{await resendSignupConfirmation(email);setNotice('Nouveau courriel de confirmation envoyé. Ouvre ce nouveau lien sur le téléphone où l’application est installée.');}catch(e:any){setNotice(e.message);}finally{Keyboard.dismiss();setBusy(false);}}}>Renvoyer le courriel de confirmation</Button><Button secondary disabled={busy||!email.includes('@')} onPress={async()=>{setBusy(true);try{await requestPasswordLink(email);setNotice('Un lien vient de t’être envoyé. Ouvre-le sur ce téléphone après avoir installé la nouvelle version de l’application.');}catch(e:any){setNotice(e.message);}finally{Keyboard.dismiss();setBusy(false);}}}>Recevoir un lien pour créer ou changer mon mot de passe</Button></>}</Card>
    {passwordRecovery&&account?<Card><Label style={{fontWeight:'700'}}>Choisir mon mot de passe</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Utilise au moins 8 caractères. Ton mot de passe reste privé.</Label><Field value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau mot de passe" secureTextEntry /><Button disabled={busy||newPassword.length<8} onPress={async()=>{setBusy(true);try{await changePassword(newPassword);setNewPassword('');setPasswordRecovery(false);setNotice('Mot de passe enregistré. Ton compte est prêt.');onPasswordReady();}catch(e:any){setNotice(e.message);}finally{Keyboard.dismiss();setBusy(false);}}}>Enregistrer mon mot de passe</Button></Card>:null}
    <Card><Label style={{fontWeight:'700'}}>Mes récitations</Label><Label style={{color:colors.muted,fontSize:13,marginTop:6}}>Réécouter mes enregistrements et consulter les corrections du professeur.</Label><Button secondary onPress={openRecitations}>Ouvrir mes récitations</Button></Card>
    <Card><Label style={{fontWeight:'700'}}>Connaissances</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Modifier les sourates, juz’, hizb et passages déjà appris.</Label><Button secondary onPress={openKnowledge}>Modifier mes connaissances</Button></Card>
    <Card><Label style={{fontWeight:'700'}}>Objectif et rythme</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>{state.goal.label} · {paceLabels[state.pace]}</Label><Button secondary onPress={openGoal}>Modifier mon programme</Button></Card>
    <Card><Label style={{fontWeight:'700'}}>Apprentissage</Label><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:10}}><Label style={{flex:1}}>Activer l’espace Révisions</Label><Switch accessibilityLabel="Activer l’espace Révisions" value={reviewsEnabled(state)} onValueChange={value=>update(setReviewsEnabled(state,value))} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View>{reviewsEnabled(state)&&<><Label style={{color:colors.muted,fontSize:13,marginTop:12}}>Tout revoir sur un cycle de</Label><View style={{flexDirection:'row',gap:5,marginTop:8}}>{([7,14,21,30] as const).map(days=><View key={days} style={{flex:1}}><Button small secondary={(state.reviewSettings?.cycleDays??7)!==days} onPress={()=>update(setReviewCycle(state,days))}>{days} j</Button></View>)}</View></>}</Card>
    <Card><Label style={{fontWeight:'700'}}>Amis et entraide</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Suivi partagé, messages et cercles privés.</Label>{friendProfile&&<><CheckChoice label="Afficher ma présence en ligne" selected={friendProfile.share_online} onPress={()=>setFriendPreference('share_online').catch(e=>setNotice(String(e)))} /><CheckChoice label="Partager ma progression avec mes amis" selected={friendProfile.share_progress} onPress={()=>setFriendPreference('share_progress').catch(e=>setNotice(String(e)))} /><CheckChoice label="Afficher mon passage actuel" selected={friendProfile.share_location} onPress={()=>setFriendPreference('share_location').catch(e=>setNotice(String(e)))} /></>}<Button onPress={openFriends}>Ouvrir mes amis</Button>{admin?<Button secondary onPress={openAdmin}>Espace Administrateur</Button>:null}</Card>
    </>}{mode==='settings'&&<>    <Card><Label style={{fontWeight:'700'}}>Apparence</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Choisis ton univers visuel.</Label>{themeOptions.map(option=>{const selected=(state.theme??'lilac')===option.key;return <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{selected}} onPress={()=>update(touch({...state,theme:option.key}))} style={{borderWidth:selected?2:1,borderColor:selected?option.swatches[0]:colors.line,borderRadius:15,padding:11,marginBottom:9,backgroundColor:colors.paper,flexDirection:'row',alignItems:'center',gap:12}}><View style={{height:54,width:47,borderRadius:9,backgroundColor:option.swatches[2],borderWidth:1,borderColor:option.swatches[1],overflow:'hidden'}}><View style={{height:21,backgroundColor:option.swatches[0]}} /><View style={{height:20,marginHorizontal:6,marginTop:-5,borderRadius:4,backgroundColor:option.swatches[2],borderColor:option.swatches[1],borderWidth:1}} /></View><View style={{flex:1}}><Label style={{fontWeight:'700'}}>{option.name}</Label><Label style={{fontSize:12,color:colors.muted}}>{option.description}</Label><View style={{flexDirection:'row',gap:5,marginTop:5}}>{option.swatches.map(swatch=><View key={swatch} style={{width:13,height:13,borderRadius:7,backgroundColor:swatch,borderWidth:1,borderColor:'#0002'}} />)}</View></View><Label style={{fontSize:20,color:selected?colors.green2:colors.muted}}>{selected?'◉':'○'}</Label></Pressable>})}</Card>
    <Card><Label style={{fontWeight:'700'}}>Affichage du Coran</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Choisis la présentation arabe des pages.</Label><Choice label="Coran de Médine" subtitle="Le Coran traditionnel, avec sa mise en page classique." selected={state.reader?.mushaf==='traditional'} onPress={()=>update(touch({...state,reader:{...state.reader,mushaf:'traditional',followAudio:state.reader?.followAudio!==false}}))} /><Choice label="Coran avec règles de Tajwid" subtitle="Moushaf avec règles de Tajwid en couleur, affichage immersif et suivi audio verset par verset." selected={state.reader?.mushaf==='coranTest'} onPress={()=>update(touch({...state,reader:{...state.reader,mushaf:'coranTest',followAudio:state.reader?.followAudio!==false}}))} /><Choice label="Lecture simplifiée" subtitle="Lecture verset par verset, avec les règles de Tajweed en couleur." selected={state.reader?.mushaf==='tajweed'} onPress={()=>update(touch({...state,reader:{...state.reader,mushaf:'tajweed',followAudio:state.reader?.followAudio!==false}}))} />{zipSources.map(source=><DownloadSourceChoice key={source.id} selected={state.reader?.mushaf===source.id} onSelect={()=>update(touch({...state,reader:{...state.reader,mushaf:source.id,followAudio:state.reader?.followAudio!==false}}))}/>)}<Label style={{fontWeight:'700',marginTop:14,marginBottom:8}}>Fond du Coran avec règles de Tajwid</Label><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{quranPaperOptions.map(option=><Pressable key={option.key} accessibilityRole="radio" accessibilityLabel={`Fond ${option.label}`} accessibilityState={{selected:(state.reader?.paper??'ivory')===option.key}} onPress={()=>update(touch({...state,reader:{...state.reader,mushaf:state.reader?.mushaf??'coranTest',followAudio:state.reader?.followAudio!==false,paper:option.key}}))} style={{width:'47%',flexGrow:1,minHeight:58,borderRadius:14,padding:12,backgroundColor:option.color,borderWidth:(state.reader?.paper??'ivory')===option.key?2:1,borderColor:(state.reader?.paper??'ivory')===option.key?colors.green:colors.line,justifyContent:'center'}}><Label style={{color:'#342a27',fontWeight:'600'}}>{option.label} {(state.reader?.paper??'ivory')===option.key?'✓':''}</Label></Pressable>)}</View><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8}}><Label style={{flex:1}}>Suivre automatiquement la récitation sur la page suivante</Label><Switch value={state.reader?.followAudio!==false} onValueChange={value=>update(touch({...state,reader:{...state.reader,mushaf:state.reader?.mushaf??'coranTest',followAudio:value}}))} trackColor={{false:colors.line,true:colors.green2}} thumbColor={colors.paper} /></View></Card>
<Card>
      <Label style={{fontWeight:'700'}}>Notifications</Label>
      {!deviceNotificationsAllowed?<>
        <Label style={{color:colors.muted,fontSize:13,marginTop:8}}>Les notifications t’avertissent des messages, invitations, corrections et rappels personnels envoyés par le professeur.</Label>
        <Button secondary onPress={()=>ensureNotificationPermission(true).then(granted=>{if(granted){setDeviceNotificationsAllowed(true);update(touch({...state,notifications:{...notificationPrefs,permissionExplained:true}}));setNotice('Notifications autorisées.');}else setNotice('Autorisation refusée. Tu peux la modifier dans les réglages du téléphone.');}).catch(()=>setNotice('Les notifications sont indisponibles sur ce téléphone.'))}>Autoriser les notifications sur ce téléphone</Button>
      </>:null}
      {notificationSwitch('Rappel quotidien d’apprentissage à 19 h','learning',false)}
      {notificationSwitch('Messages privés','messages',true)}
      {notificationSwitch('Demandes d’amis','friendRequests',true)}
      {notificationSwitch('Progression partagée par les amis','sharedProgress',false)}
      {notificationSwitch('Corrections de mes récitations','corrections',true)}
      {notificationSwitch('Rappels personnels du professeur','adminMessages',true)}
      {notificationSwitch('Afficher le contenu des messages','messagePreview',true)}
      <Label style={{color:colors.muted,fontSize:13,marginTop:12}}>Le rappel quotidien est facultatif et programmé sur ce téléphone. Le professeur peut aussi envoyer des notifications personnalisées.</Label>
      <Button secondary small onPress={()=>testLocalNotification().then(()=>setNotice('Notification locale de test programmée dans 5 secondes.')).catch(e=>setNotice(`Test local impossible : ${e.message}`))}>Tester une notification sur ce téléphone</Button>
      <Button secondary small onPress={()=>scheduledReminderCounts().then(counts=>setNotice(`${counts.learning} ancien(s) rappel(s) quotidien(s) et ${counts.revision} rappel(s) de révision programmés sur ce téléphone.`)).catch(e=>setNotice(`Vérification impossible : ${e.message}`))}>Vérifier les rappels programmés</Button>
      {account?<Button secondary small onPress={()=>pushDiagnostic().then(setNotice).catch(e=>setNotice(`Push indisponible : ${e.message}`))}>Vérifier le jeton push</Button>:null}
    </Card>
    <Card><Label style={{fontWeight:'700'}}>Tout remettre à 0</Label><Label style={{color:colors.muted,fontSize:13,marginVertical:8}}>Recommencer le questionnaire et effacer tout l’apprentissage et toutes les révisions. Ton prénom et ton thème seront conservés.</Label><Button secondary disabled={resetting} onPress={confirmReset}>Réinitialiser apprentissage et révisions</Button><Button secondary onPress={confirmPreferenceReset}>Réinitialiser mes préférences</Button></Card>
    <Card><Label style={{fontWeight:'600',fontSize:14,color:colors.muted}}>Sources du Coran</Label><Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Texte Uthmani Hafs : Tanzil Project, copyright 2007–2021, licence CC BY 3.0. Texte reproduit sans modification.</Label><Pressable onPress={()=>Linking.openURL('https://tanzil.net')}><Label style={{color:colors.green2,textDecorationLine:'underline',marginTop:7}}>Voir Tanzil et les mises à jour ↗</Label></Pressable><Label style={{color:colors.muted,fontSize:13,marginTop:7}}>Pages Hafs 1405 issues de l’IPA fournie. Moushaf avec règles de Tajwid : polices QPC V4 et pagination originales issues de l’IPA fournie. Lecture simplifiée : annotations de cpfair sous CC BY 4.0 sur texte Tanzil Hafs 2017. Traduction française du sens : Rachid Maach, version 1.0.3, QuranEnc. Divisions juz’, hizb et rub‘ : Quran Meta. Les toumoun Hafs attendent une validation indépendante.</Label></Card>
  </>}</>;
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
    const done=generateProgram(seedInitialRevisions(touch({...state,onboardingDone:true,onboardingStep:undefined})));update(done);onDone();
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

function ReaderScreen({reader,page,setPage,onClose,onHome,onChangeSurah,onShareRecitation,onReviewDone,onStudyValidated,state,update,fullscreen,setFullscreen}:{reader:Reader;page:number;setPage:(n:number)=>void;onClose:()=>void;onHome?:()=>void;onChangeSurah:(surah:(typeof surahs)[number])=>void;onShareRecitation:(id:string)=>void;onStudyValidated?:()=>void;onReviewDone:(task:ReviewTask,grade:'perfect'|'hesitant'|'rework')=>void;state:AppState;update:(s:AppState)=>void;fullscreen:boolean;setFullscreen:(value:boolean)=>void}){
  const [completionOpen,setCompletionOpen]=useState(false);
  const consolidationSubmitting=useRef(false);
  const [sourcePicker,setSourcePicker]=useState(false);
  const mushaf=state.reader?.mushaf??'coranTest',immersive=mushaf==='coranTest';
  const [readerViewport,setReaderViewport]=useState({width:0,height:0});
  const [playingVerseId,setPlayingVerseId]=useState<number|null>(null);
  const [selectedVerse,setSelectedVerse]=useState<number|null>(null),[audioCommand,setAudioCommand]=useState<AudioCommand|null>(null),[commandSerial,setCommandSerial]=useState(0);
  const [bookmarkMode,setBookmarkMode]=useState(false),[bookmarksOpen,setBookmarksOpen]=useState(false),[bookmarkNotice,setBookmarkNotice]=useState(''),[audioDock,setAudioDock]=useState(false);
  const bookmarkTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(bookmarkTimer.current)clearTimeout(bookmarkTimer.current);},[]);
  const [sessionToolbarHeight,setSessionToolbarHeight]=useState(58);
  const [sessionPanel,setSessionPanel]=useState<'record'|'translation'|'options'|'session'|'verse'|'bookmarks'|null>(reader.initialLanguage==='fr'?'translation':null);
  const [surahPicker,setSurahPicker]=useState(false),[recordingActive,setRecordingActive]=useState(false);
  useEffect(()=>{setSelectedVerse(null);setPlayingVerseId(null);setAudioCommand(null);setSessionPanel(reader.initialLanguage==='fr'?'translation':null);},[reader.range.start,reader.range.end]);
  const sourcePageRange=immersive?testPageRange(page):isZipSource(mushaf)?zipPageRange(mushaf,page):pageRange(page);
  const sourcePageOf=(id:number)=>immersive?testVersePage(id,page):isZipSource(mushaf)?zipVersePage(mushaf,id,page):pageOf(id);
  const headingVerse=playingVerseId??(selectedVerse!==null&&sourcePageOf(selectedVerse)===page?selectedVerse:null)??(sourcePageOf(reader.range.start)===page?reader.range.start:sourcePageRange.start);
  const currentSurah=surahs[verseAt(headingVerse).surah-1];
  const [sourceWidth,sourceHeight]=immersive?[originalPageWidth,originalPageHeight]:isZipSource(mushaf)?zipPageData(mushaf,page).dimensions:mushaf==='tajweedPages'?(tajweedDimensions as Record<string,number[]>)[String(page)]:[1920,3106];
  const showChrome=true;
  const showPage=(next:number)=>{if(!recordingActive)setPage(next);};
  const revealCommands=()=>{};
  const followAudio=(id:number|null)=>{setPlayingVerseId(id);if(id!==null&&state.reader?.followAudio!==false){const next=immersive?testVersePage(id,page):isZipSource(mushaf)?zipVersePage(mushaf,id,page):pageOf(id);if(next!==page)showPage(next);}};
  const audioAction=(id:number,action:AudioCommand['action'])=>{setAudioCommand({serial:commandSerial+1,id,action});setCommandSerial(commandSerial+1);setSelectedVerse(null);};
  const chooseMushaf=()=>setSourcePicker(true);
  const swipe=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dx)>18&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.5,
    onPanResponderTerminationRequest:()=>false,
    onPanResponderRelease:(_,gesture)=>{if(recordingActive)return;if(Platform.OS==='ios'&&gesture.x0<28&&gesture.dx>75){onClose();return;}const next=pageAfterSwipe(page,gesture.dx,gesture.dy);if(next!==page){showPage(next);}},
  }),[page,setPage,onClose,recordingActive]);
  const validate=(kind:'done'|'work'|'postpone')=>{if(!reader.sessionId)return;const next=kind==='postpone'?postponeSession(state,reader.sessionId):completeSession(state,reader.sessionId,kind==='done');update(next);onClose();};
  const grade=(value:'perfect'|'hesitant'|'errors'|'relearn')=>{if(!reader.revisionId)return;const next=gradeRevision(state,reader.revisionId,value);update(value==='relearn'?generateProgram(next):next);onClose();};
  {
    const learning=!!reader.sessionId;
    const consolidationOffset=([1,3,7] as const).find(o=>!state.reviewConsolidations?.[reader.range.start]?.completed[o]);
    const validateConsolidation=()=>{if(consolidationSubmitting.current||!consolidationOffset)return;consolidationSubmitting.current=true;stopActiveAudio();update(completeConsolidation(loadState(),reader.range,todayLocal(),new Date().toISOString(),consolidationOffset));onStudyValidated?.();};
    const reviewing=!!(reader.reviewTask||reader.revisionId||reader.consolidation);
    const focused=learning||reviewing;
    const studyMode=learning?'learning':'revision',studyId=reader.sessionId??reader.reviewTask?.id??reader.revisionId;
    const studyRecord=studyId?state.studyProgress?.[studyKey(studyMode,studyId)]:undefined;
    const plannedRange=learning?state.sessions.find(s=>s.id===reader.sessionId)??reader.range:studyRecord??reader.range;
    const studyThrough=studyRecord?.through??plannedRange.start-1;
    const studyInfo=studyMetrics(plannedRange,studyThrough,mushaf);
    const validateStudy=(end:number,result:'perfect'|'hesitant'|'rework')=>{if(!allowPanelChange())return;if(reader.consolidation){validateConsolidation();return;}if(!studyId)return;stopActiveAudio();const next=validateStudyProgress(loadState(),studyMode,studyId,plannedRange,end,mushaf,reader.reviewTask?.category??studyRecord?.category??'habitual',result);update(next);setCompletionOpen(false);if(onStudyValidated)onStudyValidated();else onClose();};
    const submitReview=(value:'perfect'|'hesitant'|'rework')=>{if(!allowPanelChange())return;stopActiveAudio();if(reader.reviewTask)onReviewDone(reader.reviewTask,value);else grade(value==='rework'?'errors':value);};
    const bookmarkIds=visibleBookmarks(state).map(b=>b.verseId);
    const bookmarkVerse=(id:number)=>{if(!bookmarkMode)return;update(saveBookmark(state,id,new Date().toISOString(),{source:mushaf,page}));setBookmarkMode(false);setBookmarkNotice('Marque-page enregistré');if(bookmarkTimer.current)clearTimeout(bookmarkTimer.current);bookmarkTimer.current=setTimeout(()=>setBookmarkNotice(''),2500);};
    const fit=fitMushafPage(Math.max(1,readerViewport.width-4),Math.max(1,readerViewport.height-(focused&&isZipSource(mushaf)?48:0)),sourceWidth,sourceHeight);
    const allowPanelChange=()=>{if(recordingActive){Alert.alert('Enregistrement en cours','Arrête l’enregistrement avant de changer de panneau.');return false;}return true;};
    const openPanel=(panel:'record'|'translation'|'options'|'session'|'verse'|'bookmarks')=>{if(!allowPanelChange())return;if(panel==='record'){stopActiveAudio();audioAction(headingVerse,'stop');}setSessionPanel(sessionPanel===panel?null:panel);};
    const openAudio=(settings=false)=>{if(!allowPanelChange())return;setBookmarkMode(false);setSessionPanel(null);audioAction(selectedVerse!==null&&sourcePageOf(selectedVerse)===page?selectedVerse:sourcePageOf(reader.range.start)===page?reader.range.start:sourcePageRange.start,settings===true?'settings':'open');};
    if(isZipSource(mushaf)&&!quranDownloaded())return <View style={{flex:1,justifyContent:'center'}}><QuranDownload onReady={()=>update(touch({...state}))} onBack={onClose}/></View>;
    if(bookmarksOpen)return <BookmarksScreen pageForBookmark={item=>sourceVersePage(mushaf,item.verseId,item.sourcePages?.[mushaf])} state={state} update={update} onClose={()=>setBookmarksOpen(false)} onResume={id=>{const resumePage=sourceVersePage(mushaf,id,state.bookmarks?.[id]?.sourcePages?.[mushaf]);update(useBookmark(state,id,new Date().toISOString(),resumePage));setBookmarksOpen(false);setSessionPanel(null);onChangeSurah(surahs[verseAt(id).surah-1]);showPage(resumePage);setSelectedVerse(id);}}/>;

    return <View style={{flex:1,backgroundColor:colors.soft}}>

      <View onLayout={event=>{const {width,height}=event.nativeEvent.layout;setReaderViewport(previous=>previous.width===width&&previous.height===height?previous:{width,height});}} style={{flex:1,alignItems:'center',justifyContent:'flex-start',overflow:'hidden'}}>
        {immersive?<View style={{position:'absolute',left:0,right:0,top:0,bottom:0}}><CoranTestScreen page={page} onPage={showPage} onClose={()=>{if(allowPanelChange())onClose();}} onStudyPress={()=>{if(allowPanelChange())reader.consolidation?setSessionPanel('session'):setCompletionOpen(true);}} readerState={{study:focused?{title:reader.consolidation?`Consolidation · J+${consolidationOffset??7}`:`${reader.consolidation?'Consolidation':learning?'Apprentissage':'Révision'} · ${studyInfo.done} / ${studyInfo.total} ${studyInfo.unit}`,unit:studyInfo.pages?'Pages':'Versets',range:studyInfo.pages?`${studyInfo.first} → ${studyInfo.last}`:studyRangeLabel(plannedRange),ratio:studyInfo.ratio,primary:colors.green,background:colors.soft}:undefined,background:quranPaperColor(state.reader?.paper),...readerOverlayState({playingVerseId,selectedVerseId:selectedVerse,bookmarkIds,difficultyIds:Object.keys(state.difficultyMarkers??{}).filter(id=>state.difficultyMarkers?.[id]?.user||state.difficultyMarkers?.[id]?.admin).map(Number),sessionRange:reader.range,showSession:focused,selecting:bookmarkMode,primary:colors.green,selection:colors.selected,gold:colors.gold})}} onVersePress={bookmarkVerse} onVerseLongPress={id=>{if(allowPanelChange()){setSelectedVerse(id);setSessionPanel('verse');}}} onBlankLongPress={()=>openPanel('options')} onTap={revealCommands}/></View>:readerViewport.width>0&&readerViewport.height>0&&<ZoomableReader reflow={mushaf==='tajweed'} key={`${mushaf}-${page}`} width={readerViewport.width} height={readerViewport.height}>{({zoomed,textScale,mapPoint,allowTap})=><ScrollView scrollEnabled={mushaf==='tajweed'} {...(zoomed?{}:swipe.panHandlers)} style={{width:mushaf==='tajweed'?readerViewport.width:fit.width,height:mushaf==='tajweed'?readerViewport.height:fit.height,flexGrow:0}} contentContainerStyle={{alignItems:'center',flexGrow:mushaf==='tajweed'?1:0}}><MushafPage studyBanner={focused&&!isZipSource(mushaf)?<StudyBanner consolidationOffset={reader.consolidation?consolidationOffset:undefined} mode={studyMode} range={plannedRange} through={studyThrough} source={mushaf} onPress={()=>{if(allowPanelChange())reader.consolidation?setSessionPanel('session'):setCompletionOpen(true);}}/>:undefined} textScale={textScale} allowTap={allowTap} mapImagePoint={(event,callback)=>mapPoint(event,(x,y)=>callback(x-(readerViewport.width-fit.width)/2,y))} page={page} width={mushaf==='tajweed'?readerViewport.width:fit.width} height={mushaf==='tajweed'?readerViewport.height:fit.height} mode={mushaf} language="ar" playingVerseId={playingVerseId} difficultyIds={Object.keys(state.difficultyMarkers??{}).filter(id=>state.difficultyMarkers?.[id]?.user||state.difficultyMarkers?.[id]?.admin).map(Number)} sessionRange={reader.range} showSession={focused} bookmarkIds={bookmarkIds} onVersePress={bookmarkMode?bookmarkVerse:undefined} onVerseLongPress={id=>{if(allowPanelChange()){setSelectedVerse(id);setSessionPanel('verse');}}} onBlankLongPress={()=>openPanel('options')} onTap={revealCommands}/></ScrollView>}</ZoomableReader>}
        {focused&&isZipSource(mushaf)&&<View style={{position:'absolute',bottom:0,left:10,right:10}}><StudyBanner consolidationOffset={reader.consolidation?consolidationOffset:undefined} mode={studyMode} range={plannedRange} through={studyThrough} source={mushaf} onPress={()=>reader.consolidation?setSessionPanel('session'):setCompletionOpen(true)}/></View>}

      </View>
{showChrome&&<View onLayout={event=>setSessionToolbarHeight(event.nativeEvent.layout.height)} style={{width:'100%',paddingHorizontal:6,paddingVertical:4}}><ReaderFloatingActions active={bookmarkMode||sessionPanel==='bookmarks'?'bookmark':sessionPanel==='record'?'record':sessionPanel==='options'?'options':audioDock?'audio':null} onHome={()=>{if(allowPanelChange())(onHome??onClose)();}} onRecord={()=>openPanel('record')} onMore={()=>openPanel('options')} disabled={recordingActive} onAudio={openAudio} onBookmark={()=>openPanel('bookmarks')}/></View>}
      {!!(bookmarkMode||bookmarkNotice)&&<View pointerEvents="none" style={{position:'absolute',top:8,left:10,right:10,alignItems:'center'}}><Label style={{backgroundColor:colors.soft,color:colors.green,padding:10,borderRadius:12,fontSize:12}}>{bookmarkMode?'Touche le verset exact à enregistrer':bookmarkNotice}</Label></View>}
      <View style={sessionPanel?{height:0,overflow:'hidden'}:{position:'absolute',bottom:showChrome?sessionToolbarHeight+12:8,left:0,right:0,maxHeight:'70%',zIndex:5}} pointerEvents={sessionPanel?'none':'auto'}><PassageAudioPlayer userId={state.userId} reciterPreference={state.audioPreferences?.reciterId} onReciterPreference={id=>update(touch({...loadState(),audioPreferences:{reciterId:id}}))} sessionRange={reader.range} page={page} pageRangeOverride={sourcePageRange} command={audioCommand} onVerseChange={followAudio} onDockChange={open=>setAudioDock(open)} sessionMode={focused} fullscreen={false} compact maxPanelHeight={Math.max(140,readerViewport.height*.34)} hideLaunch/></View>

      {sessionPanel&&sessionPanel!=='options'&&<View style={{position:'absolute',bottom:showChrome?sessionToolbarHeight+12:8,left:8,right:8,maxHeight:sessionPanel==='record'?'38%':'70%',backgroundColor:colors.paper,borderRadius:24,borderWidth:1,borderColor:colors.line,padding:sessionPanel==='record'?10:16,...premiumShadow,elevation:12}}><View style={{flexDirection:'row',alignItems:'center',marginBottom:sessionPanel==='record'?0:10}}><Label style={{flex:1,fontWeight:'800'}}>{sessionPanel==='record'?'Ma récitation':sessionPanel==='translation'?'Traduction française':sessionPanel==='bookmarks'?'Marques-pages':sessionPanel==='session'?'Ma séance':'Actions du verset'}</Label><Pressable disabled={recordingActive} accessibilityLabel="Fermer le panneau" onPress={()=>{setSessionPanel(null);setSelectedVerse(null);}} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="close" color={colors.green}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">
        {sessionPanel==='record'&&<RecitationRecorder compact key={`${reader.range.start}-${reader.range.end}`} range={focused?reader.range:sourcePageRange} onRecordingChange={setRecordingActive} onShare={item=>onShareRecitation(item.id)}/>}
        {sessionPanel==='translation'&&Array.from({length:(focused?reader.range:sourcePageRange).end-(focused?reader.range:sourcePageRange).start+1},(_,i)=>(focused?reader.range:sourcePageRange).start+i).map(id=><View key={id} style={{paddingVertical:10,borderBottomWidth:1,borderColor:colors.line}}><Label style={{fontSize:12,color:colors.gold}}>{reference({start:id,end:id})}</Label><Label style={{lineHeight:25,marginTop:5}}>{frenchVerse(id)?.translation}</Label></View>)}
        {sessionPanel==='verse'&&<>{selectedVerse!==null&&<><Label>Verset {verseAt(selectedVerse).ayah}</Label><Button small onPress={()=>{audioAction(selectedVerse,'listen');setSessionPanel(null);}}>Écouter ce verset</Button><Button small secondary onPress={()=>{audioAction(selectedVerse,'repeat');setSessionPanel(null);}}>Répéter ce verset</Button><Button small secondary onPress={()=>{audioAction(selectedVerse,'select');setSessionPanel(null);}}>Sélectionner un passage</Button>{<Button small secondary onPress={()=>update(toggleDifficulty(state,selectedVerse))}>{state.difficultyMarkers?.[selectedVerse]?.user?'Retirer des révisions prioritaires':'Marquer comme difficile'}</Button>}</>}</>}
        {sessionPanel==='session'&&<>{reader.consolidation&&<Button onPress={validateConsolidation}>Valider la consolidation · J+{consolidationOffset??7}</Button>}{reviewing&&!reader.consolidation&&<RevisionBottomActionBar onGrade={()=>{setSessionPanel(null);reader.consolidation?setSessionPanel('session'):setCompletionOpen(true);}} onAudio={openAudio} onRecord={()=>openPanel('record')} active={audioDock?'audio':null} disabled={recordingActive}/>}{reader.revisionId&&<Button secondary onPress={()=>grade('relearn')}>À réapprendre</Button>}{focused&&!reader.consolidation&&<Button onPress={()=>{setSessionPanel(null);reader.consolidation?setSessionPanel('session'):setCompletionOpen(true);}}>Valider une partie ou toute la séance</Button>}{learning&&<><Label style={{fontWeight:'700',marginTop:12}}>Après ma séance</Label><Button secondary onPress={()=>validate('work')}>Je dois encore le travailler</Button><Button secondary onPress={()=>validate('postpone')}>Reporter cette séance</Button></>}</>}
        {sessionPanel==='bookmarks'&&<><Button onPress={()=>{setSessionPanel(null);setBookmarkMode(true);}}>Placer un marque-page sur un verset</Button><Button secondary onPress={()=>{setSessionPanel(null);setBookmarksOpen(true);}}>Mes marques-pages</Button></>}
      </ScrollView></View>}
      {sessionPanel==='options'&&<ReaderMoreSheet bottom={sessionToolbarHeight+8} onClose={()=>setSessionPanel(null)} onSurah={()=>{setSessionPanel(null);setSurahPicker(true);}} onTranslation={()=>openPanel('translation')} onAudio={()=>openAudio(true)} onDisplay={()=>{setSessionPanel(null);chooseMushaf();}}/>}
      <Modal visible={sourcePicker} transparent animationType="fade" onRequestClose={()=>{setSourcePicker(false);setSessionPanel('options');}}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'rgba(0,0,0,0.3)'}}><Card><Label style={{fontWeight:'700',fontSize:20,marginBottom:15}}>Affichage du Coran</Label>{([{label:'Coran de Médine',mode:'traditional'},{label:'Coran avec règles de Tajwid',mode:'coranTest'},{label:'Lecture simplifiée',mode:'tajweed'},...zipSources.map(s=>({label:s.label,mode:s.id}))] as const).map(item=>isZipSource(item.mode)?<DownloadSourceChoice key={item.mode} selected={mushaf===item.mode} onSelect={()=>{setSourcePicker(false);setSessionPanel(null);setFullscreen(false);showPage(item.mode==='coranTest'?testVersePage(headingVerse,page):isZipSource(item.mode)?zipVersePage(item.mode,headingVerse):pageOf(headingVerse));update(touch({...state,reader:{...state.reader,mushaf:item.mode,followAudio:state.reader?.followAudio!==false}}));}}/>:<Button key={item.mode} secondary onPress={()=>{setSourcePicker(false);setSessionPanel(null);setFullscreen(false);showPage(item.mode==='coranTest'?testVersePage(headingVerse,page):isZipSource(item.mode)?zipVersePage(item.mode,headingVerse):pageOf(headingVerse));update(touch({...state,reader:{...state.reader,mushaf:item.mode,followAudio:state.reader?.followAudio!==false}}));}}>{item.label}</Button>)}{focused&&<Button secondary onPress={()=>{setSourcePicker(false);setSessionPanel('session');}}>Actions de la séance · {reference(reader.range)}</Button>}<Button secondary onPress={()=>{setSourcePicker(false);setSessionPanel('options');}}>Retour aux options</Button></Card></View></Modal>
      {completionOpen&&focused&&studyId&&<StudyCompletionSheet key={`${studyId}-${studyThrough}`} mode={studyMode} range={plannedRange} through={studyThrough} source={mushaf} currentPage={page} onClose={()=>setCompletionOpen(false)} onValidate={validateStudy}/>}
      <SurahPicker visible={surahPicker} currentSurah={currentSurah.number} currentPage={page} onPage={next=>{setSurahPicker(false);showPage(next);}} onClose={()=>{setSurahPicker(false);setSessionPanel('options');}} onSelect={surah=>{stopActiveAudio();setPlayingVerseId(null);setAudioCommand(null);setSelectedVerse(null);setSessionPanel(null);setSurahPicker(false);onChangeSurah(surah);}}/>
    </View>;
  }

}
