import { expand, hizbs, normalizeRanges, pageOf, pageRange, quarters, halves, Range, surahAt, totalVolume, volume, weights } from './quran';

export type Mastery = 'perfect' | 'review' | 'learning';
export type Pace = 'verse3' | 'verse5' | 'halfPage' | 'page' | 'quarter' | 'halfHizb' | 'hizb';
export type SessionStatus = 'todo' | 'done' | 'postponed';
export type Session = { id: string; date: string; start: number; end: number; unit: Pace; status: SessionStatus; completedAt?: string; completedDate?: string };
export type Revision = { id: string; start: number; end: number; due: string; interval: number; streak: number; lastGrade?: 'perfect'|'hesitant'|'errors'|'relearn'; completedCount: number };
export type LearningDirection = 'fromStart' | 'fromNas';
export type Goal = { label: string; ranges: Range[]; direction?: LearningDirection };
export type AppState = { schema: 1; onboardingDone: boolean; knowledge: Record<string, Mastery>; goal: Goal; pace: Pace; learningDays: number[]; sessions: Session[]; revisions: Revision[]; updatedAt: string; userId?: string };

export const paceLabels: Record<Pace,string> = { verse3:'3 versets',verse5:'5 versets',halfPage:'½ page',page:'1 page',quarter:'1 rub‘',halfHizb:'1 nisf',hizb:'1 hizb' };
export const weekdays = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
export const defaultState = (): AppState => ({schema:1,onboardingDone:false,knowledge:{},goal:{label:'Juz’ ‘Amma',ranges:[{start:5673,end:6236}]},pace:'verse3',learningDays:[1,2,3,4,5],sessions:[],revisions:[],updatedAt:'1970-01-01T00:00:00.000Z'});
export const todayLocal = (): string => dateKey(new Date());
export function dateKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function addDays(key: string, days: number): string { const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+days);return dateKey(d); }
export function dayOf(key: string): number { return new Date(`${key}T12:00:00`).getDay(); }
export function touch(state: AppState): AppState {return {...state,updatedAt:new Date().toISOString()};}

export function markKnowledge(state: AppState, range: Range, mastery: Mastery): AppState {
  const knowledge={...state.knowledge};
  for(let id=range.start;id<=range.end;id++) knowledge[id]=mastery;
  return touch({...state,knowledge});
}
export function goalIds(state: AppState): number[] {return expand(state.goal.ranges);}
export function learningOrderIds(state: AppState): number[] {
  const ids=goalIds(state);
  return state.goal.direction==='fromNas'
    ? ids.sort((a,b)=>surahAt(b).number-surahAt(a).number||a-b)
    : ids;
}
export function memorizedIds(state: AppState): number[] {return Object.keys(state.knowledge).map(Number).filter(id=>state.knowledge[id]==='perfect'||state.knowledge[id]==='review');}
export function progress(state: AppState) {
  const known = new Set(memorizedIds(state));
  const all=Array.from(known);
  const target=goalIds(state);
  const goalTotal=volume(target);
  const goalKnown=volume(target.filter(id=>known.has(id)));
  return {quran:totalVolume?volume(all)/totalVolume:0,goal:goalTotal?goalKnown/goalTotal:0,goalKnown,goalTotal};
}
export function validGoal(ranges: Range[]): boolean {
  const ids=expand(ranges), selected=new Set(ids);
  if(hizbs.some(h=>Array.from({length:h.end-h.start+1},(_,i)=>h.start+i).every(id=>selected.has(id)))) return true;
  return volume(ids)>=totalVolume/60;
}

