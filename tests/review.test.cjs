const test=require('node:test'),assert=require('node:assert/strict');
const p=require('./build/core/program.js'),r=require('./build/core/review.js'),q=require('./build/core/quran.js');
const at='2026-09-21';
const ids=range=>Array.from({length:range.end-range.start+1},(_,i)=>range.start+i);
const taskIds=tasks=>tasks.flatMap(ids);
function stateFor(known,learnedAt){const s=p.defaultState();for(const id of known)s.knowledge[id]='perfect';if(learnedAt)s.memorizedAt=Object.fromEntries(known.map(id=>[id,learnedAt]));return s;}
for(const count of [1,7,10,30,60])for(const days of [7,14,21,30])test(`${count} Hizb / ${days} jours : corpus exact, aucun doublon, clôture réelle`,()=>{
 const corpus=ids({start:1,end:q.hizbs[count-1].end});let state=stateFor(corpus);state.reviewSettings.cycleDays=days;state=r.prepareReviewSchedule(state,at);
 assert.deepEqual(state.reviewCycle.corpus,corpus);assert.deepEqual(state.reviewCycle.days.flat(),corpus);assert.equal(new Set(state.reviewCycle.days.flat()).size,corpus.length);
 const dailyWeights=state.reviewCycle.days.map(day=>day.reduce((n,id)=>n+r.reviewWeight(id),0));
 const mean=dailyWeights.reduce((a,b)=>a+b,0)/days;
 const maxVerse=Math.max(...corpus.map(r.reviewWeight));
 assert(Math.max(...dailyWeights)-Math.min(...dailyWeights)<=mean*.65+maxVerse*2);
 const proposed=[];
 for(let day=0;day<days;day++){
  const date=p.addDays(at,day);state=r.prepareReviewSchedule(state,date);const session=r.reviewPlan(state,date).session;proposed.push(...taskIds(session));
  for(const task of session)state=r.gradeReviewTask(state,task,'perfect',date);
  assert.equal(r.reviewPlan(state,date).session.length,0);
 }
 assert.deepEqual(proposed,corpus);assert.deepEqual(state.reviewCycle.completed,corpus);
 const next=r.prepareReviewSchedule(state,p.addDays(at,days));assert.equal(next.reviewCycle.index,2);assert.equal(next.reviewCycle.completed.length,0);
});
test('connaissances non contiguës et petits corpus, jamais de verset inconnu',()=>{
 const corpus=[1,2,3,4,5,6,7,10,11,12,q.surahs[29].start+7];
 for(const length of [7,14,21,30]){const split=r.partitionReviewCorpus(corpus,length);assert.deepEqual(split.flat(),corpus);assert.equal(split.length,length);}
});
test('snapshot stable, nouveau savoir au prochain cycle uniquement',()=>{
 let s=r.prepareReviewSchedule(stateFor([1,2,3,4,5,6,7]),at);const snapshot=JSON.stringify(s.reviewCycle.days);
 s.knowledge[6236]='perfect';s.memorizedAt={6236:p.addDays(at,2)};s=r.prepareReviewSchedule(s,p.addDays(at,2));assert.equal(JSON.stringify(s.reviewCycle.days),snapshot);assert(!s.reviewCycle.corpus.includes(6236));
 for(let day=0;day<7;day++){const date=p.addDays(at,day);for(const task of r.reviewPlan(s,date).session)s=r.gradeReviewTask(s,task,'perfect',date);}
 const due=r.reviewPlan(s,p.addDays(at,9)).recent[0];s=r.gradeReviewTask(s,due,'perfect',p.addDays(at,9));for(let day=9;day<16;day++){const date=p.addDays(at,day);for(const task of r.reviewPlan(s,date).session)s=r.gradeReviewTask(s,task,'perfect',date);}s=r.prepareReviewSchedule(s,p.addDays(at,16));assert(s.reviewCycle.corpus.includes(6236));
});
test('J+1, J+3, J+7 exacts, échéances manquées retenues et une étape maximum par jour',()=>{
 let s=r.prepareReviewSchedule(stateFor([6234,6235,6236],at),at);assert.equal(r.reviewPlan(s,at).session.length,0);
 assert.deepEqual(r.reviewPlan(s,at).consolidations[0].steps.map(x=>x.due),['2026-09-22','2026-09-24','2026-09-28']);
 let plan=r.reviewPlan(s,'2026-09-24');s=r.gradeReviewTask(s,plan.recent[0],'perfect','2026-09-24');assert.equal(s.reviewConsolidations[6236].completed[1],'2026-09-24');assert.equal(s.reviewConsolidations[6236].completed[3],undefined);assert.equal(r.reviewPlan(s,'2026-09-24').recent.length,0);
 s=r.gradeReviewTask(s,r.reviewPlan(s,'2026-09-25').recent[0],'perfect','2026-09-25');assert.equal(s.reviewConsolidations[6236].completed[3],'2026-09-25');
 s=r.gradeReviewTask(s,r.reviewPlan(s,'2026-10-01').recent[0],'perfect','2026-10-01');assert.equal(s.reviewConsolidations[6236].completed[7],'2026-10-01');assert.equal(r.reviewPlan(s,'2026-10-01').consolidations.length,0);
});
test('jour manqué : une seule part quotidienne, pas de validation automatique ni avalanche',()=>{
 let s=r.prepareReviewSchedule(stateFor(ids(q.hizbs[0])),at);const first=[...s.reviewCycle.days[0]];
 s=r.prepareReviewSchedule(s,'2026-09-24');assert.deepEqual(taskIds(r.reviewPlan(s,'2026-09-24').habitual),first);
 for(const task of r.reviewPlan(s,'2026-09-24').session)s=r.gradeReviewTask(s,task,'perfect','2026-09-24');assert.equal(r.reviewPlan(s,'2026-09-24').habitual.length,0);
 assert.deepEqual(taskIds(r.reviewPlan(s,'2026-09-25').habitual),s.reviewCycle.days[1]);assert.equal(s.reviewCycle.completed.length,first.length);
 assert.equal(r.prepareReviewSchedule(s,'2026-10-15').reviewCycle.index,1);
});
test('qualité indépendante du cycle, hésitations et difficulté reviennent rapidement',()=>{
 let s=r.prepareReviewSchedule(stateFor(ids(q.hizbs[0])),at);const task=r.reviewPlan(s,at).habitual[0];s=r.gradeReviewTask(s,task,'hesitant',at);
 assert(s.reviewCycle.completed.includes(task.start));assert.equal(s.reviewPriorityDue[task.start],'2026-09-23');assert(s.difficultyMarkers[task.start].user);
 s=r.gradeReviewTask(s,r.reviewPlan(s,'2026-09-23').priority[0],'rework','2026-09-23');assert.equal(s.reviewPriorityDue[task.start],'2026-09-24');
 s=r.gradeReviewTask(s,r.reviewPlan(s,'2026-09-24').priority[0],'perfect','2026-09-24');assert(s.difficultyMarkers[task.start].user);assert.deepEqual(s.reviewHistory.map(e=>e.grade),['hesitant','rework','perfect']);
});
test('ordre consolidation, priorité, cycle ; recouvrement crédité une fois et idempotence',()=>{
 let s=stateFor([1,2,3,6236]);s.memorizedAt={6236:p.addDays(at,-1)};s=r.toggleDifficulty(s,6236,at);s=r.toggleDifficulty(s,2,at);s=r.prepareReviewSchedule(s,at);
 const plan=r.reviewPlan(s,at);assert.equal(plan.session[0].category,'recent');const proposed=taskIds(plan.session);assert.equal(proposed.length,new Set(proposed).size);
 const recent=plan.session[0];s=r.gradeReviewTask(s,recent,'perfect',at);const length=s.reviewHistory.length;s=r.gradeReviewTask(s,recent,'perfect',at);assert.equal(s.reviewHistory.length,length);assert(s.difficultyMarkers[6236].user);
});
test('désactivation et changement de cycle préservent historiques, dates et marqueur professeur',()=>{
 let s=stateFor([6236]);s.difficultyMarkers={6236:{admin:{createdAt:at,comment:'Respiration'}}};s=r.toggleDifficulty(s,6236,at);s=r.prepareReviewSchedule(s,at);s=r.gradeReviewTask(s,r.reviewPlan(s,at).session[0],'perfect',at);
 assert(s.difficultyMarkers[6236].user);assert.equal(s.difficultyMarkers[6236].admin.comment,'Respiration');const history=JSON.stringify(s.reviewHistory);
 const off=r.setReviewsEnabled(s,false);assert.equal(r.reviewPlan(off).session.length,0);s=r.setReviewsEnabled(off,true);s=r.setReviewCycle(s,14,at);assert.equal(s.reviewCycle.lengthDays,14);assert.equal(JSON.stringify(s.reviewHistory),history);
});
test('unités fidèles : Hizb, Nisf, Rubu’, pages, versets ; incomplet jamais nommé complet',()=>{
 assert.equal(r.reviewQuantity(ids(q.hizbs[0])),'1 Hizb');assert.equal(r.reviewQuantity(ids(q.halves[0])),'1 Nisf');assert.equal(r.reviewQuantity(ids(q.quarters[0])),'1 Rubu’');
 assert.equal(r.reviewQuantity(ids(q.pageRange(4))),'1 page');assert.equal(r.reviewQuantity([q.pageRange(4).start]),'1 verset');assert.equal(r.reviewQuantity([6234,6235,6236]),'3 versets');
 assert.notEqual(r.reviewQuantity(ids(q.quarters[0]).slice(1)),'1 Rubu’');
});
test('synchronisation JSON et reprise de compte conservent cycle et consolidations',()=>{
 const s=r.prepareReviewSchedule(stateFor([1,6236],at),at);s.userId='a';const remote=JSON.parse(JSON.stringify(s));const restored=p.accountState('a',null,remote).state;assert.deepEqual(restored.reviewCycle,s.reviewCycle);assert.deepEqual(restored.reviewConsolidations,s.reviewConsolidations);
});
test('migration des seules révisions effectuées, historique intact, préparation idempotente',()=>{
 let s=stateFor([6236],'2026-09-01');s.reviewHistory=[{id:'old',date:'2026-09-02',start:6236,end:6236,category:'recent',grade:'perfect'}];s.reviewDue={6236:'2026-09-30'};s=r.prepareReviewSchedule(s,at);assert.equal(s.reviewConsolidations[6236].completed[1],'2026-09-02');assert.equal(s.reviewConsolidations[6236].completed[3],undefined);assert.equal(s.reviewHistory[0].id,'old');assert.equal(s.reviewDue[6236],'2026-09-30');assert.equal(r.prepareReviewSchedule(s,at),s);
});
test('validation apprentissage : learnedAt daté une fois pour générer les consolidations',()=>{
 let s=p.defaultState();s.sessions=[{id:'learn',date:at,start:6234,end:6236,unit:'verse3',status:'todo'}];s=p.completeSession(s,'learn',true,at);s=p.completeSession(s,'learn',true,'2026-09-25');assert.equal(s.memorizedAt[6234],at);assert.equal(r.reviewPlan(s,at).consolidations.length,1);
});
test('remise à zéro explicite ne restaure pas un ancien cycle depuis le cache',()=>{
 const previous=r.prepareReviewSchedule(stateFor([1,2,3]),at);const reset=p.resetAllProgress(previous);assert.equal(p.reconcileState(previous,reset).state.reviewCycle,null);
});

