import * as SQLite from 'expo-sqlite';
import {Directory,File,Paths} from 'expo-file-system';
import * as FS from 'expo-file-system/legacy';
import {Platform} from 'react-native';
import {supabase} from './sync';
import {emptyRoqyaLibrary,normalizeRoqyaCatalog,Roqya,RoqyaAudio,RoqyaLibrary,safeMediaUrl} from '../core/roqya';

const db=SQLite.openDatabaseSync('coran-memoire.db');
db.execSync('CREATE TABLE IF NOT EXISTS roqya_local (key TEXT PRIMARY KEY, data TEXT NOT NULL)');
db.execSync('CREATE TABLE IF NOT EXISTS roqya_downloads (audio_id TEXT PRIMARY KEY, local_file_path TEXT NOT NULL, downloaded_at TEXT NOT NULL, source TEXT NOT NULL)');
function read<T>(key:string,fallback:T):T{try{const row=db.getFirstSync<{data:string}>('SELECT data FROM roqya_local WHERE key=?',key);return row?JSON.parse(row.data):fallback;}catch{return fallback;}}
function write(key:string,data:unknown){db.runSync('INSERT INTO roqya_local(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',key,JSON.stringify(data));}
export const loadRoqyaLibrary=(userId?:string)=>read<RoqyaLibrary>(`library:${userId??'guest'}`,emptyRoqyaLibrary());
export const saveRoqyaLibrary=(library:RoqyaLibrary,userId?:string)=>write(`library:${userId??'guest'}`,library);
export const cachedRoqyas=()=>read<Roqya[]>('catalog',[]);
export async function fetchRoqyas():Promise<Roqya[]>{
 if(!supabase)return cachedRoqyas();
 const {data,error}=await supabase.from('roqyas').select('*,roqya_audios(*,roqya_reciters(*))').eq('enabled',true).order('sort_order');
 if(error)throw new Error(error.code==='42P01'||error.code==='PGRST205'?'Le catalogue Roqya sera disponible prochainement.':'Catalogue indisponible. Les écoutes enregistrées restent accessibles.');
 const catalog=normalizeRoqyaCatalog(data??[]);write('catalog',catalog);return catalog;
}
const root=()=>new Directory(Paths.document,'roqya-audio');
const sourceKey=(audio:RoqyaAudio)=>`${audio.storagePath??audio.audioUrl??''}:${audio.fileSize??''}`;
export function localRoqyaFile(audio:RoqyaAudio):string|undefined{
 try{const saved=db.getFirstSync<{local_file_path:string;source:string}>('SELECT local_file_path,source FROM roqya_downloads WHERE audio_id=?',audio.id);if(!saved)return;
 if(saved.source===sourceKey(audio)&&new File(saved.local_file_path).exists&&new File(saved.local_file_path).size>0)return saved.local_file_path;
 db.runSync('DELETE FROM roqya_downloads WHERE audio_id=?',audio.id);
 }catch{}return;
}
export async function roqyaRemoteUrl(audio:RoqyaAudio){
 if(audio.storagePath){if(!supabase)throw new Error('Connexion au catalogue indisponible.');const {data,error}=await supabase.storage.from('roqya-audio').createSignedUrl(audio.storagePath,21600);if(error||!data?.signedUrl)throw new Error('Cet audio est indisponible. Réessaie après avoir actualisé le catalogue.');return data.signedUrl;}
 const url=safeMediaUrl(audio.audioUrl);if(!url)throw new Error('Adresse audio invalide.');return url;
}
export async function roqyaPlaybackUrl(audio:RoqyaAudio){return localRoqyaFile(audio)??await roqyaRemoteUrl(audio);}
export type RoqyaDownload={phase:'idle'|'downloading'|'ready'|'error';progress:number|null;message?:string};
const downloads=new Map<string,RoqyaDownload>(),running=new Map<string,Promise<void>>(),observers=new Set<()=>void>();
export const observeRoqyaDownloads=(fn:()=>void)=>{observers.add(fn);return()=>{observers.delete(fn);};};
const publish=(id:string,value:RoqyaDownload)=>{downloads.set(id,value);observers.forEach(fn=>fn());};
export const roqyaDownloadState=(audio:RoqyaAudio):RoqyaDownload=>localRoqyaFile(audio)?{phase:'ready',progress:1}:downloads.get(audio.id)?.phase==='ready'?{phase:'idle',progress:0}:downloads.get(audio.id)??{phase:'idle',progress:0};
export function downloadRoqya(audio:RoqyaAudio):Promise<void>{
 if(localRoqyaFile(audio))return Promise.resolve();if(running.has(audio.id))return running.get(audio.id)!;
 const promise=(async()=>{
  if(Platform.OS==='web')throw new Error('Le téléchargement hors ligne est disponible sur iPhone et Android.');
  root().create({idempotent:true,intermediates:true});
  const name=encodeURIComponent(audio.id),extension=/\.m4a(?:\?|$)/i.test(audio.storagePath??audio.audioUrl??'')?'m4a':'mp3';
  const partial=new File(root(),`${name}.part`),target=new File(root(),`${name}.${extension}`);
  publish(audio.id,{phase:'downloading',progress:0});
  try{
   const url=await roqyaRemoteUrl(audio);
   const task=FS.createDownloadResumable(url,partial.uri,{sessionType:FS.FileSystemSessionType.FOREGROUND},event=>publish(audio.id,{phase:'downloading',progress:event.totalBytesExpectedToWrite>0?Math.min(1,event.totalBytesWritten/event.totalBytesExpectedToWrite):null}));
   const result=await task.downloadAsync();
   if(!result||result.status<200||result.status>=300||!partial.exists||partial.size<=0)throw new Error('Téléchargement interrompu. Vérifie ta connexion et réessaie.');
   if(audio.fileSize&&partial.size!==audio.fileSize)throw new Error('Fichier incomplet. Relance le téléchargement.');
   if(target.exists)target.delete();partial.move(target);
   db.runSync('INSERT INTO roqya_downloads(audio_id,local_file_path,downloaded_at,source) VALUES(?,?,?,?) ON CONFLICT(audio_id) DO UPDATE SET local_file_path=excluded.local_file_path,downloaded_at=excluded.downloaded_at,source=excluded.source',audio.id,target.uri,new Date().toISOString(),sourceKey(audio));
   publish(audio.id,{phase:'ready',progress:1});
  }catch(error){if(partial.exists)partial.delete();publish(audio.id,{phase:'error',progress:0,message:roqyaError(error)});throw error;}
 })().finally(()=>running.delete(audio.id));running.set(audio.id,promise);return promise;
}
export function deleteRoqyaDownload(audio:RoqyaAudio){if(running.has(audio.id))throw new Error('Attends la fin du téléchargement.');const uri=localRoqyaFile(audio);if(uri){const file=new File(uri);if(file.exists)file.delete();}db.runSync('DELETE FROM roqya_downloads WHERE audio_id=?',audio.id);publish(audio.id,{phase:'idle',progress:0});}
export function roqyaError(error:unknown){const text=error instanceof Error?error.message:String(error);return /network|offline|connection|fetch|timed? ?out/i.test(text)?'Connexion interrompue. Réessaie ou choisis une Roqya téléchargée.':/ENOSPC|disk|storage.*full/i.test(text)?'Espace insuffisant sur le téléphone.':text;}
