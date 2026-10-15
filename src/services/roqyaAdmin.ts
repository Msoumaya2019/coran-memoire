import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import {supabase} from './sync';
import {isSocialAdmin} from './social';
import {safeMediaUrl} from '../core/roqya';
export type RoqyaAdminKind='roqyas'|'roqya_reciters'|'roqya_audios';
export type RoqyaAdminRow={id?:string;title?:string;name?:string;description?:string;category?:string;image_url?:string|null;photo_url?:string|null;enabled:boolean;sort_order:number;roqya_id?:string;reciter_id?:string;storage_path?:string|null;audio_url?:string|null;duration_seconds?:number;file_size?:number|null};
export type RoqyaAdminCatalog=Record<RoqyaAdminKind,RoqyaAdminRow[]>;
async function client(){if(!supabase)throw new Error('Supabase n’est pas configuré.');if(!await isSocialAdmin())throw new Error('Accès administrateur refusé.');return supabase;}
export async function loadRoqyaAdmin():Promise<RoqyaAdminCatalog>{const db=await client();const tables:RoqyaAdminKind[]=['roqyas','roqya_reciters','roqya_audios'];const rows=await Promise.all(tables.map(async table=>{const {data,error}=await db.from(table).select('*').order('sort_order');if(error)throw new Error('Chargement impossible. Vérifie la connexion et les migrations Roqya.');return data as RoqyaAdminRow[];}));return Object.fromEntries(tables.map((table,i)=>[table,rows[i]])) as RoqyaAdminCatalog;}
export function validateRoqyaAdmin(kind:RoqyaAdminKind,row:RoqyaAdminRow){
 if(!Number.isInteger(row.sort_order))throw new Error('L’ordre doit être un nombre entier.');
 for(const url of [row.image_url,row.photo_url,row.audio_url])if(url&&!safeMediaUrl(url))throw new Error('Utilise une adresse HTTPS valide.');
 if(kind==='roqyas'&&!row.title?.trim())throw new Error('Le titre est obligatoire.');
 if(kind==='roqya_reciters'&&!row.name?.trim())throw new Error('Le nom est obligatoire.');
 if(kind==='roqya_audios'){
 if(!row.roqya_id||!row.reciter_id)throw new Error('Choisis une Roqya et un récitateur.');
 if(!row.storage_path&&!row.audio_url)throw new Error('Ajoute un fichier audio.');
 if(row.storage_path&&(!/^[^/].*\.(mp3|m4a)$/i.test(row.storage_path)||row.storage_path.includes('..')))throw new Error('Chemin audio invalide.');
 if(!Number.isFinite(row.duration_seconds)||Number(row.duration_seconds)<=0)throw new Error('Indique une durée en secondes supérieure à zéro.');
 }
}
export async function saveRoqyaAdmin(kind:RoqyaAdminKind,row:RoqyaAdminRow){validateRoqyaAdmin(kind,row);const db=await client();const fields=kind==='roqyas'?['title','description','category','image_url']:kind==='roqya_reciters'?['name','description','photo_url']:['roqya_id','reciter_id','storage_path','audio_url','duration_seconds','file_size'];const value=Object.fromEntries(['enabled','sort_order',...fields].map(key=>[key,(row as unknown as Record<string,unknown>)[key]??null]));const result=row.id?await db.from(kind).update(value).eq('id',row.id).select('id').single():await db.from(kind).insert(value).select('id').single();if(result.error)throw new Error('Enregistrement refusé ou impossible. Vérifie tes droits et la connexion.');return result.data.id as string;}
export type UploadedRoqyaFile={bucket:string;path:string;url?:string;size:number;name:string};
export async function uploadRoqyaFile(audio:boolean,onProgress:(progress:number)=>void):Promise<UploadedRoqyaFile|null>{
 const db=await client();const selected=await DocumentPicker.getDocumentAsync({type:audio?['audio/mpeg','audio/mp4','audio/x-m4a']:['image/jpeg','image/png','image/webp'],copyToCacheDirectory:true,multiple:false});if(selected.canceled)return null;
 const file=selected.assets[0],extension=file.name.split('.').pop()?.toLowerCase();
 if(!extension||!(audio?['mp3','m4a']:['jpg','jpeg','png','webp']).includes(extension))throw new Error(audio?'Choisis un fichier MP3 ou M4A.':'Choisis une image JPG, PNG ou WebP.');
 const info=await FS.getInfoAsync(file.uri);if(!info.exists||!('size' in info)||info.size<=0)throw new Error('Fichier vide ou introuvable.');
 if(!audio&&info.size>10*1024*1024)throw new Error('L’image doit faire moins de 10 Mo.');
 const {data:{session},error}=await db.auth.getSession();if(error||!session)throw new Error('Reconnecte-toi avant l’envoi.');
 const bucket=audio?'roqya-audio':'roqya-images',path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
 const mime=audio?(extension==='mp3'?'audio/mpeg':'audio/mp4'):(extension==='webp'?'image/webp':extension==='png'?'image/png':'image/jpeg');
 onProgress(0);
 try{const task=FS.createUploadTask(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,file.uri,{httpMethod:'POST',uploadType:FS.FileSystemUploadType.BINARY_CONTENT,headers:{Authorization:`Bearer ${session.access_token}`,apikey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,'Content-Type':mime,'x-upsert':'false'}},p=>onProgress(Math.min(.99,p.totalBytesSent/(p.totalBytesExpectedToSend||info.size))));const result=await task.uploadAsync();if(!result||result.status<200||result.status>=300)throw new Error('Envoi interrompu ou refusé. Réessaie.');onProgress(1);return {bucket,path,size:info.size,name:file.name,url:audio?undefined:db.storage.from(bucket).getPublicUrl(path).data.publicUrl};}
 catch(error){await db.storage.from(bucket).remove([path]).catch(()=>{});throw error;}
 finally{await FS.deleteAsync(file.uri,{idempotent:true}).catch(()=>{});}
}
export async function discardRoqyaUpload(file:UploadedRoqyaFile){const db=await client();const {error}=await db.storage.from(file.bucket).remove([file.path]);if(error)throw new Error('Le fichier temporaire n’a pas pu être retiré. Réessaie.');}
