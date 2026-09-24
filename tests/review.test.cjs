const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('./build/core/program.js');
const r=require('./build/core/review.js');
const q=require('./build/core/quran.js');

const start='2026-09-21';
function learned(ids,day=start){
  let state=p.defaultState();
  for(const id of ids)state.knowledge[id]='perfect';
  state.memorizedAt=Object.fromEntries(ids.map(id=>[id,day]));
  return state;
}

test('un passage passe en révision habituelle le quatrième jour civil',()=>{
  const state=learned([6234,6235,6236]);
  assert.equal(r.reviewPlan(state,start).recent.length,1);
  assert.equal(r.reviewPlan(state,start).session.length,0);
  assert.equal(r.reviewPlan(state,'2026-09-22').recent.length,1);
  assert.equal(r.reviewPlan(state,'2026-09-23').recent.length,1);
  assert.equal(r.reviewPlan(state,'2026-09-24').recent.length,0);
  const scheduled=r.prepareReviewSchedule(state,'2026-09-24');
  assert.equal(r.reviewPlan(scheduled,'2026-09-24').habitual.length>0,true);
  assert.equal(scheduled.memorizedAt[6234],start);
});

test('désactiver puis réactiver conserve les données et répartit les échéances manquées',()=>{
  let state=learned(Array.from({length:20},(_,i)=>6217+i),'2026-09-01');
  state=r.prepareReviewSchedule(state,'2026-09-10');
  const due={...state.reviewDue};
  state=r.toggleDifficulty(state,6236,'2026-09-10');
  const off=r.setReviewsEnabled(state,false,'2026-09-11');
  assert.equal(r.reviewPlan(off,'2026-09-20').session.length,0);
  assert.deepEqual(off.reviewDue,due);
  assert.equal(off.difficultyMarkers[6236].user.createdAt,'2026-09-10');
  const on=r.setReviewsEnabled(off,true,'2026-09-20');
  const plan=r.reviewPlan(on,'2026-09-20');
  assert(plan.session.length>0);
  assert(plan.habitual.reduce((n,task)=>n+task.end-task.start+1,0)<=Math.ceil(20/7)*2);
  assert.equal(on.memorizedAt[6236],'2026-09-01');
});

test('la priorité ne double pas le verset dans la séance et la note reste historique',()=>{
  let state=learned([6235,6236],'2026-09-19');
  state=r.toggleDifficulty(state,6236,start);
  const plan=r.reviewPlan(state,start);
  assert.equal(plan.priority.length,1);
  assert.equal(plan.recent.length,1);
  assert.equal(plan.session.flatMap(task=>Array.from({length:task.end-task.start+1},(_,i)=>task.start+i)).filter(id=>id===6236).length,1);
  const after=r.gradeReviewTask(state,plan.priority[0],'hesitant',start);
  assert.equal(after.reviewHistory.length,1);
  assert.equal(after.reviewHistory[0].grade,'hesitant');
  assert.equal(r.reviewPlan(after,start).priority.length,0);
  assert.equal(after.difficultyMarkers[6236].user.createdAt,start);
});

test('retirer son marqueur conserve le marqueur professeur et les deux historiques',()=>{
  let state=learned([6236],'2026-09-01');
  state.difficultyMarkers={6236:{admin:{createdAt:'2026-09-19',comment:'Revoir le début'}}};
  state=r.toggleDifficulty(state,6236,start);
  assert.equal(state.difficultyMarkers[6236].admin.comment,'Revoir le début');
  state=r.toggleDifficulty(state,6236,'2026-09-22');
  assert.equal(state.difficultyMarkers[6236].user,undefined);
  assert.equal(state.difficultyMarkers[6236].admin.comment,'Revoir le début');
  assert.deepEqual(state.difficultyHistory.map(row=>row.action),['marked','resolved']);
});

test('un juz incomplet ne produit jamais de rubu’ complet artificiel',()=>{
  const juz=q.juzs[29];
  const ids=Array.from({length:juz.end-juz.start+1},(_,i)=>juz.start+i).filter(id=>id!==juz.start);
  let state=learned(ids,'2026-09-01');
  state=r.prepareReviewSchedule(state,'2026-09-10');
  const plan=r.reviewPlan(state,'2026-09-10');
  assert.equal(plan.completeJuz,0);
  assert(plan.completeRub<8);
});

test('un juz complet se répartit en véritables nisf sans couper une unité du jour',()=>{
  const juz=q.juzs[29];
  const ids=Array.from({length:juz.end-juz.start+1},(_,i)=>juz.start+i);
  const state=r.prepareReviewSchedule(learned(ids,'2026-09-01'),'2026-09-10');
  const plan=r.reviewPlan(state,'2026-09-10');
  assert.equal(plan.completeJuz,1);
  assert(plan.habitual.some(task=>task.label.startsWith('Nisf al-hizb')));
  for(const task of plan.habitual.filter(task=>task.label.startsWith('Nisf'))){
    assert.equal(task.start,q.quarters.find(quarter=>quarter.start===task.start).start);
    assert.equal((task.end-task.start+1)>0,true);
  }
});

test('une séance validée date chaque nouveau verset une seule fois',()=>{
  let state=p.defaultState();
  state.sessions=[{id:'learn',date:start,start:6234,end:6236,unit:'verse3',status:'todo'}];
  state=p.completeSession(state,'learn',true,start);
  assert.equal(state.memorizedAt[6234],start);
  state=p.completeSession(state,'learn',true,'2026-09-25');
  assert.equal(state.memorizedAt[6234],start);
});
