import { Range, verseAt, verseId, verses, surahs } from './quran';

export const reciters = [
  {id:'ar.husary',name:'Mahmoud Khalil Al-Husary',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.alafasy',name:'Mishary Rashid Alafasy',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.minshawi',name:'Mohammed Siddiq Al-Minshawi',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.shaatree',name:'Abu Bakr Shatri',reading:'Hafs ‘an ‘Âsim',bitrate:128},
] as const;
export const defaultReciter=reciters[3];
export const DEFAULT_AYAH_GAP_MS=200;
export type Reciter=typeof reciters[number];
export type RepeatMode = 'passage' | 'each-verse';
export type RepeatCount = number | 'continuous';
export type AudioPosition = {verseId:number;repetition:number};
export type ChapterAudio={url:string;verses:Record<number,{start:number;end:number}>};
export function parseChapterAudio(file:any,chapter:number):ChapterAudio{
  if(!file?.audio_url?.startsWith('https://')||!Array.isArray(file.timestamps)||!surahs[chapter-1])throw new Error('Timestamps audio absents.');
  const timings:ChapterAudio['verses']={};let previous=0;
  for(const t of file.timestamps){
    const [s,a]=String(t.verse_key).split(':').map(Number),id=verseId(s,a);
    if(s!==chapter||id===null||timings[id]||!Number.isFinite(t.timestamp_from)||!Number.isFinite(t.timestamp_to)||t.timestamp_from<previous||t.timestamp_to<=t.timestamp_from)throw new Error('Timestamps audio invalides.');
    timings[id]={start:t.timestamp_from/1000,end:t.timestamp_to/1000};previous=t.timestamp_to;
  }
  if(Object.keys(timings).length!==surahs[chapter-1].count)throw new Error('Timestamps incomplets.');
  return {url:file.audio_url,verses:timings};
}
// Advance highlighting only. Never seek or replace the source between contiguous ayat.
export function continuousAudioPosition(timeline:ChapterAudio,range:Range,position:AudioPosition,time:number):AudioPosition{
  let id=position.verseId;
  while(id<range.end&&timeline.verses[id+1]&&time>=timeline.verses[id+1].start)id++;
  return {...position,verseId:id};
}

export function verseAudioUrl(id:number,reciter:Reciter=defaultReciter):string{
  if(!Number.isInteger(id)||id<1||id>verses.length)throw new Error('Verset audio invalide.');
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.id}/${id}.mp3`;
}

export type AudioSegment={url:string;startSeconds?:number;endSeconds?:number};
export async function resolveAudioSegment(id:number,reciter:Reciter):Promise<AudioSegment>{
  if(!Number.isInteger(id)||id<1||id>verses.length)throw new Error('Verset audio invalide.');
  return {url:verseAudioUrl(id,reciter)};
}

export function audioRange(start:number,end:number):Range{
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>verses.length||start>end)throw new Error('Choisis une plage de versets valide.');
  return {start,end};
}

export function nextAudioPosition(range:Range,current:AudioPosition,mode:RepeatMode,count:RepeatCount,autoStop=true):AudioPosition|null{
  audioRange(range.start,range.end);
  if(current.verseId<range.start||current.verseId>range.end||current.repetition<1)throw new Error('Position audio invalide.');
  const unlimited=count==='continuous'||!autoStop;
  const limit=count==='continuous'?1:Math.max(1,Math.floor(count));
  if(mode==='each-verse'){
    if(count==='continuous')return {verseId:current.verseId,repetition:current.repetition+1};
    if(current.repetition<limit)return {verseId:current.verseId,repetition:current.repetition+1};
    if(current.verseId<range.end)return {verseId:current.verseId+1,repetition:1};
    return unlimited?{verseId:range.start,repetition:1}:null;
  }
  if(current.verseId<range.end)return {verseId:current.verseId+1,repetition:current.repetition};
  if(unlimited||current.repetition<limit)return {verseId:range.start,repetition:current.repetition+1};
  return null;
}

export function verseAudioLabel(id:number):string{const v=verseAt(id);return `sourate ${v.surah}, verset ${v.ayah}`;}
