import * as SQLite from 'expo-sqlite';
import {Directory,File,Paths} from 'expo-file-system';
import {supabase} from './sync';
import {verseAt} from '../core/quran';

export type LocalRecitation={id:string;userId:string;start:number;end:number;durationMs:number;uri:string;createdAt:string;syncStatus:'pending'|'uploading'|'synced'|'failed'};
export type RemoteRecitation={id:string;user_id:string;start_verse_id:number;end_verse_id:number;duration_ms:number;storage_path:string;created_at:string;listened_at?:string|null;display_name?:string};
export type VerseCorrection={id:string;recitation_id:string;verse_id:number;comment:string|null;voice_path:string|null;created_at:string;resolved_at:string|null};
export type GeneralFeedback={id:string;recitation_id:string;comment:string|null;voice_path:string|null;created_at:string};

const db=SQLite.openDatabaseSync('coran-memoire.db');
db.execSync('CREATE TABLE IF NOT EXISTS local_recitations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, start_verse_id INTEGER NOT NULL, end_verse_id INTEGER NOT NULL, duration_ms INTEGER NOT NULL, uri TEXT NOT NULL, created_at TEXT NOT NULL, sync_status TEXT NOT NULL)');
const folder=new Directory(Paths.document,'recitations');
const validRange=(start:number,end:number)=>Number.isInteger(start)&&Number.isInteger(end)&&start>=1&&end<=6236&&start<=end;
const uid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;

export function localRecitations(userId:string):LocalRecitation[]{
  return db.getAllSync<{id:string;user_id:string;start_verse_id:number;end_verse_id:number;duration_ms:number;uri:string;created_at:string;sync_status:LocalRecitation['syncStatus']}>('SELECT * FROM local_recitations WHERE user_id=? ORDER BY created_at DESC',userId).map(row=>({id:row.id,userId:row.user_id,start:row.start_verse_id,end:row.end_verse_id,durationMs:row.duration_ms,uri:row.uri,createdAt:row.created_at,syncStatus:row.sync_status}));
}

export async function saveLocalRecitation(sourceUri:string,start:number,end:number,durationMs:number,userId:string):Promise<LocalRecitation>{
  if(!validRange(start,end)||!userId||!sourceUri||durationMs<=0)throw new Error('Récitation ou passage invalide.');
  folder.create({idempotent:true,intermediates:true});
  const id=uid(),extension=sourceUri.toLowerCase().includes('.3gp')?'.3gp':'.m4a';
  const file=new File(folder,`${id}${extension}`);
  await new File(sourceUri).copy(file);
  const item:LocalRecitation={id,userId,start,end,durationMs,uri:file.uri,createdAt:new Date().toISOString(),syncStatus:'pending'};
  db.runSync('INSERT INTO local_recitations (id,user_id,start_verse_id,end_verse_id,duration_ms,uri,created_at,sync_status) VALUES (?,?,?,?,?,?,?,?)',id,userId,start,end,durationMs,item.uri,item.createdAt,'pending');
  return item;
}

export function deleteLocalRecitation(item:LocalRecitation){
  new File(item.uri).delete();
  db.runSync('DELETE FROM local_recitations WHERE id=? AND user_id=?',item.id,item.userId);
}

let syncing=false;
export async function syncPendingRecitations():Promise<void>{
  if(syncing||!supabase)return;
  const {data:{session}}=await supabase.auth.getSession();
  const userId=session?.user.id;
  if(!userId)return;
  syncing=true;
  try{
    for(const item of localRecitations(userId).filter(row=>row.syncStatus!=='synced')){
      db.runSync('UPDATE local_recitations SET sync_status=? WHERE id=?','uploading',item.id);
      try{
        const file=new File(item.uri);
        if(!file.exists)throw new Error('Fichier local introuvable.');
        const path=`${userId}/${item.id}${item.uri.endsWith('.3gp')?'.3gp':'.m4a'}`;
        const bytes=await file.bytes();
        const {error:uploadError}=await supabase.storage.from('recitations').upload(path,bytes,{contentType:path.endsWith('.3gp')?'audio/3gpp':'audio/mp4',upsert:false});
        if(uploadError&&!/already exists|duplicate/i.test(uploadError.message))throw uploadError;
        const {error:rowError}=await supabase.from('recitations').upsert({id:item.id,user_id:userId,start_verse_id:item.start,end_verse_id:item.end,duration_ms:item.durationMs,storage_path:path,created_at:item.createdAt},{onConflict:'id',ignoreDuplicates:true});
        if(rowError)throw rowError;
        db.runSync('UPDATE local_recitations SET sync_status=? WHERE id=?','synced',item.id);
      }catch{
        db.runSync('UPDATE local_recitations SET sync_status=? WHERE id=?','failed',item.id);
      }
    }
  }finally{syncing=false;}
}

export async function listRemoteRecitations(forAdmin=false):Promise<RemoteRecitation[]>{
  if(!supabase)return [];
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return [];
  let query=supabase.from('recitations').select('id,user_id,start_verse_id,end_verse_id,duration_ms,storage_path,created_at,listened_at').order('created_at',{ascending:false}).limit(forAdmin?200:100);
  if(!forAdmin)query=query.eq('user_id',session.user.id);
  const {data,error}=await query;
  if(error)throw error;
  return data??[];
}

