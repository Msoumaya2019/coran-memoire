const test=require('node:test');
const assert=require('node:assert/strict');
const {accountState,defaultState}=require('./build/core/program.js');

test('un nouveau compte ne reprend jamais les connaissances du compte précédent',()=>{
  const old={...defaultState(),userId:'old',knowledge:{'6236':'perfect'},updatedAt:'2026-09-24T12:00:00.000Z'};
  const result=accountState('new',old,null);
  assert.deepEqual(result.state.knowledge,{});
  assert.equal(result.state.userId,'new');
  assert.equal(result.shouldPush,true);
});

test('la reconnexion retrouve uniquement les données de ce compte',()=>{
  const own={...defaultState(),userId:'member',knowledge:{'6236':'perfect'},updatedAt:'2026-09-24T12:00:00.000Z'};
  assert.equal(accountState('member',own,null).state.knowledge['6236'],'perfect');
  assert.deepEqual(accountState('other',own,null).state.knowledge,{});
});

test('un téléphone neuf restaure le programme terminé et le récitateur du compte',()=>{
 const remote={...defaultState(),userId:'member',onboardingDone:true,audioPreferences:{reciterId:'ar.alafasy'},knowledge:{'6236':'perfect'},updatedAt:'2026-09-24T12:00:00.000Z'};
 const restored=accountState('member',null,remote).state;
 assert.equal(restored.onboardingDone,true);assert.equal(restored.audioPreferences.reciterId,'ar.alafasy');assert.equal(restored.knowledge['6236'],'perfect');
});
test('un onboarding interrompu reprend son étape et ses informations',()=>{
 const remote={...defaultState(),userId:'member',onboardingDone:false,onboardingStep:3,profile:{firstName:'Karim'},updatedAt:'2026-09-24T12:00:00.000Z'};
 const restored=accountState('member',null,remote).state;
 assert.equal(restored.onboardingStep,3);assert.equal(restored.profile.firstName,'Karim');assert.equal(restored.onboardingDone,false);
});
