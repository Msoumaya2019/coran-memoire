const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('./build/core/program.js');
const q=require('./build/core/quran.js');
const nav=require('./build/core/pageNavigation.js');
const toumoun=require('../src/data/toumoun.json');
const t=require('./build/core/toumoun.js');
const monday='2026-09-21';

test('un nouveau téléphone récupère la sauvegarde distante avant tout progrès local',()=>{
  const fresh=p.defaultState();
  assert.equal(fresh.updatedAt,'1970-01-01T00:00:00.000Z');
  assert.equal(fresh.onboardingDone,false);
  assert(new Date(fresh.updatedAt)<new Date('2026-01-01T00:00:00.000Z'));
});

test('la remise à zéro efface apprentissage et révisions et relance le questionnaire',()=>{
  let state=p.defaultState();
  state.goal={label:'Tout le Coran',ranges:[{start:1,end:6236}],direction:'fromNas'};
  state=p.markKnowledge(state,{start:6231,end:6236},'perfect');
  state=p.generateProgram({...state,onboardingDone:true},monday,3);
  state=p.seedInitialRevisions(state,monday);
  assert(Object.keys(state.knowledge).length>0&&state.sessions.length>0&&state.revisions.length>0);
  const reset=p.resetAllProgress();
  assert.equal(reset.onboardingDone,false);
  assert.deepEqual(reset.knowledge,{});
  assert.deepEqual(reset.sessions,[]);
  assert.deepEqual(reset.revisions,[]);
  assert.equal(p.progress(reset).quran,0);
  assert.equal(p.stats(reset,monday).revisions,0);
  assert(reset.updatedAt>=state.updatedAt);
});

test('les gestes horizontaux tournent une page et le défilement vertical est ignoré',()=>{
  assert.equal(nav.pageAfterSwipe(120,-90,8),121);
  assert.equal(nav.pageAfterSwipe(120,90,8),119);
  assert.equal(nav.pageAfterSwipe(120,25,8),120);
  assert.equal(nav.pageAfterSwipe(120,-90,100),120);
  assert.equal(nav.pageAfterSwipe(1,90,5),1);
  assert.equal(nav.pageAfterSwipe(604,-90,5),604);
});

test('le rythme toumoun exige 480 limites Hafs vérifiées et contiguës',()=>{
  assert.equal(t.verifiedToumounRanges(),null);
  assert.equal(p.availablePaces.includes('toumoun'),false);
  const fake=toumoun.map(x=>({...x,verificationStatus:'verified_hafs',source:'Qaloun'}));
  assert.equal(t.verifiedToumounRanges(fake),null);
  assert.throws(()=>p.generateProgram({...p.defaultState(),pace:'toumoun'},monday,2),/limites Hafs/);
});

test('le niveau débutant programme un verset par jour sans répéter un verset connu',()=>{
  assert.equal(p.pacePresets.beginner.pace,'verse1');
  assert.equal(p.pacePresets.intermediate.pace,'halfPage');
  assert.equal(p.pacePresets.intensive.pace,'page');
  assert.deepEqual(p.beginnerPaces,['verse1','verse2','verse3','verse4','verse5']);
  assert.deepEqual(p.intensivePaces,['page','page2','quarter']);
  let state=p.defaultState();
  state.goal={label:'Passage',ranges:[{start:6230,end:6236}]};
  state.pace=p.pacePresets.beginner.pace;
  state.learningDays=[0,1,2,3,4,5,6];
  state=p.markKnowledge(state,{start:6232,end:6232},'perfect');
  state=p.generateProgram(state,monday,7);
  const sessions=state.sessions.filter(s=>s.status==='todo');
  assert.equal(sessions.length,6);
  assert.deepEqual(sessions.map(s=>s.start),[6230,6231,6233,6234,6235,6236]);
  assert(sessions.every(s=>s.start===s.end&&s.unit==='verse1'));
  assert.deepEqual(sessions.map(s=>s.date),[monday,p.addDays(monday,1),p.addDays(monday,2),p.addDays(monday,3),p.addDays(monday,4),p.addDays(monday,5)]);
});

test('les objectifs proposés suivent des limites exactes depuis An-Nâs',()=>{
  const ten=p.goalFromPreset('lastTen');
  const yasin=p.goalFromPreset('toYasin');
  const half=p.goalFromPreset('half');
  assert.deepEqual(ten.ranges,[{start:q.surahs[104].start,end:6236}]);
  assert.deepEqual(yasin.ranges,[{start:q.surahs[35].start,end:6236}]);
  assert.deepEqual(half.ranges,[{start:q.juzs[15].start,end:6236}]);
  for(const goal of [ten,yasin,half]){
    assert.equal(goal.direction,'fromNas');
    const state={...p.defaultState(),goal};
    assert.equal(p.learningOrderIds(state)[0],q.surahs[113].start);
  }
  assert.equal(p.goalFromPreset('sabbih').ranges[0].start,q.hizbs[59].start);
  assert.equal(p.goalFromPreset('amma').ranges[0].start,q.juzs[29].start);
});

