const test=require('node:test'),assert=require('node:assert/strict');
const {defaultState,stats,generateProgram,reconcileState}=require('./build/core/program');
const {verseId,pageRange,verseAt}=require('./build/core/quran');
const {studyMetrics,studySurahs,studyVerses,remainingStudyRange,validateStudyProgress,studyKey}=require('./build/core/studyProgress');
const {reviewPlan,prepareReviewSchedule}=require('./build/core/review');
function learning(range){return {...defaultState(),sessions:[{id:'learn',...range,date:'2026-09-29',unit:'verse3',status:'todo'}]};}
test('apprentissage partiel : point exact, connaissances uniquement, consolidation et aucune révision effectuée',()=>{
 const range={start:verseId(28,85),end:verseId(29,5)},before=learning(range);
 const next=validateStudyProgress(before,'learning','learn',range,verseId(28,87),'coranTest',undefined,undefined,'2026-09-29');
 const r=next.studyProgress['learning:learn'];assert.equal(r.status,'partial');assert.equal(r.through,verseId(28,87));assert.equal(next.knowledge[verseId(28,87)],'perfect');assert.equal(next.knowledge[verseId(28,88)],undefined);assert.equal(next.reviewHistory.length,0);assert.equal(next.revisions[0].completedCount,0);assert.equal(next.memorizedAt[range.start],'2026-09-29');
 assert.equal(remainingStudyRange(range,r).start,verseId(28,88));assert.equal(stats(next,'2026-09-29').today,3);
 const restored=JSON.parse(JSON.stringify(next));assert.equal(restored.studyProgress['learning:learn'].through,r.through);
 const schedule=generateProgram(restored,'2026-09-30',2);assert.equal(schedule.sessions.find(s=>s.id==='learn').status,'todo');assert.equal(schedule.sessions.filter(s=>s.id!=='learn'&&s.status==='todo').some(s=>s.start<=range.end&&s.end>=range.start),false);
 const consolidated=prepareReviewSchedule(next,'2026-09-30');assert.equal(consolidated.reviewConsolidations[range.start].learnedAt,'2026-09-29');
});
test('menus sourate/verset limités au passage, traversée canonique',()=>{
 const range={start:verseId(28,85),end:verseId(29,5)};
 assert.deepEqual(studySurahs(range).map(s=>s.number),[28,29]);assert.deepEqual(studyVerses(range,28).map(id=>verseAt(id).ayah),[85,86,87,88]);assert.deepEqual(studyVerses(range,29).map(id=>verseAt(id).ayah),[1,2,3,4,5]);assert.deepEqual(studyVerses(range,30),[]);
});
test('validation totale après partielle : pas de doublon et reprise au changement de sourate',()=>{
 const range={start:verseId(28,87),end:verseId(29,3)};
 let s=validateStudyProgress(learning(range),'learning','learn',range,verseId(28,88),'coranTest',undefined,undefined,'2026-09-29');assert.equal(remainingStudyRange(range,s.studyProgress['learning:learn']).start,verseId(29,1));
 s=validateStudyProgress(s,'learning','learn',range,range.end,'coranTest',undefined,undefined,'2026-09-30');assert.equal(s.studyProgress['learning:learn'].status,'completed');assert.equal(s.sessions.find(x=>x.id==='learn').status,'done');assert.equal(remainingStudyRange(range,s.studyProgress['learning:learn']),null);assert.equal(stats(s,'2026-09-29').today,2);assert.equal(stats(s,'2026-09-30').today,3);assert.equal(s.reviewHistory.length,0);const ids=s.revisions.flatMap(r=>Array.from({length:r.end-r.start+1},(_,i)=>r.start+i));assert.equal(new Set(ids).size,ids.length);
 assert.strictEqual(validateStudyProgress(s,'learning','learn',range,range.end,'coranTest'),s);
});
test('bornes invalides ou absence de séance : aucune validation implicite',()=>{
 const range={start:50,end:55},s=learning(range);for(const end of [49,56,NaN,51.5])assert.strictEqual(validateStudyProgress(s,'learning','learn',range,end,'traditional'),s);assert.strictEqual(validateStudyProgress(s,'learning','absent',range,50,'traditional'),s);assert.equal(s.studyProgress['learning:learn'],undefined);
});
test('révision partielle persiste et crédite le corpus même après un jour manqué',()=>{
 const range=pageRange(10);let s=defaultState();for(let id=range.start;id<=range.end;id++)s.knowledge[id]='perfect';s=prepareReviewSchedule(s,'2026-09-29');
 const task={id:'original',...range,category:'habitual',label:'Versets'};assert.ok(reviewPlan(s,'2026-09-29').session.length);
 s=validateStudyProgress(s,'revision',task.id,task,task.start,'traditional',task.category,'hesitant','2026-09-29');
 assert.equal(s.studyProgress[studyKey('revision',task.id)].status,'partial');assert.equal(s.reviewHistory.at(-1).end,task.start);assert.equal(s.sessions.length,0);
 assert.ok(reviewPlan(s,'2026-10-02').session.some(t=>t.id===task.id&&t.start===task.start+1));
 s=validateStudyProgress(s,'revision',task.id,task,task.end,'traditional',task.category,'perfect','2026-10-02');assert.equal(s.studyProgress[studyKey('revision',task.id)].status,'completed');for(let id=task.start;id<=task.end;id++)assert.ok(s.reviewCycle.completed.includes(id));
});
test('affichage pages/versets, page partiellement faite jamais comptée comme complète',()=>{
 const a=pageRange(10),b=pageRange(14),range={start:a.start,end:b.end};let m=studyMetrics(range,pageRange(12).end,'traditional');assert.equal(m.total,5);assert.equal(m.done,3);assert.equal(m.pages,true);
 m=studyMetrics(range,pageRange(12).end-1,'traditional');assert.equal(m.done,2);m=studyMetrics({start:a.start,end:a.start+2},a.start,'traditional');assert.equal(m.pages,false);assert.equal(m.total,3);assert.equal(m.done,1);
});
test('un seul verset : validation explicite complète, révision indépendante',()=>{const range={start:5,end:5};const s=validateStudyProgress(learning(range),'learning','learn',range,5,'coranTest');assert.equal(s.studyProgress['learning:learn'].status,'completed');assert.equal(s.reviewHistory.length,0);assert.equal(stats(s).today,1);});
test('progression cloud conservée avec un ancien client ; reset explicite respecté',()=>{const range={start:5,end:8};const s=validateStudyProgress(learning(range),'learning','learn',range,6,'coranTest');const remote={...s,updatedAt:'2099-01-01T00:00:00Z'};delete remote.studyProgress;assert.equal(reconcileState(s,remote).state.studyProgress['learning:learn'].through,6);assert.deepEqual(reconcileState(s,{...remote,studyProgress:{}}).state.studyProgress,{});});
const {studyEndpointForPage}=require('./build/core/studyProgress');
test('une validation par page ne coupe jamais un verset réparti sur deux pages',()=>{const {verseIndex}=require('./build/coranTest/model');const item=Object.values(verseIndex).find(v=>v.pages.length>1);assert.ok(item);const p=item.pages[0],range={start:item.id-1,end:item.id+1};assert.ok(studyEndpointForPage(p,range,'coranTest')<item.id);assert.ok(studyEndpointForPage(item.pages.at(-1),range,'coranTest')>=item.id);});
