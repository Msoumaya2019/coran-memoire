const {test}=require('node:test'),assert=require('node:assert/strict');
const {quizDay,emptyQuiz,recordDailyAnswer,mergeQuizSnapshot,challengeStatus,quizStatistics}=require('./build/core/quiz');
test('daily answers are immutable locally, persist by account snapshot and roll over in local time',()=>{
 const q={id:'q1',publicationDate:'2026-10-03',answers:[{id:'A',text:'A'},{id:'B',text:'B'},{id:'C',text:'C'}]},old=emptyQuiz('2026-10-03'),next=recordDailyAnswer(old,q,'B','2026-10-03','2026-10-03T10:00:00Z');
 assert.equal(recordDailyAnswer(next,q,'C','2026-10-03','2026-10-03T11:00:00Z'),next);assert.equal(JSON.parse(JSON.stringify(next)).responses[0].selectedAnswerId,'B');assert.equal(quizDay(new Date('2026-10-03T22:01:00Z'),'Europe/Paris'),'2026-10-04');assert.equal(quizDay(new Date('2026-10-25T23:01:00Z'),'Europe/Paris'),'2026-10-26');assert.throws(()=>recordDailyAnswer(old,q,'Z','2026-10-03',''),/invalide/);
 const confirmed={...next,responses:[{...next.responses[0],pending:false,isCorrect:true}]};assert.equal(mergeQuizSnapshot(confirmed,next).responses.length,1);assert.equal(mergeQuizSnapshot(confirmed,next).responses[0].pending,false);
});
test('expired challenges have no winner and completed ties count once',()=>{
 const c={id:'c',creatorId:'a',opponentId:'b',questionCount:5,status:'pending',expiresAt:'2026-10-04T12:00:00Z',answers:Array.from({length:5},(_,i)=>({userId:'a',questionId:String(i),isCorrect:true}))};assert.equal(challengeStatus(c,'a',Date.parse('2026-10-03')),'En attente de l’ami');assert.equal(challengeStatus(c,'b',Date.parse('2026-10-03')),'À toi de jouer');assert.equal(challengeStatus(c,'a',Date.parse('2026-10-05')),'Expiré');assert.equal(quizStatistics({...emptyQuiz(''),challenges:[c]},'a').played,0);c.status='completed';c.answers.push(...c.answers.map(a=>({...a,userId:'b'})));assert.equal(quizStatistics({...emptyQuiz(''),challenges:[c]},'a').ties,1);
});