function nextChunk(remaining: number[], pace: Pace): number[] {
  if(!remaining.length)return [];
  if(pace==='verse3'||pace==='verse5') return remaining.slice(0,pace==='verse3'?3:5);
  const first=remaining[0];
  if(pace==='halfPage'||pace==='page') {
    const pr=pageRange(pageOf(first));
    const within=takePrefix(remaining,id=>id>=pr.start&&id<=pr.end);
    if(pace==='page')return within;
    const target=volume(Array.from({length:pr.end-pr.start+1},(_,i)=>pr.start+i))/2;
    let sum=0;const out:number[]=[];
    for(const id of within){out.push(id);sum+=weights[id-1];if(sum>=target)break;}
    return out;
  }
  const divisions=pace==='quarter'?quarters:pace==='halfHizb'?halves:hizbs;
  const boundary=divisions.find(d=>first>=d.start&&first<=d.end)!;
  return takePrefix(remaining,id=>id>=boundary.start&&id<=boundary.end);
}
function takePrefix(ids:number[],includes:(id:number)=>boolean):number[] {
  const out:number[]=[];
  for(const id of ids){if(!includes(id))break;out.push(id);}
  return out;
}
function splitContiguous(ids: number[]): Range[] {
  const result: Range[]=[];
  for(const id of ids){const last=result[result.length-1];if(last&&id===last.end+1&&surahAt(id).number===surahAt(last.start).number)last.end=id;else result.push({start:id,end:id});}
  return result;
}
export function generateProgram(state: AppState, from=todayLocal(), days=20000): AppState {
  const old=state.sessions.filter(s=>s.status!=='todo'||s.date<from).map(s=>s.status==='todo'?{...s,status:'postponed' as SessionStatus}:s);
  const scheduled=new Set(old.filter(s=>s.status==='done').flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i)));
  const known=new Set(memorizedIds(state));
  let remaining=learningOrderIds(state).filter(id=>!known.has(id)&&!scheduled.has(id));
  const sessions: Session[]=[];
  let serial=0;
  for(let offset=0;offset<days&&remaining.length;offset++){
    const date=addDays(from,offset);
    if(!state.learningDays.includes(dayOf(date)))continue;
    const chunk=nextChunk(remaining,state.pace);
    remaining=remaining.slice(chunk.length);
    for(const range of splitContiguous(chunk))sessions.push({id:`${date}-${range.start}-${serial++}`,date,...range,unit:state.pace,status:'todo'});
  }
  return touch({...state,sessions:[...old,...sessions].sort((a,b)=>a.date.localeCompare(b.date))});
}
export function seedInitialRevisions(state:AppState,from=todayLocal()):AppState {
  const covered=new Set(state.revisions.flatMap(r=>Array.from({length:r.end-r.start+1},(_,i)=>r.start+i)));
  const known=memorizedIds(state).filter(id=>!covered.has(id)).sort((a,b)=>a-b);
  const groups=splitContiguous(known);
  const revisions=[...state.revisions,...groups.map(r=>({id:`r-initial-${r.start}-${r.end}`,start:r.start,end:r.end,due:addDays(from,1),interval:1,streak:0,completedCount:0}))];
  return touch({...state,revisions});
}
export function postponeSession(state: AppState,id:string,from=todayLocal()):AppState {
  const sessions=state.sessions.map(s=>s.id===id?{...s,status:'postponed' as SessionStatus}:s);
  return generateProgram({...state,sessions},from);
}
export function completeSession(state: AppState,id:string,memorized:boolean,from=todayLocal()):AppState {
  const session=state.sessions.find(s=>s.id===id);
  if(!session)return state;
  if(!memorized)return postponeSession(state,id,from);
  const updated=markKnowledge(state,session,'perfect');
  const revisions=updated.revisions.filter(r=>r.end<session.start||r.start>session.end);
  revisions.push({id:`r-${session.start}-${session.end}`,start:session.start,end:session.end,due:addDays(from,1),interval:1,streak:0,completedCount:0});
  const sessions=updated.sessions.map(s=>s.id===id?{...s,status:'done' as SessionStatus,completedAt:new Date().toISOString(),completedDate:from}:s);
  return generateProgram({...updated,sessions,revisions},from);
}
export function gradeRevision(state:AppState,id:string,grade:'perfect'|'hesitant'|'errors'|'relearn',from=todayLocal()):AppState {
  const revisions=state.revisions.map(r=>{
    if(r.id!==id)return r;
    const interval=grade==='perfect'?Math.min(90,Math.max(3,r.interval*2)):grade==='hesitant'?3:grade==='errors'?1:1;
    return {...r,interval,streak:grade==='perfect'?r.streak+1:0,due:addDays(from,interval),lastGrade:grade,completedCount:r.completedCount+1};
  });
  const target=state.revisions.find(r=>r.id===id);
  if(!target)return state;
  let updated={...state,revisions};
  if(grade==='relearn')updated=markKnowledge(updated,target,'learning');
  else if(grade==='perfect')updated=markKnowledge(updated,target,'perfect');
  else updated=markKnowledge(updated,target,'review');
  return touch(updated);
}
export function completedHizbs(state:AppState):number {const known=new Set(memorizedIds(state));return hizbs.filter(h=>{for(let id=h.start;id<=h.end;id++)if(!known.has(id))return false;return true;}).length;}
export function stats(state:AppState,at=todayLocal()) {
  const done=state.sessions.filter(s=>s.status==='done'&&s.completedAt);
  const date=new Date(`${at}T12:00:00`);const weekStart=addDays(at,-((date.getDay()+6)%7));const monthStart=`${at.slice(0,7)}-01`;
  const dateOf=(s:Session)=>s.completedDate??s.completedAt!.slice(0,10);
  const count=(start:string)=>done.filter(s=>dateOf(s)>=start&&dateOf(s)<=at).reduce((n,s)=>n+s.end-s.start+1,0);
  return {today:count(at),week:count(weekStart),month:count(monthStart),days:new Set(done.map(dateOf)).size,revisions:state.revisions.reduce((n,r)=>n+r.completedCount,0),hizbs:completedHizbs(state),weeklySessions:done.filter(s=>dateOf(s)>=weekStart).length};
}
