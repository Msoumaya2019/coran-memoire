import tawjeedBounds from '../data/quran-tests/tawjeed_test_2-bounds.json';
import medineBounds from '../data/quran-tests/medine_test-bounds.json';
import tawjeedDimensions from '../data/quran-tests/tawjeed_test_2-dimensions.json';
import medineDimensions from '../data/quran-tests/medine_test-dimensions.json';
import {verseId} from './quran';
export type ZipSource='tawjeed_test_2'|'medine_test';
export const zipSources=[{id:'tawjeed_test_2',label:'Tawjeed test 2'},{id:'medine_test',label:'Medine Test'}] as const;
export const isZipSource=(source:string):source is ZipSource=>source==='tawjeed_test_2'||source==='medine_test';
export function zipPageData(source:ZipSource,page:number){
 const bounds=(source==='tawjeed_test_2'?tawjeedBounds:medineBounds) as Record<string,number[][]>;
 const dimensions=(source==='tawjeed_test_2'?tawjeedDimensions:medineDimensions) as Record<string,number[]>;
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
