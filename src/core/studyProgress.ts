import {AppState,StudyProgress,completeSession,markKnowledge,touch,addDays,todayLocal} from './program';
import {gradeReviewTask,ReviewTask} from './review';
import {Range,pageOf,pageRange,surahs,verseAt,reference} from './quran';
import {testVersePage,testPageRange,verseIndex} from '../coranTest/model';
export type StudyMode='learning'|'revision';
export const studyKey=(mode:StudyMode,id:string)=>`${mode}:${id}`;
export const studyPage=(id:number,source:string)=>source==='coranTest'?testVersePage(id):pageOf(id);
export const studyPageRange=(page:number,source:string)=>source==='coranTest'?testPageRange(page):pageRange(page);
export const studyLastPage=(id:number,source:string)=>{const v=verseAt(id);return source==='coranTest'?verseIndex[`${v.surah}:${v.ayah}`].pages.at(-1)!:pageOf(id);};
export function studyEndpointForPage(page:number,range:Range,source:string){let id=Math.min(range.end,studyPageRange(page,source).end);while(id>=range.start&&studyLastPage(id,source)>page)id--;return id;}
export function studyMetrics(range:Range,through:number,source:string){
 const first=studyPage(range.start,source),last=studyLastPage(range.end,source),pages=last>first;
 const pageList=Array.from({length:last-first+1},(_,i)=>first+i);
 const total=pages?pageList.length:range.end-range.start+1;
 const done=pages?pageList.filter(p=>Math.min(range.end,studyPageRange(p,source).end)<=through).length:Math.max(0,Math.min(total,through-range.start+1));
 const ratio=pages?pageList.reduce((n,p)=>{const r=studyPageRange(p,source),start=Math.max(range.start,r.start),end=Math.min(range.end,r.end);return n+Math.max(0,Math.min(1,(through-start+1)/(end-start+1)));},0)/total:Math.max(0,Math.min(1,(through-range.start+1)/(range.end-range.start+1)));
 return {first,last,pages,pageList,total,done,remaining:total-done,ratio,unit:pages?'pages':'versets',label:pages?`Pages ${first} à ${last}`:reference(range)};
}
export function studyRangeLabel(range:Range){const a=verseAt(range.start),b=verseAt(range.end);return a.surah===b.surah?`${a.ayah} → ${b.ayah}`:`${a.surah}:${a.ayah} → ${b.surah}:${b.ayah}`;}
export function studySurahs(range:Range){return surahs.filter(s=>s.end>=range.start&&s.start<=range.end);}
export function studyVerses(range:Range,surah:number){const s=surahs[surah-1];if(!s)return [];const first=Math.max(s.start,range.start),last=Math.min(s.end,range.end);return Array.from({length:Math.max(0,last-first+1)},(_,i)=>first+i);}
export function remainingStudyRange(range:Range,record?:StudyProgress):Range|null{const start=Math.max(range.start,(record?.through??range.start-1)+1);return start<=range.end?{start,end:range.end}:null;}
export function validateStudyProgress(state:AppState,mode:StudyMode,id:string,range:Range,through:number,source:string,category:ReviewTask['category']='habitual',grade:'perfect'|'hesitant'|'rework'='perfect',at=todayLocal()):AppState{
 const key=studyKey(mode,id),old=state.studyProgress?.[key];
 // An explicit endpoint is mandatory; rejecting invalid or stale input never advances progress.
 if(!Number.isInteger(through)||through<range.start||through>range.end||old&& (old.start!==range.start||old.end!==range.end))return state;
 const start=Math.max(range.start,(old?.through??range.start-1)+1);if(through<start)return state;
 let next=state;
 if(mode==='learning'){
  const session=state.sessions.find(s=>s.id===id);if(!session||session.start!==range.start||session.end!==range.end||session.status==='done')return state;
  if(through===range.end){next=completeSession(state,id,true,at);if(old){const wholeId=`r-${range.start}-${range.end}`;const revisions=next.revisions.filter(r=>r.id!==wholeId||state.revisions.some(prior=>prior.id===wholeId));const remainderId=`r-${start}-${through}`;if(!revisions.some(r=>r.id===remainderId))revisions.push({id:remainderId,start,end:through,due:addDays(at,1),interval:1,streak:0,completedCount:0});next={...next,revisions};}}
  else {const memorizedAt={...state.memorizedAt};for(let id=start;id<=through;id++)if(state.knowledge[id]!=='perfect'&&state.knowledge[id]!=='review'&&!memorizedAt[id])memorizedAt[id]=at;next=markKnowledge({...state,memorizedAt},{start,end:through},'perfect');const revisionId=`r-${start}-${through}`;if(!next.revisions.some(r=>r.id===revisionId))next={...next,revisions:[...next.revisions,{id:revisionId,start,end:through,due:addDays(at,1),interval:1,streak:0,completedCount:0}]};}
 }else next=gradeReviewTask(state,{id,start,end:through,category,label:'Versets'},grade,at);
 const record:StudyProgress={id,mode,...range,category:mode==='revision'?category:undefined,through,page:studyPage(through,source),source,updatedAt:new Date().toISOString(),status:through===range.end?'completed':'partial',validations:[...(old?.validations??[]),{start,end:through,date:at,validatedAt:new Date().toISOString()}]};
 return touch({...next,studyProgress:{...next.studyProgress,[key]:record}});
}
export function resumeStudyTask(record:StudyProgress):ReviewTask{return {id:record.id,start:record.through+1,end:record.end,category:record.category??'habitual',label:'Versets'};}
