import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState } from '../core/program';

const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const syncConfigured=Boolean(url&&key);
export const supabase=syncConfigured?createClient(url!,key!,{
  auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false,lock:processLock}
}):null;
const mobileAuthRedirect='coranmemoire://auth';

export async function currentUser() {const response=await supabase?.auth.getUser();return response?.data.user??null;}
export async function signIn(email:string,password:string,register=false) {
  if(!supabase)throw new Error('Synchronisation non configurée');
  const result=register?await supabase.auth.signUp({email,password,options:{emailRedirectTo:mobileAuthRedirect}}):await supabase.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  return result.data.session?result.data.user:null;
}
export async function signOut(){await supabase?.auth.signOut();}
export async function requestPasswordLink(email:string){
  if(!supabase)throw new Error('Synchronisation non configurée');
  const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:mobileAuthRedirect});
  if(error)throw error;
}
export async function resendSignupConfirmation(email:string){
  if(!supabase)throw new Error('Synchronisation non configurée');
  const {error}=await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:mobileAuthRedirect}});
  if(error)throw error;
}
export async function consumeAuthLink(url:string){
  if(!supabase||!url.startsWith('coranmemoire://auth'))return null;
  const parsed=new URL(url);
  const params=new URLSearchParams(parsed.hash.replace(/^#/,''));
  if(params.get('error'))throw new Error(params.get('error_description')??'Lien expiré ou invalide.');
  const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
  if(!access_token||!refresh_token)throw new Error('Lien de connexion incomplet.');
  const {data,error}=await supabase.auth.setSession({access_token,refresh_token});
  if(error)throw error;
  return data.user;
}
export async function changePassword(password:string){
  if(!supabase)throw new Error('Synchronisation non configurée');
  const {error}=await supabase.auth.updateUser({password});
  if(error)throw error;
}
export async function pullState():Promise<AppState|null>{
  if(!supabase)return null;
  const user=await currentUser();if(!user)return null;
  const {data,error}=await supabase.from('user_state').select('data').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return data?.data as AppState|null;
}
let pendingPush:Promise<void>=Promise.resolve();
export function pushState(state:AppState):Promise<void>{
  const next=pendingPush.catch(()=>{}).then(async()=>{
    if(!supabase)return;
    const user=await currentUser();if(!user)throw new Error('Connecte-toi pour synchroniser tes données.');
    if(state.userId!==user.id)throw new Error('Ces données appartiennent à un autre compte.');
    const {error}=await supabase.from('user_state').upsert({user_id:user.id,data:state,updated_at:state.updatedAt});
    if(error)throw error;
  });
  pendingPush=next;
  return next;
}
