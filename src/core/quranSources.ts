import sourceBounds from '../data/quran-tests/coran_1441-bounds.json';
import sourceDimensions from '../data/quran-tests/coran_1441-dimensions.json';
import {verseId} from './quran';
export type ZipSource='coran_1441';
export const zipSources=[{id:'coran_1441',label:'Coran 1441'}] as const;
export const isZipSource=(source:string):source is ZipSource=>source==='coran_1441';
export function zipPageData(source:ZipSource,page:number){
 const bounds=sourceBounds as Record<string,number[][]>;
 const dimensions=sourceDimensions as Record<string,number[]>;
 return {rows:bounds[page]??[],dimensions:dimensions[page]??[1,1]};
}
const indexes:Partial<Record<ZipSource,Map<number,number[]>>>={};
export function zipVersePages(source:ZipSource,id:number){
 if(!indexes[source]){const map=new Map<number,number[]>();for(let page=1;page<=604;page++)for(const row of zipPageData(source,page).rows){const id=verseId(row[0],row[1]);if(id!==null){const pages=map.get(id)??[];if(!pages.includes(page))pages.push(page);map.set(id,pages);}}indexes[source]=map;}
 return indexes[source]!.get(id)??[];
}
export function zipVersePage(source:ZipSource,id:number,current?:number){const pages=zipVersePages(source,id);return current&&pages.includes(current)?current:pages[0]??1;}
export function zipPageRange(source:ZipSource,page:number){const ids=zipPageData(source,page).rows.map(r=>verseId(r[0],r[1])).filter((id):id is number=>id!==null);return {start:Math.min(...ids),end:Math.max(...ids)};}

export function zipVerseRegions(source:ZipSource,page:number,id:number){
 const {rows,dimensions:[width,height]}=zipPageData(source,page);
 return rows.filter(r=>verseId(r[0],r[1])===id).map(r=>({line:r[2],x:r[3]/width,y:r[5]/height,width:(r[4]-r[3])/width,height:(r[6]-r[5])/height}));
}
