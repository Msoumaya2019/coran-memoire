import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import {AppState as NativeAppState} from 'react-native';
import {useEffect,useState} from 'react';
import {supabase} from './sync';
import {loadState} from './storage';
import {emptyQuiz,mergeQuizSnapshot,quizDay,QuizSnapshot,QuizQuestion,recordDailyAnswer} from '../core/quiz';
const db=SQLite.openDatabaseSync('coran-quiz.db');
db.execSync('CREATE TABLE IF NOT EXISTS quiz_cache(user_id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS quiz_outbox(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL)');
const listeners=new Set<()=>void>();
const emit=()=>{for(const fn of listeners)fn();};
export function cachedQuiz(userId:string|undefined):QuizSnapshot{if(!userId)return emptyQuiz(quizDay());const row=db.getFirstSync<{data:string}>('SELECT data FROM quiz_cache WHERE user_id=?',userId);try{return row?JSON.parse(row.data):emptyQuiz(quizDay());}catch{return emptyQuiz(quizDay());}}
function save(userId:string,data:QuizSnapshot){db.runSync('INSERT INTO quiz_cache(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data',userId,JSON.stringify(data));emit();}
export async function quizRpc(name:string,args:Record<string,unknown>={}){if(!supabase)throw new Error('Connexion nécessaire.');const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PGRST202'?'Le service Quiz doit être activé sur le serveur.':error.message);return data;}
let flight:Promise<void>|null=null;
export function refreshQuiz():Promise<void>{if(flight)return flight;const userId=loadState().userId;if(!userId)return Promise.resolve();flight=(async()=>{
 do{ const rows=db.getAllSync<{id:string;payload:string}>('SELECT id,payload FROM quiz_outbox WHERE user_id=? ORDER BY created_at,rowid',userId);
 for(const row of rows){if(loadState().userId!==userId)return;await quizRpc('quiz_answer_daily',JSON.parse(row.payload));db.runSync('DELETE FROM quiz_outbox WHERE id=? AND user_id=?',row.id,userId);}
 if(loadState().userId!==userId)return;
 const remote=await quizRpc('quiz_snapshot',{p_day:quizDay()}) as QuizSnapshot;
 if(loadState().userId===userId)save(userId,mergeQuizSnapshot(remote,cachedQuiz(userId)));
 }while(loadState().userId===userId&&db.getFirstSync('SELECT id FROM quiz_outbox WHERE user_id=?',userId));
 })().finally(()=>{flight=null;});return flight;}
export function answerDaily(question:QuizQuestion,answerId:string){const userId=loadState().userId;if(!userId)throw new Error('Connecte-toi pour enregistrer ta réponse.');const day=quizDay(),old=cachedQuiz(userId),at=new Date().toISOString(),next=recordDailyAnswer(old,question,answerId,day,at);if(next===old)return;
 db.withTransactionSync(()=>{save(userId,next);db.runSync('INSERT OR IGNORE INTO quiz_outbox(id,user_id,payload,created_at) VALUES(?,?,?,?)',`${userId}:${day}`,userId,JSON.stringify({p_question:question.id,p_answer:answerId,p_day:day,p_answered_at:at}),at);});void refreshQuiz().catch(()=>{});}
export async function createQuizChallenge(opponentId:string,count:5|10,quizSet?:string){const network=await NetInfo.fetch();if(!network.isConnected||network.isInternetReachable===false)throw new Error('Connexion nécessaire pour lancer ce défi');const id=await quizRpc('quiz_create_challenge',{p_opponent:opponentId,p_count:count,p_set:quizSet??null});await refreshQuiz();return id as string;}
export async function answerChallenge(id:string,questionId:string,answerId:string){await quizRpc('quiz_answer_challenge',{p_challenge:id,p_question:questionId,p_answer:answerId});await refreshQuiz();}
export function useQuiz(userId:string|undefined){const [snapshot,setSnapshot]=useState(()=>cachedQuiz(userId));useEffect(()=>{const sync=()=>setSnapshot(cachedQuiz(userId));listeners.add(sync);sync();const timer=setInterval(()=>setSnapshot({...cachedQuiz(userId)}),60000);return()=>{listeners.delete(sync);clearInterval(timer);};},[userId]);return snapshot;}
export function observeQuizSync(){let stopped=false;const sync=()=>{if(!stopped)void refreshQuiz().catch(()=>{});};sync();const remove=NetInfo.addEventListener(s=>{if(s.isConnected&&s.isInternetReachable!==false)sync();});const foreground=NativeAppState.addEventListener('change',s=>{if(s==='active')sync();});const timer=setInterval(sync,30000);return()=>{stopped=true;remove();foreground.remove();clearInterval(timer);};}
