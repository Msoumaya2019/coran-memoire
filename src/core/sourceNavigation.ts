import {pageOf,pageRange} from './quran';
import {testVersePage,testPageRange} from '../coranTest/model';
import {isZipSource,zipVersePage,zipPageRange} from './quranSources';
export const sourceVersePage=(source:string,id:number,current?:number)=>source==='coranTest'?testVersePage(id,current):isZipSource(source)?zipVersePage(source,id,current):pageOf(id);
export const sourcePageRange=(source:string,page:number)=>source==='coranTest'?testPageRange(page):isZipSource(source)?zipPageRange(source,page):pageRange(page);