test('J+7 manqué ne fait pas intégrer un nouveau verset au cycle suivant',()=>{
 let s=r.prepareReviewSchedule(stateFor([6236],at),at);s=r.prepareReviewSchedule(s,p.addDays(at,7));assert(!s.reviewCycle.corpus.includes(6236));assert.equal(r.reviewPlan(s,p.addDays(at,7)).recent[0].start,6236);
});

test('un ancien client cloud ne fait pas disparaître le snapshot local déjà persisté',()=>{
 const local=r.prepareReviewSchedule(stateFor([1,2,3]),at);const remote={...local,updatedAt:'2099-01-01T00:00:00.000Z'};delete remote.reviewCycle;delete remote.reviewConsolidations;delete remote.reviewPriorityDue;
 const restored=p.reconcileState(local,remote);assert.deepEqual(restored.state.reviewCycle,local.reviewCycle);assert.equal(restored.shouldPush,true);
});

test('apprendre une zone chevauchante préserve aussi les anciens compteurs de révision',()=>{
 let s=p.defaultState();s.revisions=[{id:'legacy',start:6233,end:6236,due:at,interval:14,streak:4,completedCount:12}];s.sessions=[{id:'new',date:at,start:6235,end:6236,unit:'verse2',status:'todo'}];s=p.completeSession(s,'new',true,at);assert.equal(s.revisions.find(x=>x.id==='legacy').completedCount,12);
});
