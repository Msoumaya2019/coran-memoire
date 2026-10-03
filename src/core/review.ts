import {AppState, addDays, Consolidation, memorizedIds, ReviewCycle, ReviewEvent, ReviewGrade, todayLocal, touch} from './program';
import {halves, hizbs, juzs, pageOf, pageRange, quarters, Range, surahAt, volume} from './quran';

export type ReviewCategory='recent'|'habitual'|'priority';
export type ReviewTask=Range&{id:string;scheduledDate?:string;category:ReviewCategory;label:string};
export const consolidationOffsets=[1,3,7] as const;
export type ConsolidationRow=Range&{learnedAt:string;steps:{offset:1|3|7;due:string;completed?:string}[]};
export type ReviewPlan={recent:ReviewTask[];habitual:ReviewTask[];priority:ReviewTask[];session:ReviewTask[];completeJuz:number;completeRub:number;completeNisf:number;cycle?:ReviewCycle;cycleDay:number;rework:ReviewTask[];consolidations:ConsolidationRow[]};
export const reviewsEnabled=(state:AppState)=>state.reviewSettings?.enabled!==false;
export const reviewCycleDays=(state:AppState)=>state.reviewSettings?.cycleDays??7;
const known=(state:AppState,id:number)=>state.knowledge[id]==='perfect'||state.knowledge[id]==='review';
const age=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
const idsOf=(tasks:Range[])=>tasks.flatMap(t=>Array.from({length:t.end-t.start+1},(_,i)=>t.start+i));
const full=(set:Set<number>,r:Range)=>{for(let id=r.start;id<=r.end;id++)if(!set.has(id))return false;return true;};
// Fractions of actual pages, weighted by their Arabic text volume. A short verse
// and a long verse do not count as equal workloads, and no verse is ever split.
const pageVolumes=new Map<number,number>();
export function reviewWeight(id:number):number {
  const page=pageOf(id);let size=pageVolumes.get(page);
  if(size===undefined){const r=pageRange(page);size=volume(Array.from({length:r.end-r.start+1},(_,i)=>r.start+i));pageVolumes.set(page,size);}
  return volume([id])/Math.max(1,size);
}
export function partitionReviewCorpus(corpus:number[],length:number):number[][] {
  const ordered=[...new Set(corpus)].sort((a,b)=>a-b),prefix=[0],set=new Set(ordered);
  // Exact whole-unit division takes precedence (e.g. 7 Hizb / 14 = 1 Nisf).
  for(const units of [hizbs,halves,quarters]){const complete=units.filter(r=>full(set,r));if(complete.length>=length&&complete.length%length===0&&idsOf(complete).length===ordered.length){const count=complete.length/length;return Array.from({length},(_,day)=>idsOf(complete.slice(day*count,(day+1)*count)));}}
  for(const id of ordered)prefix.push(prefix[prefix.length-1]+reviewWeight(id));
  const days:number[][]=[],total=prefix[ordered.length];let cursor=0;
  const boundaries=[hizbs,halves,quarters].map(units=>new Set(units.map(r=>r.end)));
  const boundaryIndexes=boundaries.map(ends=>ordered.flatMap((id,i)=>ends.has(id)?[i+1]:[]));
  for(let day=1;day<=length;day++){
    let end=cursor;
    if(day===length)end=ordered.length;
    else {
      const target=total*day/length;
      while(end<ordered.length&&prefix[end+1]<=target)end++;
      if(end<ordered.length&&Math.abs(prefix[end+1]-target)<Math.abs(prefix[end]-target))end++;
    }
    // Prefer a genuine Quran division when it remains near the balanced target.
    if(day<length)for(const indexes of boundaryIndexes){
      const candidates=indexes.filter(i=>i>cursor&&Math.abs(prefix[i]-total*day/length)<=total/length*.15);
      if(candidates.length){end=candidates.reduce((a,b)=>Math.abs(prefix[a]-total*day/length)<Math.abs(prefix[b]-total*day/length)?a:b);break;}
    }
    days.push(ordered.slice(cursor,end));cursor=end;
  }
  return days;
}
function createCycle(state:AppState,at:string,index:number):ReviewCycle {
  // Learning during a cycle remains in consolidation until the next snapshot.
  const corpus=memorizedIds(state).filter(id=>{const learned=state.memorizedAt?.[id];if(!learned)return true;const established=learned<(state.reviewModelStartedAt??at)&&age(learned,state.reviewModelStartedAt??at)>=7;return established||!!state.reviewConsolidations?.[id]?.completed[7];}).sort((a,b)=>a-b);
  const result={index,startDate:at,lengthDays:reviewCycleDays(state) as number,corpus,days:state.reviewSettings?.mode==='quantity'?partitionDailyQuantity(corpus,state.reviewSettings.dailyQuantity??'hizb'):partitionReviewCorpus(corpus,reviewCycleDays(state)),completed:[],assignments:{}};if(state.reviewSettings?.mode==='quantity')result.lengthDays=Math.max(1,result.days.length);return result;
}
export function setReviewsEnabled(state:AppState,enabled:boolean,at=todayLocal()):AppState {
  if(reviewsEnabled(state)===enabled)return state;
  return touch({...state,reviewSettings:{...state.reviewSettings,enabled,cycleDays:reviewCycleDays(state),...(enabled?{resumedAt:at}:{})}});
}
export function setReviewCycle(state:AppState,cycleDays:7|14|21|30,at=todayLocal()):AppState {
  if(reviewCycleDays(state)===cycleDays&&state.reviewSettings?.mode!=='quantity')return state;
  const next={...state,reviewSettings:{...state.reviewSettings,enabled:reviewsEnabled(state),cycleDays,mode:'cycle' as const}};
  return touch({...next,reviewCycleHistory:state.reviewCycle?[...(state.reviewCycleHistory??[]),state.reviewCycle]:state.reviewCycleHistory,reviewCycle:createCycle(next,at,(state.reviewCycle?.index??0)+1)});
}
export function toggleDifficulty(state:AppState,id:number,at=todayLocal()):AppState {
  if(id<1||id>6236)return state;
  const markers={...state.difficultyMarkers},current={...markers[id]},due={...state.reviewPriorityDue};
  const action=current.user?'resolved':'marked';
  if(current.user){delete current.user;delete due[id];}else {current.user={createdAt:at};due[id]=at;}
  if(current.user||current.admin)markers[id]=current;else delete markers[id];
  return touch({...state,difficultyMarkers:markers,reviewPriorityDue:due,difficultyHistory:[...(state.difficultyHistory??[]),{verseId:id,date:at,origin:'user',action}]});
}
function consolidationFor(state:AppState,id:number):Consolidation|undefined {
  const learnedAt=state.memorizedAt?.[id];if(!learnedAt)return;
  const stored=state.reviewConsolidations?.[id];if(stored?.learnedAt===learnedAt)return stored.scheduledDates?stored:{...stored,scheduledDates:{1:addDays(learnedAt,1),3:addDays(learnedAt,3),7:addDays(learnedAt,7)}};
  // Migrate from real historical reviews only. No missed checkpoint is invented.
  const completed:Consolidation['completed']={};let previous='';
  const events=(state.reviewHistory??[]).filter(e=>e.start<=id&&e.end>=id&&e.date>=learnedAt).sort((a,b)=>a.date.localeCompare(b.date));
  for(const offset of consolidationOffsets){const event=events.find(e=>e.date>=addDays(learnedAt,offset)&&e.date>previous);if(!event)break;completed[offset]=event.date;previous=event.date;}
  return {learnedAt,scheduledDates:{1:addDays(learnedAt,1),3:addDays(learnedAt,3),7:addDays(learnedAt,7)},completed};
}
export function prepareReviewSchedule(state:AppState,at=todayLocal()):AppState {
  if(!reviewsEnabled(state))return state;
  let cycle=state.reviewCycle,changed=!state.reviewModelStartedAt;
  if(!cycle||(state.reviewSettings?.mode!=='quantity'&&cycle.lengthDays!==reviewCycleDays(state))){cycle=createCycle(state,at,(cycle?.index??0)+1);changed=true;}
  const completed=new Set(cycle.completed);
  const finished=cycle.corpus.every(id=>completed.has(id)||!known(state,id));
  if(finished&&at>=addDays(cycle.startDate,cycle.lengthDays)) {cycle=createCycle(state,at,cycle.index+1);changed=true;}
  if(cycle.assignments[at]===undefined){
    const done=new Set(cycle.completed);
    // One original daily share at most. Missed days extend the cycle, rather
    // than dumping all overdue verses into the next session.
    const index=cycle.days.findIndex((day,i)=>addDays(cycle!.startDate,i)<=at&&day.some(id=>known(state,id)&&!done.has(id)));
    cycle={...cycle,assignments:{...cycle.assignments,[at]:index}};changed=true;
  }
  const consolidations={...state.reviewConsolidations};
  for(const id of memorizedIds(state)){const c=consolidationFor(state,id);if(c&&consolidations[id]!==c){consolidations[id]=c;changed=true;}}
  return changed?touch({...state,reviewModelStartedAt:state.reviewModelStartedAt??at,reviewCycleHistory:cycle?.index!==state.reviewCycle?.index&&state.reviewCycle?[...(state.reviewCycleHistory??[]),state.reviewCycle]:state.reviewCycleHistory,reviewCycle:cycle,reviewConsolidations:consolidations}):state;
}
function grouped(ids:number[],category:ReviewCategory):ReviewTask[] {
  const tasks:ReviewTask[]=[];
  for(const id of [...new Set(ids)].sort((a,b)=>a-b)){
    const last=tasks[tasks.length-1];
    if(last&&last.end+1===id&&surahAt(last.start).number===surahAt(id).number){last.end=id;last.id=`${category}-${last.start}-${id}`;}
    else tasks.push({id:`${category}-${id}-${id}`,start:id,end:id,category,label:'Versets'});
  }
  return tasks;
}
export function reviewQuantity(input:Range[]|number[]):string {
  const ids=[...new Set(input.length&&typeof input[0]==='number'?input as number[]:idsOf(input as Range[]))].sort((a,b)=>a-b),set=new Set(ids);
  if(!ids.length)return '0 verset';
  for(const [units,label] of [[hizbs,'Hizb'],[halves,'Nisf'],[quarters,'Rubu’']] as const){const matched=units.filter(r=>full(set,r));if(matched.reduce((n,r)=>n+r.end-r.start+1,0)===ids.length)return `${matched.length} ${label}`;}
  const selectedPages=[...new Set(ids.map(pageOf))];
  if(selectedPages.every(page=>full(set,pageRange(page))))return `${selectedPages.length} page${selectedPages.length===1?'':'s'}`;
  const equivalent=ids.reduce((n,id)=>n+reviewWeight(id),0);
  if(equivalent>=1.5)return `≈ ${Math.round(equivalent)} pages`;
  return `${ids.length} verset${ids.length===1?'':'s'}`;
}
export function reviewPlan(original:AppState,at=todayLocal()):ReviewPlan {
  const state=prepareReviewSchedule(original,at),all=memorizedIds(state).sort((a,b)=>a-b),set=new Set(all),cycle=state.reviewCycle??undefined;
  const base={completeJuz:juzs.filter(r=>full(set,r)).length,completeRub:quarters.filter(r=>full(set,r)).length,completeNisf:halves.filter(r=>full(set,r)).length,cycle,cycleDay:cycle?Math.min(cycle.lengthDays,Math.max(1,age(cycle.startDate,at)+1)):0};
  if(!reviewsEnabled(state))return {...base,recent:[],habitual:[],priority:[],session:[],rework:[],consolidations:[]};
  const today=new Set(idsOf((state.reviewHistory??[]).filter(e=>e.date===at)));
  const recentIds:number[]=[],rows:ConsolidationRow[]=[];
  for(const id of all){
    const c=state.reviewConsolidations?.[id];if(!c||c.learnedAt!==state.memorizedAt?.[id]||c.completed[7])continue;
    const steps=consolidationOffsets.map(offset=>({offset,due:c.scheduledDates?.[offset]??addDays(c.learnedAt,offset),completed:c.completed[offset]}));
    const pending=steps.find(s=>!s.completed);if(pending&&pending.due<=at&&!today.has(id))recentIds.push(id);
    const last=rows[rows.length-1];
    if(last&&last.end+1===id&&surahAt(last.start).number===surahAt(id).number&&last.learnedAt===c.learnedAt&&JSON.stringify(last.steps)===JSON.stringify(steps))last.end=id;
    else rows.push({start:id,end:id,learnedAt:c.learnedAt,steps});
  }
  const priorityIds=all.filter(id=>(state.difficultyMarkers?.[id]?.user||state.difficultyMarkers?.[id]?.admin)&&(state.reviewPriorityDue?.[id]??at)<=at&&!today.has(id));
  const done=new Set(cycle?.completed??[]),index=cycle?.assignments[at]??-1;
  const habitualIds=(cycle?.days[index]??[]).filter(id=>known(state,id)&&!done.has(id)&&!today.has(id));
  const recent=rows.flatMap(row=>grouped(idsOf([row]).filter(id=>recentIds.includes(id)),'recent').map(task=>({...task,scheduledDate:row.steps.find(step=>!step.completed)?.due}))),priority=grouped(priorityIds,'priority').map(task=>({...task,scheduledDate:state.reviewPriorityDue?.[task.start]??at})),habitual=grouped(habitualIds,'habitual').map(task=>({...task,scheduledDate:cycle&&index>=0?addDays(cycle.startDate,index):at})),seen=new Set<number>();
  const partials:ReviewTask[]=Object.values(state.studyProgress??{}).filter(r=>r.mode==='revision'&&r.status==='partial').flatMap(r=>{const pending=grouped(Array.from({length:r.end-r.through},(_,i)=>r.through+i+1).filter(id=>known(state,id)),r.category??'habitual');return pending.map(t=>({...t,id:r.id}));});
  const session=[...partials,...recent,...priority,...habitual].flatMap(task=>grouped(idsOf([task]).filter(id=>{if(seen.has(id))return false;seen.add(id);return true;}),task.category).map(t=>({...t,scheduledDate:task.scheduledDate,id:partials.includes(task)?task.id:t.id})));
  return {...base,recent,priority,habitual,session,rework:grouped(all.filter(id=>!!(state.difficultyMarkers?.[id]?.user||state.difficultyMarkers?.[id]?.admin)),'priority'),consolidations:rows};
}
export function gradeReviewTask(original:AppState,task:ReviewTask,grade:ReviewGrade,at=todayLocal()):AppState {
  if(!reviewsEnabled(original))return original;
  const state=prepareReviewSchedule(original,at);
  const reviewed=new Set(idsOf((state.reviewHistory??[]).filter(e=>e.date===at)));
  const ids=idsOf([task]).filter(id=>known(state,id)&&!reviewed.has(id));if(!ids.length)return state;
  const event:ReviewEvent={id:`${at}-${task.category}-${task.start}-${task.end}-${Date.now()}`,date:at,scheduledDate:task.scheduledDate??at,completedAt:new Date().toISOString(),start:task.start,end:task.end,category:task.category,grade};
  const markers={...state.difficultyMarkers},due={...state.reviewPriorityDue},history=[...(state.difficultyHistory??[])],consolidations={...state.reviewConsolidations},cycle=state.reviewCycle;
  const completed=new Set(cycle?.completed??[]),assigned=new Set(cycle?.days[cycle.assignments[at]]??[]);
  for(const id of ids){
    // Overlap is performed once and credited to each due mechanism.
    if(assigned.has(id)||(task.category==='habitual'&&cycle?.corpus.includes(id)))completed.add(id);
    const c=consolidations[id];
    if(c){const offset=consolidationOffsets.find(o=>!c.completed[o]);if(offset&&addDays(c.learnedAt,offset)<=at)consolidations[id]={...c,completed:{...c.completed,[offset]:at},completedAt:{...c.completedAt,[offset]:new Date().toISOString()}};}
    if(grade!=='perfect'){
      if(!markers[id]?.user){markers[id]={...markers[id],user:{createdAt:at}};history.push({verseId:id,date:at,origin:'user',action:'marked'});}
      due[id]=addDays(at,grade==='rework'?1:2);
    }else {
      if(markers[id]?.user||markers[id]?.admin)due[id]=addDays(at,reviewCycleDays(state));else delete due[id];
    }
  }
  return touch({...state,reviewCycle:cycle?{...cycle,completed:[...completed].sort((a,b)=>a-b)}:cycle,reviewConsolidations:consolidations,reviewPriorityDue:due,difficultyMarkers:markers,difficultyHistory:history,reviewHistory:[...(state.reviewHistory??[]),event]});
}
export function reviewRhythm(cycle:ReviewCycle):string {
 const set=new Set(cycle.corpus);
 for(const [units,label] of [[hizbs,'Hizb'],[halves,'Nisf'],[quarters,'Rubu’']] as const){
  const count=units.filter(r=>full(set,r)).length;
  if(count&&units.filter(r=>full(set,r)).reduce((n,r)=>n+r.end-r.start+1,0)===cycle.corpus.length&&count%cycle.lengthDays===0)return `${count/cycle.lengthDays} ${label} / jour`;
 }
 const pages=cycle.corpus.reduce((n,id)=>n+reviewWeight(id),0)/cycle.lengthDays;
 return pages>=1?`≈ ${pages.toLocaleString('fr-FR',{maximumFractionDigits:1})} pages / jour`:`≈ ${(cycle.corpus.length/cycle.lengthDays).toLocaleString('fr-FR',{maximumFractionDigits:1})} versets / jour`;
}

