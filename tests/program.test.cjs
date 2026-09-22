const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('./build/core/program.js');
const q=require('./build/core/quran.js');
const toumoun=require('../src/data/toumoun.json');
const monday='2026-09-21';

test('corpus Hafs et limites officielles cohérents',()=>{
  assert.equal(q.verses.length,6236);
  assert.equal(q.surahs.length,114);
  assert.equal(q.juzs.length,30);
  assert.equal(q.hizbs.length,60);
  assert.equal(q.halves.length,120);
  assert.equal(q.quarters.length,240);
  assert.equal(q.pages.length,604);
  assert.equal(q.pageOf(1),1);
  assert.equal(q.pageOf(6236),604);
  assert.equal(q.verseId(114,6),6236);
  assert.equal(toumoun.length,480);
  assert(toumoun.every(t=>t.verificationStatus==='missing_hafs_reference'&&t.startAyah===null));
});

test('un hizb entier est un objectif valide, même si déjà partiellement connu',()=>{
  assert.equal(p.validGoal([q.hizbs[59]]),true);
  assert.equal(p.validGoal([{start:6236,end:6236}]),false);
  let state=p.defaultState();state.goal={label:'Hizb 60',ranges:[q.hizbs[59]]};
  state=p.markKnowledge(state,{start:q.hizbs[59].start,end:q.hizbs[59].start+10},'perfect');
  assert(p.progress(state).goal>0);
});

test('le plan évite les passages mémorisés au milieu et les doublons',()=>{
  let state=p.defaultState();state.goal={label:'Test',ranges:[{start:6000,end:6020}]};state.pace='verse5';
  state=p.markKnowledge(state,{start:6005,end:6011},'perfect');
  state=p.generateProgram(state,monday,20);
  const ids=state.sessions.flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i));
  assert.equal(new Set(ids).size,ids.length);
  assert(ids.every(id=>id<6005||id>6011));
  assert.equal(ids.length,14);
  assert(state.sessions.every(s=>q.surahAt(s.start).number===q.surahAt(s.end).number));
});

test('report et modification du rythme conservent l’historique',()=>{
  let state=p.defaultState();state.goal={label:'Test',ranges:[{start:5900,end:5930}]};
  state=p.generateProgram(state,monday,30);
  const first=state.sessions[0];
  state=p.completeSession(state,first.id,true,monday);
  assert.equal(state.sessions.find(s=>s.id===first.id).status,'done');
  const next=state.sessions.find(s=>s.status==='todo');
  state=p.postponeSession(state,next.id,monday);
  assert.equal(state.sessions.find(s=>s.id===next.id).status,'postponed');
  state=p.generateProgram({...state,pace:'verse5',goal:{label:'Autre',ranges:[{start:5900,end:5940}]}},monday,30);
  assert.equal(state.sessions.find(s=>s.id===first.id).status,'done');
  assert.equal(state.sessions.find(s=>s.id===next.id).status,'postponed');
  const future=state.sessions.filter(s=>s.status==='todo');
  assert(future.every(s=>s.unit==='verse5'));
});

test('la révision oubliée abaisse la maîtrise et le même passage ne compte pas deux fois',()=>{
  let state=p.defaultState();state.goal={label:'Test',ranges:[{start:6100,end:6120}]};state=p.generateProgram(state,monday,10);
  const first=state.sessions[0];state=p.completeSession(state,first.id,true,monday);
  const before=p.progress(state).goal;
  state=p.markKnowledge(state,first,'perfect');
  assert.equal(p.progress(state).goal,before);
  const rev=state.revisions[0];state=p.gradeRevision(state,rev.id,'relearn','2026-09-22');
  assert.equal(state.knowledge[first.start],'learning');
  assert(p.progress(state).goal<before);
  assert.equal(state.revisions[0].completedCount,1);
});
