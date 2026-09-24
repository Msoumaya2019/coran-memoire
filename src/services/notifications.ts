import { AppState as DeviceAppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { learningReminderBody, learningReminderTitle, reminderPlan, revisionReminderDates } from '../core/notificationPlan';
import { currentUser, supabase } from './sync';

const reminderKind='learning-reminder';
const revisionKind='revision-reminder';
const messageKind='private-message';
const progressKind='friend-progress';
const correctionKind='recitation-corrected';
let activeLinkId:string|null=null;
let recitationsVisible=false;
let messagesEnabled=true;
let progressEnabled=false;
let correctionsEnabled=true;
let registeredToken:string|null=null;
let installationId:string|null=null;
let scheduleQueue=Promise.resolve();
const displayedMessages=new Set<string>();

Notifications.setNotificationHandler({handleNotification:async notification=>{
  const data=notification.request.content.data;
  const messageId=typeof data?.messageId==='string'?data.messageId:'';
  const isChat=data?.kind===messageKind||data?.kind===progressKind;
  const sameChat=isChat&&data?.linkId===activeLinkId&&DeviceAppState.currentState==='active';
  const correctionId=data?.kind===correctionKind&&typeof data?.recitationId==='string'?`${data.recitationId}:${data.revision??''}`:'';
  const uniqueId=messageId||correctionId;
  const duplicate=!!uniqueId&&displayedMessages.has(uniqueId);
  const sameRecitations=data?.kind===correctionKind&&recitationsVisible&&DeviceAppState.currentState==='active';
  const show=!(sameChat||sameRecitations||duplicate||data?.kind===messageKind&&!messagesEnabled||data?.kind===progressKind&&!progressEnabled||data?.kind===correctionKind&&!correctionsEnabled);
  if(uniqueId){displayedMessages.add(uniqueId);if(displayedMessages.size>200)displayedMessages.clear();}
  return {shouldShowBanner:show,shouldShowList:show,shouldPlaySound:show,shouldSetBadge:false};
}});

export function setActiveConversation(linkId:string|null){activeLinkId=linkId;updatePushPresence(linkId).catch(()=>{});}
export function setMessagePresentationEnabled(enabled:boolean){messagesEnabled=enabled;}
export function setProgressPresentationEnabled(enabled:boolean){progressEnabled=enabled;}
export function setCorrectionPresentationEnabled(enabled:boolean){correctionsEnabled=enabled;}
export function setRecitationsVisible(visible:boolean){recitationsVisible=visible;}

export async function configureNotificationChannels(){
  if(Platform.OS!=='android')return;
  await Notifications.setNotificationChannelAsync('messages',{name:'Messages privés',importance:Notifications.AndroidImportance.HIGH});
  await Notifications.setNotificationChannelAsync('learning',{name:'Rappels d’apprentissage',importance:Notifications.AndroidImportance.HIGH});
  await Notifications.setNotificationChannelAsync('corrections',{name:'Corrections des récitations',importance:Notifications.AndroidImportance.HIGH});
}

export async function ensureNotificationPermission(prompt=false){
  await configureNotificationChannels();
  let result=await Notifications.getPermissionsAsync();
  if(prompt&&!result.granted&&result.ios?.status!==Notifications.IosAuthorizationStatus.PROVISIONAL)result=await Notifications.requestPermissionsAsync();
  return result.granted||result.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export function scheduleLearningReminders(days:number[],enabled:boolean):Promise<void>{
  const plan=reminderPlan(days,enabled);
  const next=scheduleQueue.catch(()=>{}).then(async()=>{
    const scheduled=await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter(item=>item.content.data?.kind===reminderKind)
      .map(item=>Notifications.cancelScheduledNotificationAsync(item.identifier)));
    if(!plan.length)return;
    if(!await ensureNotificationPermission())throw new Error('Autorise les notifications dans les réglages du téléphone.');
    for(const item of plan){
      await Notifications.scheduleNotificationAsync({
        content:{title:learningReminderTitle,body:learningReminderBody,data:{kind:reminderKind,day:item.day},sound:'default'},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.WEEKLY,weekday:item.expoWeekday,hour:item.hour,minute:item.minute,channelId:'learning'},
      });
    }
  });
  scheduleQueue=next;
  return next;
}

