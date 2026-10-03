const {test}=require('node:test'),assert=require('node:assert/strict');
const {marginAnnotations}=require('./build/core/marginAnnotations');
const {readerOverlayState}=require('./build/coranTest/model');
const {defaultState,reconcileState}=require('./build/core/program');
const {mergeOfflineState}=require('./build/core/offlineMerge');
const region=(id,ayah,line,y)=>Object.freeze({id,ayah,line,y,x:.12,width:.76,height:.04});
test('margin anchors use the beginning of multiline verses and never mutate page coordinates',()=>{
 const rows=Object.freeze([region(50,43,2,.15),region(50,43,3,.21),region(51,44,4,.3),region(52,45,5,.4)]);
 const result=marginAnnotations(rows,50,51,50);
 assert.equal(result.length,2);assert.equal(result[0].y,.15);assert.equal(result[0].bottom,.25);assert.deepEqual(result[0].items,[{id:50,ayah:43,done:true}]);assert.equal(result[1].items[0].done,false);assert.equal(rows[0].x,.12);
});
test('same line groups include every number; cross surah progress uses canonical IDs',()=>{
 const result=marginAnnotations([region(3429,88,7,.5),region(3430,1,7,.5),region(3431,2,8,.6)],3429,3431,3430);
 assert.deepEqual(result[0].items,[{id:3429,ayah:88,done:true},{id:3430,ayah:1,done:true}]);assert.equal(result[1].items[0].done,false);
});
test('pages outside a programme have no markers; one verse produces one anchor',()=>{
 assert.deepEqual(marginAnnotations([region(10,3,1,.1)],20,30),[]);
 assert.equal(marginAnnotations([region(20,13,1,.1)],20,20).length,1);
});
test('programme bridge retains the full planned range and explicit validated endpoint',()=>{
 const state=readerOverlayState({playingVerseId:null,sessionRange:{start:50,end:56},sessionThrough:52,showSession:true,primary:'#7B285C',selection:'#F5EDF2',gold:'#C89A52'});
 assert.equal(state.session.length,7);assert.equal(state.sessionDone,3);assert.equal(state.playing,null);
});
test('white theme and accent survive account serialization and an older remote schema',()=>{
 const local={...defaultState(),userId:'owner',accent:'gold',updatedAt:'2026-10-03T10:00:00Z'},remote={...local,updatedAt:'2026-10-03T11:00:00Z'};delete remote.accent;
 const restored=reconcileState(JSON.parse(JSON.stringify(local)),remote).state;
 assert.equal(restored.theme,'white');assert.equal(restored.accent,'gold');
 const base={...local,readPages:[1]},a={...base,readPages:[1,2]},b={...base,readPages:[1,3]};assert.deepEqual(mergeOfflineState(base,a,b).readPages,[1,2,3]);
});


test('interface font survives serialization, older remote responses, and explicit progress reset',()=>{
 const {resetAllProgress}=require('./build/core/program');
 const local={...defaultState(),uiFont:'system',updatedAt:'2026-10-03T10:00:00Z'},remote={...local,updatedAt:'2026-10-03T11:00:00Z'};delete remote.uiFont;
 const restored=reconcileState(JSON.parse(JSON.stringify(local)),remote);
 assert.equal(restored.state.uiFont,'system');assert.equal(restored.shouldPush,true);assert.equal(resetAllProgress(local).uiFont,'system');
});
