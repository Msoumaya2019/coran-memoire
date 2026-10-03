import {AppState,addDays,dateKey,todayLocal} from './program';
export const scheduledDate=(session:AppState['sessions'][number])=>session.scheduledDate??session.date;
export function upcomingSessions(state:AppState,at=todayLocal()){
 return state.sessions.filter(s=>s.status==='todo'&&scheduledDate(s)>=at&&scheduledDate(s)<=addDays(at,10));
}
/** Local calendar arithmetic, including DST; no fixed millisecond week. */
export function weeklyProgress(state:AppState,now=new Date()){
 const key=dateKey(now),start=addDays(key,-((now.getDay()+6)%7)),end=addDays(start,6);
 const sessions=state.sessions.filter(s=>scheduledDate(s)>=start&&scheduledDate(s)<=end);
 const done=sessions.filter(s=>s.status==='done').length;
 return {weekStart:start,weekEnd:end,total:sessions.length,done,ratio:sessions.length?done/sessions.length:0};
}

export function sessionStatus(state:AppState,session:AppState['sessions'][number]):'pending'|'completed'|'skipped'|'partiallyCompleted'{
 return session.status==='done'?'completed':session.status==='postponed'?'skipped':state.studyProgress?.[`learning:${session.id}`]?.status==='partial'?'partiallyCompleted':'pending';
}