export async function registerPushDevice(){
  if(!supabase)throw new Error('Synchronisation non configurée.');
  const user=await currentUser();if(!user)return;
  if(!await ensureNotificationPermission())throw new Error('Autorise les notifications dans les réglages du téléphone.');
  const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
  if(!projectId)throw new Error('Projet Expo manquant pour les notifications push.');
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  installationId=installationId??await AsyncStorage.getItem('notification-installation-id');
  if(!installationId){installationId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;await AsyncStorage.setItem('notification-installation-id',installationId);}
  const {error}=await supabase.from('push_devices').upsert({installation_id:installationId,user_id:user.id,expo_push_token:token,platform:Platform.OS,updated_at:new Date().toISOString()},{onConflict:'installation_id'});
  if(error)throw error;
  registeredToken=token;
  return token;
}

export async function updatePushPresence(linkId:string|null){
  if(!supabase||!registeredToken)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('push_devices').update({active_link_id:linkId,last_active_at:new Date().toISOString()}).eq('expo_push_token',registeredToken).eq('user_id',user.id);
  if(error)throw error;
}

export async function unregisterPushDevice(){
  if(!supabase||!registeredToken)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('push_devices').delete().eq('expo_push_token',registeredToken).eq('user_id',user.id);
  if(error)throw error;
  registeredToken=null;
}

export async function saveNotificationPreferences(preferences:{messages:boolean;friendRequests:boolean;sharedProgress:boolean;revision:boolean;corrections:boolean;messagePreview:boolean}){
  if(!supabase)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('notification_preferences').upsert({user_id:user.id,messages_enabled:preferences.messages,friend_requests_enabled:preferences.friendRequests,shared_progress_enabled:preferences.sharedProgress,revision_reminders_enabled:preferences.revision,corrections_enabled:preferences.corrections,message_preview_enabled:preferences.messagePreview,updated_at:new Date().toISOString()});
  if(error)throw error;
}

export function scheduleRevisionReminder(dueDates:string[],enabled:boolean):Promise<void>{
  const next=scheduleQueue.catch(()=>{}).then(async()=>{
    const scheduled=await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter(item=>item.content.data?.kind===revisionKind).map(item=>Notifications.cancelScheduledNotificationAsync(item.identifier)));
    const dates=revisionReminderDates(dueDates,enabled);
    if(!dates.length||!await ensureNotificationPermission())return;
    for(const date of dates)await Notifications.scheduleNotificationAsync({content:{title:'Un passage t’attend en révision',body:'Retrouve les versets à consolider dans Mes révisions.',data:{kind:revisionKind},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date,channelId:'learning'}});
  });
  scheduleQueue=next;
  return next;
}

export async function testLocalNotification(){
  if(!await ensureNotificationPermission(true))throw new Error('Autorise les notifications dans les réglages du téléphone.');
  await Notifications.scheduleNotificationAsync({content:{title:learningReminderTitle,body:learningReminderBody,data:{kind:reminderKind,test:true},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5,channelId:'learning'}});
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
  if(data?.kind===reminderKind)return {kind:'program' as const};
  if(data?.kind===revisionKind)return {kind:'reviews' as const};
  if(data?.kind===correctionKind&&typeof data.recitationId==='string')return {kind:'recitation' as const,recitationId:data.recitationId};
  if(data?.kind===messageKind&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  if(data?.kind===progressKind&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  if((data?.kind==='friend-request'||data?.kind==='friend-accepted')&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  return null;
}

export {Notifications};
