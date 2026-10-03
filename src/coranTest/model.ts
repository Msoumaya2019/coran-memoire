import indexRaw from './data/verse-index.json';
import {verseId,verseAt} from '../core/quran';
import {nextAudioPosition,resolveAudioSegment,defaultReciter,Reciter,AudioPosition,RepeatCount,RepeatMode} from '../core/audio';
import {Range} from '../core/quran';

export type VerseKey=`${number}:${number}`;
export type TestWord=[id:number,surah:number,ayah:number,word:number,glyphs:string,arabic:string];
export type TestLine={line:number;type:'ayah'|'surah_name'|'basmallah';centered:boolean;surah:number|null;words:TestWord[]};
export type TestPage={page:number;surah:number;juz:number;fontSize:number;lines:TestLine[]};
export type NormalizedRegion={x:number;y:number;width:number;height:number;line:number};
export type MeasuredWord={id:number;key:VerseKey;region:NormalizedRegion};
export const originalPageWidth=1000,originalPageHeight=2120;
export const verseIndex=indexRaw as Record<VerseKey,{id:number;pages:number[];lines:number[][]}>;
const pageRanges:Record<number,Range>={};
for(const item of Object.values(verseIndex))for(const page of item.pages){const range=pageRanges[page];if(range){range.start=Math.min(range.start,item.id);range.end=Math.max(range.end,item.id);}else pageRanges[page]={start:item.id,end:item.id};}
export function testPageRange(page:number):Range{if(!pageRanges[page])throw new Error('Page invalide.');return {...pageRanges[page]};}
export const validTestPage=(page:number)=>Number.isInteger(page)&&page>=1&&page<=604;
export const adjacentTestPages=(page:number)=>[page-1,page,page+1].filter(validTestPage);

export type ReaderOverlayState={sessionThrough?:number;sessionDone?:number;sessionColor?:string;study?:{title:string;unit:string;range:string;ratio:number;primary:string;background:string};background?:string;enabled:boolean;selecting:boolean;playing:VerseKey|null;selected:VerseKey|null;bookmarks:VerseKey[];difficulty:VerseKey[];session:VerseKey[];primary:string;selection:string;gold:string};
const keyOf=(id:number):VerseKey=>{const verse=verseAt(id);return `${verse.surah}:${verse.ayah}`;};
export function readerOverlayState({playingVerseId,selectedVerseId,bookmarkIds=[],difficultyIds=[],sessionRange,sessionThrough=0,sessionColor,showSession=false,selecting=false,primary,selection,gold}:{playingVerseId:number|null;selectedVerseId?:number|null;bookmarkIds?:number[];difficultyIds?:number[];sessionRange:Range;sessionThrough?:number;sessionColor?:string;showSession?:boolean;selecting?:boolean;primary:string;selection:string;gold:string}):ReaderOverlayState{
 return {sessionThrough,sessionDone:Math.max(0,Math.min(sessionRange.end,sessionThrough)-sessionRange.start+1),sessionColor,enabled:true,selecting,playing:playingVerseId===null?null:keyOf(playingVerseId),selected:selectedVerseId==null?null:keyOf(selectedVerseId),bookmarks:bookmarkIds.map(keyOf),difficulty:difficultyIds.map(keyOf),session:showSession?Array.from({length:sessionRange.end-sessionRange.start+1},(_,i)=>keyOf(sessionRange.start+i)):[],primary,selection,gold};
}
export function testVersePage(id:number,currentPage?:number){const pages=verseIndex[keyOf(id)]?.pages;if(!pages?.length)throw new Error('Verset introuvable dans le Mushaf.');return currentPage!==undefined&&pages.includes(currentPage)?currentPage:pages[0];}

/** Original metadata supplies lines/words, not pixel rectangles. Measurements are
 * produced by the same browser layout that paints the page, never guessed. */
export function verseRegions(words:MeasuredWord[]):Partial<Record<VerseKey,NormalizedRegion[]>>{
  const result:Partial<Record<VerseKey,NormalizedRegion[]>>={};
  for(const word of words){
    const r=word.region;
    if(!verseIndex[word.key]||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0)continue;
    const regions=result[word.key]??(result[word.key]=[]);
    const same=regions.find(x=>x.line===r.line);
    if(same){const right=Math.max(same.x+same.width,r.x+r.width),bottom=Math.max(same.y+same.height,r.y+r.height);same.x=Math.min(same.x,r.x);same.y=Math.min(same.y,r.y);same.width=right-same.x;same.height=bottom-same.y;}
    else regions.push({...r});
  }
  return result;
}

export type TestPlaybackState={currentVerse:VerseKey|null;position:AudioPosition|null;isPlaying:boolean};
export const emptyPlaybackState=():TestPlaybackState=>({currentVerse:null,position:null,isPlaying:false});
/** Adapter only: the existing player will own native playback, cancellation,
 * buffering and audio focus when enabled. No second native player is created. */
export const testAudioAdapter={
  resolve:(key:VerseKey,reciter:Reciter=defaultReciter)=>{
    const [surah,ayah]=key.split(':').map(Number),id=verseId(surah,ayah);
    if(id===null)throw new Error('Verset inconnu.');
    return resolveAudioSegment(id,reciter);
  },
  next:(range:Range,position:AudioPosition,mode:RepeatMode,count:RepeatCount)=>nextAudioPosition(range,position,mode,count),
};
