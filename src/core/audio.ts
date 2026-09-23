import { Range, verseAt, verses } from './quran';

export const reciters = [
  {id:'ar.husary',name:'Mahmoud Khalil Al-Husary',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.alafasy',name:'Mishary Rashid Alafasy',reading:'Hafs ‘an ‘Âsim',bitrate:128},
  {id:'ar.minshawi',name:'Mohammed Siddiq Al-Minshawi',reading:'Hafs ‘an ‘Âsim',bitrate:128},
] as const;
export type Reciter=typeof reciters[number];
export type RepeatMode = 'passage' | 'each-verse';
export type RepeatCount = number | 'continuous';
export type AudioPosition = {verseId:number;repetition:number};

export function verseAudioUrl(id:number,reciter:Reciter=reciters[0]):string{
  if(!Number.isInteger(id)||id<1||id>verses.length)throw new Error('Verset audio invalide.');
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.id}/${id}.mp3`;
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

export function verseAudioLabel(id:number):string{const v=verseAt(id);return `${v.surah}:${v.ayah}`;}