export async function markRecitationListened(id:string):Promise<void>{
  if(!supabase)return;
  const {error}=await supabase.from('recitations').update({listened_at:new Date().toISOString()}).eq('id',id).is('listened_at',null);
  if(error)throw error;
}

export async function listCorrections(recitationId:string):Promise<VerseCorrection[]>{
  if(!supabase)return [];
  const {data,error}=await supabase.from('recitation_corrections').select('id,recitation_id,verse_id,comment,voice_path,created_at,resolved_at').eq('recitation_id',recitationId).order('created_at',{ascending:false});
  if(error)throw error;
  return data??[];
}

export async function listGeneralFeedback(recitationId:string):Promise<GeneralFeedback[]>{
  if(!supabase)return [];
  const {data,error}=await supabase.from('recitation_feedback').select('id,recitation_id,comment,voice_path,created_at').eq('recitation_id',recitationId).order('created_at',{ascending:false});
  if(error)throw error;
  return data??[];
}

export async function publishGeneralFeedback(recitationId:string,comment:string,voicePath:string|null):Promise<void>{
  if(!supabase)throw new Error('Compte indisponible.');
  if(!comment.trim()&&!voicePath)throw new Error('Ajoute un commentaire ou une correction vocale.');
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Connecte-toi.');
  const {error}=await supabase.from('recitation_feedback').insert({recitation_id:recitationId,admin_id:user.id,comment:comment.trim()||null,voice_path:voicePath});
  if(error)throw error;
}

export async function myCorrectionMarkers():Promise<{verse_id:number;comment:string|null;created_at:string;resolved_at:string|null}[]>{
  if(!supabase)return [];
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return [];
  const {data:owned,error:ownedError}=await supabase.from('recitations').select('id').eq('user_id',session.user.id);
  if(ownedError)throw ownedError;
  if(!owned?.length)return [];
  const {data,error}=await supabase.from('recitation_corrections').select('verse_id,comment,created_at,resolved_at').in('recitation_id',owned.map(row=>row.id)).order('created_at',{ascending:true});
  if(error)throw error;
  return data??[];
}

export async function adminCorrectionIds():Promise<Set<string>>{
  if(!supabase)return new Set();
  const {data,error}=await supabase.from('recitation_corrections').select('recitation_id');
  if(error)throw error;
  return new Set((data??[]).map(row=>row.recitation_id));
}

export async function signedAudioUrl(path:string):Promise<string>{
  if(!supabase)throw new Error('Compte indisponible.');
  const {data,error}=await supabase.storage.from('recitations').createSignedUrl(path,600);
  if(error||!data)throw error??new Error('Audio indisponible.');
  return data.signedUrl;
}
export async function deleteMyRecitation(recitation:RemoteRecitation):Promise<void>{
  if(!supabase)throw new Error('Connexion requise.');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session||session.user.id!==recitation.user_id)throw new Error('Cette récitation ne t’appartient pas.');
  const {error:fileError}=await supabase.storage.from('recitations').remove([recitation.storage_path]);
  if(fileError)throw fileError;
  const {error:rowError}=await supabase.from('recitations').delete().eq('id',recitation.id).eq('user_id',session.user.id);
  if(rowError)throw rowError;
  const local=localRecitations(session.user.id).find(item=>item.id===recitation.id);
  if(local)deleteLocalRecitation(local);
}

export async function publishCorrections(recitation:RemoteRecitation,items:{verseId:number;comment:string;voicePath?:string|null}[]):Promise<void>{
  if(!supabase)throw new Error('Compte indisponible.');
  if(!items.length)throw new Error('Sélectionne au moins un verset.');
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Connecte-toi.');
  const rows=items.map(item=>{
    if(item.verseId<recitation.start_verse_id||item.verseId>recitation.end_verse_id||!verseAt(item.verseId))throw new Error('Verset hors de la récitation.');
    return {recitation_id:recitation.id,verse_id:item.verseId,comment:item.comment.trim()||null,voice_path:item.voicePath??null,admin_id:user.id};
  });
  const {error}=await supabase.from('recitation_corrections').insert(rows);
  if(error)throw error;
}

export async function finalizeRecitationCorrection(recitation:RemoteRecitation,requestId:string,items:{verseId:number;comment:string}[],generalComment:string,voicePath:string|null):Promise<void>{
  if(!supabase)throw new Error('Compte indisponible.');
  for(const item of items)if(item.verseId<recitation.start_verse_id||item.verseId>recitation.end_verse_id||!verseAt(item.verseId))throw new Error('Verset hors de la récitation.');
  const {error}=await supabase.rpc('finalize_recitation_correction',{
    p_recitation_id:recitation.id,p_request_id:requestId,p_verses:items,
    p_general_comment:generalComment.trim()||null,p_voice_path:voicePath,
  });
  if(error)throw error;
}
