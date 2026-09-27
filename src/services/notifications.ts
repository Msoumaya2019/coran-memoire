import { AppState as DeviceAppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentUser, supabase } from './sync';

const reminderKind='learning-reminder';
const revisionKind='revision-reminder';
const messageKind='private-message';
const progressKind='friend-progress';
const correctionKind='recitation-corrected';
const adminKind='admin-reminder';
let activeLinkId:string|null=null;
let recitationsVisible=false;
let messagesEnabled=true;
let progressEnabled=false;
let correctionsEnabled=true;
let adminMessagesEnabled=true;
let registeredToken:string|null=null;
let registeredUser:string|null=null;
let installationId:string|null=null;
let registrationTask:Promise<string|undefined>|null=null;
let scheduleQueue=Promise.resolve();
const displayedMessages=new Set<string>();

Notifications.setNotificationHandler({handleNotification:async notification=>{
  const data=notification.request.content.data;
  const messageId=typeof data?.messageId==='string'?data.messageId:'';
  const isChat=data?.kind===messageKind||data?.kind===progressKind;
  const sameChat=isChat&&data?.linkId===activeLinkId&&DeviceAppState.currentState==='active';
  const correctionId=data?.kind===correctionKind&&typeof data?.recitationId==='string'?`${data.recitationId}:${data.revision??''}`:'';
  const adminId=data?.kind===adminKind&&typeof data?.notificationId==='string'?data.notificationId:'';
  const uniqueId=messageId||correctionId||adminId;
  const duplicate=!!uniqueId&&displayedMessages.has(uniqueId);
  const sameRecitations=data?.kind===correctionKind&&recitationsVisible&&DeviceAppState.currentState==='active';
  const show=!(sameChat||sameRecitations||duplicate||data?.kind===messageKind&&!messagesEnabled||data?.kind===progressKind&&!progressEnabled||data?.kind===correctionKind&&!correctionsEnabled||data?.kind===adminKind&&!adminMessagesEnabled);
  if(uniqueId){displayedMessages.add(uniqueId);if(displayedMessages.size>200)displayedMessages.clear();}
  return {shouldShowBanner:show,shouldShowList:show,shouldPlaySound:show,shouldSetBadge:false};
}});

export function setActiveConversation(linkId:string|null){activeLinkId=linkId;updatePushPresence(linkId).catch(error=>console.warn('[Push] presence failed',error));}
export function setMessagePresentationEnabled(enabled:boolean){messagesEnabled=enabled;}
export function setProgressPresentationEnabled(enabled:boolean){progressEnabled=enabled;}
export function setCorrectionPresentationEnabled(enabled:boolean){correctionsEnabled=enabled;}
export function setAdminMessagePresentationEnabled(enabled:boolean){adminMessagesEnabled=enabled;}
export function setRecitationsVisible(visible:boolean){recitationsVisible=visible;}

export async function configureNotificationChannels(){
  if(Platform.OS!=='android')return;
  await Notifications.setNotificationChannelAsync('messages',{name:'Messages privés',importance:Notifications.AndroidImportance.HIGH});
  await Notifications.setNotificationChannelAsync('learning',{name:'Rappels d’apprentissage',importance:Notifications.AndroidImportance.HIGH});
  await Notifications.setNotificationChannelAsync('corrections',{name:'Corrections des récitations',importance:Notifications.AndroidImportance.HIGH});
  await Notifications.setNotificationChannelAsync('admin',{name:'Rappels du professeur',importance:Notifications.AndroidImportance.HIGH});
}

export async function ensureNotificationPermission(prompt=false){
  await configureNotificationChannels();
  let result=await Notifications.getPermissionsAsync();
  if(prompt&&!result.granted&&!([Notifications.IosAuthorizationStatus.PROVISIONAL,Notifications.IosAuthorizationStatus.EPHEMERAL] as number[]).includes(result.ios?.status??-1))result=await Notifications.requestPermissionsAsync();
  if(__DEV__)console.log('[Push] permission',Platform.OS,result.status,result.ios?.status??'');
  return result.granted||result.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL||result.ios?.status===Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export function cancelAutomaticReminders():Promise<void>{
  const next=scheduleQueue.catch(()=>{}).then(async()=>{
    const scheduled=await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter(item=>[reminderKind,revisionKind].includes(String(item.content.data?.kind)))
      .map(item=>Notifications.cancelScheduledNotificationAsync(item.identifier)));
  });
  scheduleQueue=next;
  return next;
}

async function registerPushDeviceNow(){
  if(!supabase)throw new Error('Synchronisation non configurée.');
  const user=await currentUser();if(!user)return;
  if(!await ensureNotificationPermission())throw new Error('Autorise les notifications dans les réglages du téléphone.');
  const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
  if(!projectId)throw new Error('Projet Expo manquant pour les notifications push.');
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  installationId=installationId??await AsyncStorage.getItem('notification-installation-id');
  if(!installationId){installationId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;await AsyncStorage.setItem('notification-installation-id',installationId);}
  if(__DEV__)console.log('[Push] local token',{platform:Platform.OS,userId:user.id,projectId,token});
  const {error}=await supabase.rpc('register_push_device',{p_installation_id:installationId,p_expo_push_token:token,p_platform:Platform.OS});
  if(error)throw error;
  const {data:stored,error:readError}=await supabase.from('push_devices').select('user_id,expo_push_token,platform,updated_at').eq('installation_id',installationId).maybeSingle();
  if(readError)throw readError;
  if(stored?.user_id!==user.id||stored.expo_push_token!==token||stored.platform!==Platform.OS)throw new Error('Jeton push non associé à ce compte.');
  if(__DEV__)console.log('[Push] Supabase confirmed',{platform:stored.platform,userId:stored.user_id,updatedAt:stored.updated_at});
  const active=await currentUser();if(active?.id!==user.id)throw new Error('Le compte a changé pendant l’inscription push. Réessaie.');
  registeredUser=user.id;registeredToken=token;
  return token;
}

