import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from './sync';
export type ContentType='reminder'|'invocation';
export type ContentCategory={id:string;name:string;icon:string;type:ContentType;display_order:number;is_active:boolean};
export type DailyContent={id:string;type:ContentType;title:string|null;arabic_text:string|null;phonetic_text:string|null;french_text:string;explanation:string|null;source:string;reference:string|null;category_id:string;audio_url:string|null;image_url:string|null;is_active:boolean;created_at?:string;updated_at?:string;category_name?:string};
export type Schedule={content_id:string;type:ContentType;display_date:string};
export const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function db(){if(!supabase)throw new Error('Service de contenus non configuré.');return supabase;}
function checked<T>(r:{data:T;error:any}){if(r.error)throw r.error;return r.data;}
const observers=new Set<()=>void>();
export function contentChanged(){observers.forEach(fn=>fn());}
export function observeContents(fn:()=>void){observers.add(fn);return()=>{observers.delete(fn);};}
export async function dayContents(){const key=`daily-content:${localDate()}`;const data=checked(await db().rpc('daily_content_for_date',{p_date:localDate()})) as DailyContent[];await AsyncStorage.setItem(key,JSON.stringify(data));return data;}
export async function cachedDayContents():Promise<DailyContent[]>{try{return JSON.parse(await AsyncStorage.getItem(`daily-content:${localDate()}`)??'[]');}catch{return [];}}
export async function categories(admin=false):Promise<ContentCategory[]>{let q=db().from('content_categories').select('id,name,icon,type,display_order,is_active').order('display_order').order('name');if(!admin)q=q.eq('is_active',true);return checked(await q)??[];}
export async function contents(type:ContentType,category?:string,offset=0,admin=false):Promise<DailyContent[]>{let q=db().from('daily_contents').select('*').eq('type',type).order('created_at',{ascending:false}).range(offset,offset+29);if(!admin)q=q.eq('is_active',true);if(category)q=q.eq('category_id',category);return checked(await q)??[];}
export async function saveContent(content:DailyContent){const {created_at,updated_at,...values}=content;checked(await db().from('daily_contents').upsert({...values,updated_at:new Date().toISOString()},{onConflict:'id'}));contentChanged();}
export async function deleteContent(id:string){checked(await db().from('daily_contents').delete().eq('id',id));contentChanged();}
export async function saveCategory(category:ContentCategory){checked(await db().from('content_categories').upsert(category));contentChanged();}
export async function deleteCategory(id:string){checked(await db().from('content_categories').delete().eq('id',id));contentChanged();}
export async function schedules():Promise<Schedule[]>{return checked(await db().from('daily_content_schedule').select('content_id,type,display_date').gte('display_date',localDate()).order('display_date'))??[];}
export async function scheduleContent(content:DailyContent,date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(`${date}T12:00:00`).toISOString().slice(0,10)!==date)throw new Error('Date invalide : utiliser AAAA-MM-JJ.');checked(await db().from('daily_content_schedule').upsert({content_id:content.id,type:content.type,display_date:date},{onConflict:'display_date,type'}));contentChanged();}
export async function removeSchedule(type:ContentType,date:string){checked(await db().from('daily_content_schedule').delete().eq('type',type).eq('display_date',date));contentChanged();}
const favoriteCache=new Map<string,{ids:string[];at:number}>(),favoriteRequests=new Map<string,Promise<string[]>>();
export async function favorites(userId?:string):Promise<string[]>{
 const key=userId??'guest',cached=favoriteCache.get(key);if(cached&&Date.now()-cached.at<30000)return cached.ids;
 const pending=favoriteRequests.get(key);if(pending)return pending;
 const request=(async()=>{const ids=userId?(checked(await db().from('content_favorites').select('content_id').eq('user_id',userId))??[]).map(x=>x.content_id):JSON.parse(await AsyncStorage.getItem('guest-content-favorites')??'[]');favoriteCache.set(key,{ids,at:Date.now()});return ids;})();
 favoriteRequests.set(key,request);try{return await request;}finally{favoriteRequests.delete(key);}
}
export async function setFavorite(id:string,enabled:boolean,userId?:string){const ids=await favorites(userId),next=enabled?[...new Set([...ids,id])]:ids.filter(x=>x!==id);if(!userId)await AsyncStorage.setItem('guest-content-favorites',JSON.stringify(next));else if(enabled)checked(await db().from('content_favorites').upsert({user_id:userId,content_id:id}));else checked(await db().from('content_favorites').delete().eq('user_id',userId).eq('content_id',id));favoriteCache.set(userId??'guest',{ids:next,at:Date.now()});}
export async function getContent(id:string):Promise<DailyContent|null>{return checked(await db().from('daily_contents').select('*').eq('id',id).maybeSingle());}

export async function favoriteContents(ids:string[],type:ContentType,category?:string,offset=0):Promise<DailyContent[]>{if(!ids.length)return [];let q=db().from('daily_contents').select('*').in('id',ids).eq('type',type).order('created_at',{ascending:false}).range(offset,offset+29);if(category)q=q.eq('category_id',category);return checked(await q)??[];}

export async function saveContentAndSchedule(content:DailyContent,date:string){checked(await db().rpc('save_daily_content',{p_content:content,p_date:date||null}));contentChanged();}
