import {useEffect} from 'react';
import {AppState} from 'react-native';
import * as SQLite from 'expo-sqlite';
import {supabase} from './sync';
const db=SQLite.openDatabaseSync('coran-memoire.db');
db.execSync('CREATE TABLE IF NOT EXISTS app_usage_pending (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,started_at TEXT NOT NULL,seconds INTEGER NOT NULL,ended INTEGER NOT NULL)');
export function elapsedUsageSeconds(start:number,now:number){return Math.max(0,Math.floor((now-start)/1000));}
export function useAppUsage(userId?:string){useEffect(()=>{
 if(!userId)return;
 let session:{id:string;startedAt:string;start:number}|null=null,sending=false;
 const begin=()=>{if(!session){const start=Date.now();session={id:`${start}-${Math.random().toString(36).slice(2)}`,start,startedAt:new Date(start).toISOString()};record(false);}};
 const record=(ended:boolean)=>{if(!session)return;db.runSync('INSERT OR REPLACE INTO app_usage_pending(id,user_id,started_at,seconds,ended) VALUES(?,?,?,?,?)',session.id,userId,session.startedAt,elapsedUsageSeconds(session.start,Date.now()),ended?1:0);};
 const flush=async()=>{if(sending||!supabase)return;sending=true;try{const {data:{session:auth}}=await supabase.auth.getSession();if(auth?.user.id!==userId)return;for(const row of db.getAllSync<{id:string;started_at:string;seconds:number;ended:number}>('SELECT * FROM app_usage_pending WHERE user_id=? ORDER BY started_at LIMIT 50',userId)){const {error}=await supabase.rpc('record_app_usage',{p_id:row.id,p_started_at:row.started_at,p_seconds:row.seconds,p_ended:!!row.ended});if(error)break;db.runSync('DELETE FROM app_usage_pending WHERE id=? AND seconds=? AND ended=?',row.id,row.seconds,row.ended);}}catch{/* Retained for retry when connected. */}finally{sending=false;}};
 if(AppState.currentState!=='background'&&AppState.currentState!=='inactive')begin();void flush();
 const subscription=AppState.addEventListener('change',status=>{if(status==='active')begin();else {record(true);session=null;}void flush();});
 const authSubscription=supabase?.auth.onAuthStateChange(()=>{setTimeout(()=>void flush(),0);});
 const timer=setInterval(()=>{record(false);void flush();},15000);
 return()=>{record(true);session=null;void flush();clearInterval(timer);subscription.remove();authSubscription?.data.subscription.unsubscribe();};
 },[userId]);}
export function formatUsageDuration(seconds:number){const n=Math.max(0,Math.floor(seconds));if(n<60)return `${n} s`;const minutes=Math.floor(n/60);return minutes<60?`${minutes} min ${n%60} s`:`${Math.floor(minutes/60)} h ${minutes%60} min`;}