/** Daily quantities follow real Quran divisions; unknown gaps are never scheduled. */
export function partitionDailyQuantity(corpus:number[],quantity:'nisf'|'hizb'|'juz'|'juz2'):number[][] {
 const units=quantity==='nisf'?halves:quantity==='hizb'?hizbs:juzs;
 const groups=units.map(r=>corpus.filter(id=>id>=r.start&&id<=r.end)).filter(ids=>ids.length);
 return quantity==='juz2'?groups.reduce<number[][]>((out,ids,i)=>{if(i%2)out[out.length-1].push(...ids);else out.push([...ids]);return out;},[]):groups;
}
export function setReviewQuantity(state:AppState,quantity:'nisf'|'hizb'|'juz'|'juz2',at=todayLocal()):AppState {
 const next={...state,reviewSettings:{...state.reviewSettings,enabled:reviewsEnabled(state),cycleDays:reviewCycleDays(state),mode:'quantity' as const,dailyQuantity:quantity}};
 return touch({...next,reviewCycleHistory:state.reviewCycle?[...(state.reviewCycleHistory??[]),state.reviewCycle]:state.reviewCycleHistory,reviewCycle:createCycle(next,at,(state.reviewCycle?.index??0)+1)});
}
/** Explicit consolidation may happen early; dates stay anchored to learning. */
export function completeConsolidation(original:AppState,range:Range,at=todayLocal(),completedAt=new Date().toISOString(),targetOffset?:1|3|7):AppState {
 const state=prepareReviewSchedule(original,at),consolidations={...state.reviewConsolidations},events=[...(state.consolidationHistory??[])];
 for(let id=range.start;id<=range.end;id++){
  if(!known(state,id))continue;
  const c=consolidationFor(state,id);if(!c)continue;
  const offset=consolidationOffsets.find(o=>!c.completed[o]);if(!offset||targetOffset!==undefined&&targetOffset!==offset)continue;
  consolidations[id]={...c,completed:{...c.completed,[offset]:at},completedAt:{...c.completedAt,[offset]:completedAt}};
  events.push({id:`${id}-${c.learnedAt}-${offset}`,verseId:id,offset,learnedAt:c.learnedAt,scheduledDate:c.scheduledDates?.[offset]??addDays(c.learnedAt,offset),completedAt});
 }
 return touch({...state,reviewConsolidations:consolidations,consolidationHistory:events});
}
