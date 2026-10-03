export const quizCategories=['Coran','Tajwid','Prophètes','Sîra','Vocabulaire coranique','Connaissances générales'] as const;
export type QuizQuestion={id:string;category:string;question:string;answers:{id:string;text:string}[];publicationDate:string|null;explanation?:string;sourceTitle?:string;sourceReference?:string;sourceUrl?:string;arabic?:string;translation?:string;surah?:number|null;ayah?:number|null;correctAnswerId?:string;isDailyQuestion?:boolean;availableForChallenges?:boolean;isActive?:boolean};
export type DailyResponse={questionId:string;day:string;selectedAnswerId:string;answeredAt:string;isCorrect?:boolean;question:QuizQuestion;pending?:boolean};
export type QuizChallenge={id:string;creatorId:string;opponentId:string;creatorName:string;opponentName:string;creatorAvatar?:string|null;opponentAvatar?:string|null;questionCount:5|10;createdAt:string;expiresAt:string;completedAt:string|null;status:'pending'|'completed'|'expired';questions:QuizQuestion[];answers:{userId:string;questionId:string;selectedAnswerId:string;answeredAt:string;isCorrect?:boolean}[]};
export type ThemedQuiz={id:string;title:string;category:string;questionIds?:string[];isActive?:boolean};
export type QuizSnapshot={day:string;daily:QuizQuestion|null;responses:DailyResponse[];challenges:QuizChallenge[];quizSets?:ThemedQuiz[];notificationsEnabled?:boolean};
export const emptyQuiz=(day:string):QuizSnapshot=>({day,daily:null,responses:[],challenges:[]});
export function quizDay(date=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');}
export function challengeStatus(c:QuizChallenge,userId:string,now=Date.now()){
 if(c.status==='completed')return 'Terminé';
 if(c.status==='expired'||Date.parse(c.expiresAt)<=now)return 'Expiré';
 return c.answers.filter(a=>a.userId===userId).length===c.questionCount?'En attente de l’ami':'À toi de jouer';
}
export function quizStatistics(snapshot:QuizSnapshot,userId:string){const confirmed=snapshot.responses.filter(r=>!r.pending&&r.isCorrect!==undefined),correct=confirmed.filter(r=>r.isCorrect).length;const finished=snapshot.challenges.filter(c=>c.status==='completed');let wins=0,ties=0;for(const c of finished){const own=c.answers.filter(a=>a.userId===userId&&a.isCorrect).length,other=c.answers.filter(a=>a.userId!==userId&&a.isCorrect).length;if(own>other)wins++;if(own===other)ties++;}return {correct,total:confirmed.length,rate:confirmed.length?Math.round(correct/confirmed.length*100):0,played:finished.length,wins,ties};}
export function mergeQuizSnapshot(remote:QuizSnapshot,local:QuizSnapshot){const byDay=new Map(remote.responses.map(r=>[r.day,r]));for(const r of local.responses)if(r.pending&&!byDay.has(r.day))byDay.set(r.day,r);return {...remote,responses:[...byDay.values()].sort((a,b)=>b.day.localeCompare(a.day))};}
export function recordDailyAnswer(snapshot:QuizSnapshot,question:QuizQuestion,answerId:string,day:string,answeredAt:string):QuizSnapshot{
 if(snapshot.responses.some(r=>r.day===day))return snapshot;
 if(!question.answers.some(a=>a.id===answerId)||question.publicationDate!==day)throw new Error('Réponse ou date invalide.');
 return {...snapshot,responses:[{questionId:question.id,day,selectedAnswerId:answerId,answeredAt,question,pending:true},...snapshot.responses]};
}
