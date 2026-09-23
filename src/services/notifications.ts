import { AppState as DeviceAppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { learningReminderBody, learningReminderTitle, reminderPlan } from '../core/notificationPlan';
import { currentUser, supabase } from './sync';

const reminderKind='learning-reminder';
const revisionKind='revision-reminder';
const messageKind='private-message';
const progressKind='friend-progress';
let activeLinkId:string|null=null;
let messagesEnabled=true;
let progressEnabled=false;
let registeredToken:string|null=null;
let installationId:string|null=null;
let scheduleQueue=Promise.resolve();
const displayedMessages=new Set<string>();

Notifications.setNotificationHandler({handleNotification:async notification=>{
  const data=notification.request.content.data;
  const messageId=typeof data?.messageId==='string'?data.messageId:'';
  const isChat=data?.kind===messageKind||data?.kind===progressKind;
  const sameChat=isChat&&data?.linkId===activeLinkId&&DeviceAppState.currentState==='active';
  const duplicate=isChat&&!!messageId&&displayedMessages.has(messageId);
  const show=!(sameChat||duplicate||data?.kind===messageKind&&!messagesEnabled||data?.kind===progressKind&&!progressEnabled);
  if(isChat&&messageId){displayedMessages.add(messageId);if(displayedMessages.size>200)displayedMessages.clear();}
  return {shouldShowBanner:show,shouldShowList:show,shouldPlaySound:show,shouldSetBadge:false};
}});

export function setActiveConversation(linkId:string|null){activeLinkId=linkId;updatePushPresence(linkId).catch(()=>{});}
export function setMessagePresentationEnabled(enabled:boolean){messagesEnabled=enabled;}
export function setProgressPresentationEnabled(enabled:boolean){progressEnabled=enabled;}

export async function configureNotificationChannels(){
  if(Platform.OS!=='android')return;
  await Notifications.setNotificationChannelAsync('messages',{name:'Messages privés',importance:Notifications.AndroidImportance.HIGH});
  await Notifications.setNotificationChannelAsync('learning',{name:'Rappels d’apprentissage',importance:Notifications.AndroidImportance.HIGH});
}

export async function ensureNotificationPermission(){
  await configureNotificationChannels();
  let result=await Notifications.getPermissionsAsync();
  if(!result.granted&&result.ios?.status!==Notifications.IosAuthorizationStatus.PROVISIONAL)result=await Notifications.requestPermissionsAsync();
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

export async function saveNotificationPreferences(preferences:{messages:boolean;friendRequests:boolean;sharedProgress:boolean;revision:boolean;messagePreview:boolean}){
  if(!supabase)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('notification_preferences').upsert({user_id:user.id,messages_enabled:preferences.messages,friend_requests_enabled:preferences.friendRequests,shared_progress_enabled:preferences.sharedProgress,revision_reminders_enabled:preferences.revision,message_preview_enabled:preferences.messagePreview,updated_at:new Date().toISOString()});
  if(error)throw error;
}

export async function scheduleRevisionReminder(dueDates:string[],enabled:boolean){
  const scheduled=await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter(item=>item.content.data?.kind===revisionKind).map(item=>Notifications.cancelScheduledNotificationAsync(item.identifier)));
  if(!enabled||!dueDates.length)return;
  const now=new Date();
  const dates=dueDates.map(value=>new Date(`${value}T19:00:00`)).filter(date=>!Number.isNaN(date.getTime())).sort((a,b)=>a.getTime()-b.getTime());
  const next=dates.find(date=>date>now)??new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,19);
  if(!await ensureNotificationPermission())return;
  await Notifications.scheduleNotificationAsync({content:{title:'Un passage t’attend en révision',body:'Prends quelques minutes pour consolider ce que tu as mémorisé.',data:{kind:revisionKind},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:next,channelId:'learning'}});
}

export async function testLocalNotification(){
  if(!await ensureNotificationPermission())throw new Error('Autorise les notifications dans les réglages du téléphone.');
  await Notifications.scheduleNotificationAsync({content:{title:learningReminderTitle,body:learningReminderBody,data:{kind:reminderKind,test:true},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5,channelId:'learning'}});
}

export function notificationDestination(data:Record<string,unknown>|undefined){
  if(data?.kind===reminderKind)return {kind:'program' as const};
  if(data?.kind===revisionKind)return {kind:'program' as const};
  if(data?.kind===messageKind&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  if(data?.kind===progressKind&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  if((data?.kind==='friend-request'||data?.kind==='friend-accepted')&&typeof data.linkId==='string')return {kind:'conversation' as const,linkId:data.linkId};
  return null;
}

export {Notifications};
