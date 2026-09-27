import AsyncStorage from '@react-native-async-storage/async-storage';
import {Reciter,parseChapterAudio,ChapterAudio} from '../core/audio';
export type {ChapterAudio} from '../core/audio';
import {verseAt} from '../core/quran';
const chapterIds:Record<string,number>={'ar.husary':6,'ar.alafasy':7,'ar.minshawi':9,'ar.shaatree':4};
const requests=new Map<string,Promise<ChapterAudio|null>>();
const unavailableUntil=new Map<string,number>();
export async function chapterAudio(id:number,reciter:Reciter):Promise<ChapterAudio|null>{
 const chapter=verseAt(id).surah,resource=chapterIds[reciter.id];if(!resource)return null;
 const key=`chapter-audio-v1:${resource}:${chapter}`;
 if((unavailableUntil.get(key)??0)>Date.now())return null;
 if(requests.has(key))return requests.get(key)!;
 const request=(async()=>{
  const cached=await AsyncStorage.getItem(key);if(cached)return JSON.parse(cached) as ChapterAudio;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(`https://api.quran.com/api/v4/chapter_recitations/${resource}/${chapter}?segments=true`,{signal:controller.signal});
   if(!response.ok)throw new Error(`Source audio : HTTP ${response.status}`);
   const file=(await response.json()).audio_file;
   const result=parseChapterAudio(file,chapter);await AsyncStorage.setItem(key,JSON.stringify(result));return result;
  }finally{clearTimeout(timeout);}
 })().catch(e=>{requests.delete(key);unavailableUntil.set(key,Date.now()+300000);console.warn('[Quran audio] Lecture continue indisponible, retour aux fichiers par verset.',e);return null;});requests.set(key,request);
 return request;
}

