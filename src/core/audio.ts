import { Range, verseAt, verses } from './quran';

export const reciters = [
  {id:'ar.husary',name:'Mahmoud Khalil Al-Husary',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.alafasy',name:'Mishary Rashid Alafasy',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.minshawi',name:'Mohammed Siddiq Al-Minshawi',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'mp3quran.saad',name:'Saad Al-Ghamdi',reading:'Hafs ‘an ‘Âsim',readId:30,folderUrl:'https://server7.mp3quran.net/s_gmd/'},
  {id:'mp3quran.johayni',name:'Abdullah Al-Johany',reading:'Hafs ‘an ‘Âsim',readId:62,folderUrl:'https://server13.mp3quran.net/jhn/'},
  {id:'ar.mahermuaiqly',name:'Maher Al-Muaiqly',reading:'Hafs ‘an ‘Âsim',bitrate:128},
] as const;
export type Reciter=typeof reciters[number];
export type RepeatMode = 'passage' | 'each-verse';
export type RepeatCount = number | 'continuous';
export type AudioPosition = {verseId:number;repetition:number};

export function verseAudioUrl(id:number,reciter:Reciter=reciters[0]):string{
  if(!Number.isInteger(id)||id<1||id>verses.length)throw new Error('Verset audio invalide.');
  if(!('bitrate' in reciter))throw new Error('Cette récitation utilise les repères temporels des versets.');
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.id}/${id}.mp3`;
}

export type AudioSegment={url:string;startSeconds?:number;endSeconds?:number};
type Timing={ayah:number;start_time:number;end_time:number};
const timingCache=new Map<string,Promise<Timing[]>>();
export async function resolveAudioSegment(id:number,reciter:Reciter):Promise<AudioSegment>{
  if(!Number.isInteger(id)||id<1||id>verses.length)throw new Error('Verset audio invalide.');
  if('bitrate' in reciter)return {url:verseAudioUrl(id,reciter)};
  const verse=verseAt(id),key=`${reciter.readId}:${verse.surah}`;
  if(!timingCache.has(key))timingCache.set(key,fetch(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${verse.surah}&read=${reciter.readId}`)
    .then(async response=>{if(!response.ok)throw new Error('Les repères audio sont indisponibles.');return await response.json() as Timing[];})
    .catch(error=>{timingCache.delete(key);throw error;}));
  const timings=await timingCache.get(key)!;
  const timing=Array.isArray(timings)?timings.find(item=>item.ayah===verse.ayah):undefined;
  if(!timing||!Number.isFinite(timing.start_time)||!Number.isFinite(timing.end_time)||timing.end_time<=timing.start_time)
    throw new Error(`Le repère audio de la sourate ${verse.surah}, verset ${verse.ayah}, n’est pas disponible pour ce récitateur.`);
  return {url:`${reciter.folderUrl}${String(verse.surah).padStart(3,'0')}.mp3`,startSeconds:timing.start_time/1000,endSeconds:timing.end_time/1000};
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
    if(current.repetition<limit)return {verseId:current.verseId,repetition:current.repetition+1};
    if(current.verseId<range.end)return {verseId:current.verseId+1,repetition:1};
    return unlimited?{verseId:range.start,repetition:1}:null;
  }
  if(current.verseId<range.end)return {verseId:current.verseId+1,repetition:current.repetition};
  if(unlimited||current.repetition<limit)return {verseId:range.start,repetition:current.repetition+1};
  return null;
}

export function verseAudioLabel(id:number):string{const v=verseAt(id);return `sourate ${v.surah}, verset ${v.ayah}`;}