test('cocher un ensemble connu conserve les passages partiels et évite les doublons',()=>{
  const surah=q.surahs[113];
  let state=p.defaultState();
  state=p.markKnowledge(state,{start:surah.start,end:surah.start+1},'perfect');
  assert.deepEqual(p.partialKnownRanges(state),[{start:surah.start,end:surah.start+1}]);
  assert.equal(p.isRangeKnown(state,surah),false);
  state=p.toggleKnownRange(state,surah);
  assert.equal(p.isRangeKnown(state,surah),true);
  assert.deepEqual(p.partialKnownRanges(state),[]);
  assert.equal(p.memorizedIds(state).filter(id=>id>=surah.start&&id<=surah.end).length,surah.count);
  state=p.toggleKnownRange(state,surah);
  assert.equal(p.isRangeKnown(state,surah),false);
});

test('2 à 5 versets et deux pages créent des séances sans doublons',()=>{
  for(const count of [2,3,4,5]){
    const state=p.generateProgram({...p.defaultState(),goal:{label:'Test',ranges:[{start:6200,end:6220}]},pace:`verse${count}`},monday,1);
    const ids=state.sessions.flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i));
    assert.deepEqual(ids,Array.from({length:count},(_,i)=>6200+i));
  }
  const goal={label:'Trois pages',ranges:[{start:q.pageRange(1).start,end:q.pageRange(3).end}]};
  const state=p.generateProgram({...p.defaultState(),goal,pace:'page2'},monday,1);
  const ids=state.sessions.flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i));
  assert.deepEqual([...new Set(ids.map(q.pageOf))],[1,2]);
  assert.equal(new Set(ids).size,ids.length);
  const reverse=p.generateProgram({...p.defaultState(),goal:{label:'Fin du Coran',ranges:[{start:q.pageRange(602).start,end:6236}],direction:'fromNas'},pace:'page2'},monday,1);
  const reverseIds=reverse.sessions.flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i));
  assert.deepEqual([...new Set(reverseIds.map(q.pageOf))].sort((a,b)=>a-b),[603,604]);
  assert.equal(new Set(reverseIds).size,reverseIds.length);
});

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

test('tout le Coran peut commencer par An-Nâs puis remonter les sourates',()=>{
  let state=p.defaultState();
  state.goal={label:'Tout le Coran',ranges:[{start:1,end:6236}],direction:'fromNas'};
  state.pace='verse3';
  state=p.generateProgram(state,monday,4);
  const future=state.sessions.filter(s=>s.status==='todo');
  assert.deepEqual(future.slice(0,3).map(s=>[q.surahAt(s.start).number,s.start,s.end]),[
    [114,q.surahs[113].start,q.surahs[113].start+2],
    [114,q.surahs[113].start+3,q.surahs[113].end],
    [113,q.surahs[112].start,q.surahs[112].start+2],
  ]);
  assert(future.every(s=>q.surahAt(s.start).number===q.surahAt(s.end).number));
});

test('le parcours depuis An-Nâs atteint Al-Fatiha sans verset manquant',()=>{
  let state=p.defaultState();
  state.goal={label:'Tout le Coran',ranges:[{start:1,end:6236}],direction:'fromNas'};
  state=p.generateProgram(state,monday);
  const ids=state.sessions.flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i));
  assert.equal(ids.length,6236);
  assert.equal(new Set(ids).size,6236);
  assert.equal(q.surahAt(state.sessions[0].start).number,114);
  assert.equal(q.surahAt(state.sessions.at(-1).end).number,1);
});

test('depuis An-Nâs, les passages connus sont sautés et le rythme page garde le bon ordre',()=>{
  let state=p.defaultState();
  state.goal={label:'Tout le Coran',ranges:[{start:1,end:6236}],direction:'fromNas'};
  state.pace='page';
  state=p.markKnowledge(state,q.surahs[113],'perfect');
  state=p.generateProgram(state,monday,2);
  const future=state.sessions.filter(s=>s.status==='todo');
  assert.equal(future[0].start,q.surahs[112].start);
  assert(future.every(s=>s.end<q.surahs[113].start));
  assert(future.every((s,i)=>i===0||s.date!==future[i-1].date||q.surahAt(s.start).number<=q.surahAt(future[i-1].start).number));
  const ids=future.flatMap(s=>Array.from({length:s.end-s.start+1},(_,i)=>s.start+i));
  assert.equal(new Set(ids).size,ids.length);
});

test('changer vers un départ An-Nâs conserve les séances terminées',()=>{
  let state=p.defaultState();
  state.goal={label:'Tout le Coran',ranges:[{start:1,end:6236}],direction:'fromStart'};
  state.pace='verse5';
  state=p.generateProgram(state,monday,4);
  const first=state.sessions[0];
  state=p.completeSession(state,first.id,true,monday);
  state=p.generateProgram({...state,goal:{...state.goal,direction:'fromNas'}},monday,4);
  assert.equal(state.sessions.find(s=>s.id===first.id).status,'done');
  assert.equal(state.sessions.find(s=>s.status==='todo').start,q.surahs[113].start);
  assert(p.progress(state).goal>0);
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