export async function registerPushDevice(){
  if(registrationTask){await registrationTask;const user=await currentUser();if(user?.id===registeredUser)return registeredToken??undefined;}
  registrationTask=registerPushDeviceNow().finally(()=>{registrationTask=null;});
  return registrationTask;
}

export async function pushDiagnostic(){
  await registerPushDevice();
  if(!supabase)throw new Error('Synchronisation non configurée.');
  const {data,error}=await supabase.rpc('my_push_delivery_status');if(error)throw error;
  const last=data?.[0];
  if(__DEV__)console.log('[Push] delivery diagnostic',{platform:Platform.OS,userId:registeredUser,deliveries:data});
  const provider=last?.error_code==='InvalidCredentials'?'Expo signale des credentials APNs manquants ou invalides.':last?.error_code==='DeviceNotRegistered'?'Un ancien jeton a été refusé par le fournisseur.':last?`Dernier envoi : ${last.status}${last.error_code?' · '+last.error_code:''}`:'Aucun nouvel envoi suivi pour ce compte.';
  return `Permission : OK · ${Platform.OS==='ios'?'iOS':'Android'} · Jeton Expo et association Supabase : OK. ${provider}`;
}

export async function updatePushPresence(linkId:string|null){
  if(!supabase||!registeredToken)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('push_devices').update({active_link_id:linkId,last_active_at:new Date().toISOString()}).eq('expo_push_token',registeredToken).eq('user_id',user.id);
  if(error)throw error;
}

export async function unregisterPushDevice(){
  if(!supabase)return;
  if(registrationTask)await registrationTask.catch(error=>console.warn('[Push] pending registration',error));
  const user=await currentUser();if(!user)return;
  installationId=installationId??await AsyncStorage.getItem('notification-installation-id');if(!installationId)return;
  const {error}=await supabase.from('push_devices').delete().eq('installation_id',installationId).eq('user_id',user.id);
  if(error)throw error;
  registeredToken=null;registeredUser=null;
}

export async function saveNotificationPreferences(preferences:{messages:boolean;friendRequests:boolean;sharedProgress:boolean;revision:boolean;corrections:boolean;adminMessages:boolean;messagePreview:boolean}){
  if(!supabase)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('notification_preferences').upsert({user_id:user.id,messages_enabled:preferences.messages,friend_requests_enabled:preferences.friendRequests,shared_progress_enabled:preferences.sharedProgress,revision_reminders_enabled:preferences.revision,corrections_enabled:preferences.corrections,admin_messages_enabled:preferences.adminMessages,message_preview_enabled:preferences.messagePreview,updated_at:new Date().toISOString()});
  if(error)throw error;
}

export async function syncLearningReminder(enabled:boolean){
  const next=scheduleQueue.catch(error=>console.warn('[Push] reminder queue',error)).then(async()=>{
    const scheduled=await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter(item=>item.content.data?.kind===reminderKind).map(item=>Notifications.cancelScheduledNotificationAsync(item.identifier)));
    if(!enabled||!await ensureNotificationPermission())return;
    await Notifications.scheduleNotificationAsync({content:{title:'Ton programme du Coran',body:'Retrouve ton passage du jour et prends un moment pour apprendre.',data:{kind:reminderKind},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour:19,minute:0,channelId:'learning'}});
    if(__DEV__)console.log('[Push] learning reminder scheduled',{platform:Platform.OS,hour:19});
  });scheduleQueue=next;return next;
}

export async function testLocalNotification(){
  if(!await ensureNotificationPermission(true))throw new Error('Autorise les notifications dans les réglages du téléphone.');
  await Notifications.scheduleNotificationAsync({content:{title:'Test des notifications',body:'Les notifications sont autorisées sur ce téléphone.',data:{kind:'notification-test'},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5,channelId:'learning'}});
}

export async function scheduledReminderCounts(){
  await scheduleQueue.catch(()=>{});
  const scheduled=await Notifications.getAllScheduledNotificationsAsync();
  return {
    learning:scheduled.filter(item=>item.content.data?.kind===reminderKind).length,
    revision:scheduled.filter(item=>item.content.data?.kind===revisionKind).length,
  };
}

export function notificationDestination(data:Record<string,unknown>|undefined){
  if(data?.kind===adminKind)return {kind:'program' as const};
  if(data?.kind===reminderKind)return {kind:'program' as const};
  if(data?.kind===revisionKind)return {kind:'reviews' as const};
  if(data?.kind===correctionKind&&typeof data.recitationId==='string')return {kind:'recitation' as const,recitationId:data.recitationId};
  if(data?.kind===messageKind&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  if(data?.kind===progressKind&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  if((data?.kind==='friend-request'||data?.kind==='friend-accepted')&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  return null;
}

export {Notifications};
