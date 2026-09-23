import {verseId} from './quran';
import tajweedTextRaw from '../data/tajweed-text.json';
import tajweedRulesRaw from '../data/tajweed-rules.json';
import translationRaw from '../data/translation-fr-rashid.json';

type TajweedRule={start:number;end:number;rule:string};
type TajweedRow={surah:number;ayah:number;annotations:TajweedRule[]};
type VerseText={surah:number;ayah:number;text:string};
type FrenchVerse={surah:number;ayah:number;translation:string;footnotes:string};
const tajweedText=tajweedTextRaw as VerseText[];
const tajweedRules=tajweedRulesRaw as TajweedRow[];
const french=translationRaw as FrenchVerse[];

export function frenchVerse(id:number):FrenchVerse|undefined{return french[id-1];}
export function tajweedVerse(id:number):{text:string;annotations:TajweedRule[]}|undefined{
  const row=tajweedText[id-1],rules=tajweedRules[id-1];
  if(!row||!rules||row.surah!==rules.surah||row.ayah!==rules.ayah)return undefined;
  return {text:row.text,annotations:rules.annotations};
}
export function tajweedColor(rule:string):string{
  if(rule.startsWith('madd'))return '#B45375';
  if(rule.startsWith('ikhfa')||rule==='iqlab')return '#3A779B';
  if(rule.startsWith('idghaam')||rule==='ghunnah')return '#6F5FA5';
  if(rule==='qalqalah')return '#B05E32';
  if(rule==='silent')return '#A2A2A2';
  return '#A26C44';
}
export type TajweedSpan={text:string;rule:string|null};
export function tajweedSpans(id:number):TajweedSpan[]{
  const verse=tajweedVerse(id);if(!verse)return [];
  const chars=[...verse.text],rules:(string|null)[]=Array(chars.length).fill(null);
  for(const annotation of verse.annotations)for(let i=annotation.start;i<annotation.end;i++)rules[i]=annotation.rule;
  const spans:TajweedSpan[]=[];
  for(let i=0;i<chars.length;i++){
    const previous=spans.at(-1);
    if(previous?.rule===rules[i])previous.text+=chars[i];
    else spans.push({text:chars[i],rule:rules[i]});
  }
  return spans;
}

export function verseAtImagePoint(rows:number[][],x:number,y:number,width:number,height:number):number|null{
  if(width<=0||height<=0||x<0||y<0||x>width||y>height)return null;
  const sourceX=x/width*1920,sourceY=y/height*3106;
  const matches=rows.filter(row=>sourceX>=row[3]&&sourceX<=row[4]&&sourceY>=row[5]&&sourceY<=row[6]);
  if(!matches.length)return null;
  const row=matches.sort((a,b)=>(a[4]-a[3])*(a[6]-a[5])-(b[4]-b[3])*(b[6]-b[5]))[0];
  return verseId(row[0],row[1]);
}
