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

export async function currentUser() {const response=await supabase?.auth.getUser();return response?.data.user??null;}
export async function signIn(email:string,password:string,register=false) {
  if(!supabase)throw new Error('Synchronisation non configurée');
  const result=register?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  return result.data.user;
}
export async function signOut(){await supabase?.auth.signOut();}
export async function pullState():Promise<AppState|null>{
  if(!supabase)return null;
  const user=await currentUser();if(!user)return null;
  const {data,error}=await supabase.from('user_state').select('data').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return data?.data as AppState|null;
}
export async function pushState(state:AppState):Promise<void>{
  if(!supabase)return;
  const user=await currentUser();if(!user)return;
  const {error}=await supabase.from('user_state').upsert({user_id:user.id,data:state,updated_at:state.updatedAt});
  if(error)throw error;
}
