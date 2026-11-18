const {test}=require('node:test');
const assert=require('node:assert/strict');
const {paperRect,inkPoint,pageAnnotations,mergeReaderAnnotations}=require('./build/core/readerAnnotations');
const {defaultState,migrateReaderState,reconcileState,accountState,resetAllProgress}=require('./build/core/program');
const {mergeOfflineState}=require('./build/core/offlineMerge');
const annotation=(id,source='coranTest',page=1,updatedAt='2026-11-18T10:00:00Z')=>({id,source,page,updatedAt,tool:'pen',color:'#257452',points:[{x:.2,y:.3},{x:.3,y:.4}],text:''});
test('removal of Medina migrates the preference without losing progress or bookmarks',()=>{
 const old={...defaultState(),reader:{mushaf:'traditional',followAudio:false,paper:'ivory'},knowledge:{12:'perfect'},lastRead:{page:7,verseId:34,readAt:'today'},readerAnnotations:{a:annotation('a')},bookmarks:{}};
 const migrated=migrateReaderState(old);
 assert.equal(migrated.reader.mushaf,'coranTest');assert.equal(migrated.reader.followAudio,false);assert.equal(migrated.reader.paper,'ivory');
 for(const key of ['knowledge','lastRead','readerAnnotations','bookmarks'])assert.equal(migrated[key],old[key]);
 assert.equal(migrateReaderState(migrated),migrated);
 assert.equal(defaultState().reader.mushaf,'coranTest');
});
test('normalized ink keeps the same page anchor after rotation and ignores letterboxing',()=>{
 for(const [w,h] of [[450,900],[800,600],[1200,700]]){
  const rect=paperRect(w,h,1000,2120);
  const point=inkPoint(rect.x+rect.width*.25,rect.y+rect.height*.5,rect);assert.ok(Math.abs(point.x-.25)<1e-10);assert.ok(Math.abs(point.y-.5)<1e-10);
  assert.equal(inkPoint(rect.x-1,0,rect),null);
  assert.deepEqual(inkPoint(rect.x-1,rect.height*2,rect,true),{x:0,y:1});
 }
 assert.equal(inkPoint(0,0,paperRect(0,0,1000,2120)),null);
});
test('annotations are separated by edition and page, with deletion tombstones hidden',()=>{
 const items={a:annotation('a'),b:annotation('b','coran_1441'),c:annotation('c','coranTest',2),d:{...annotation('d'),deletedAt:'now'}};
 assert.deepEqual(pageAnnotations(items,'coranTest',1).map(a=>a.id),['a']);
 assert.deepEqual(pageAnnotations(items,'coran_1441',1).map(a=>a.id),['b']);
});
test('merge keeps independent marks and the newer deletion, in both directions',()=>{
 const old=annotation('a'),deleted={...old,deletedAt:'2026-11-18T11:00:00Z',updatedAt:'2026-11-18T11:00:00Z'};
 const local={a:old,b:annotation('b')},remote={a:deleted,c:annotation('c')};
 assert.deepEqual(mergeReaderAnnotations(local,remote),mergeReaderAnnotations(remote,local));
 const merged=mergeReaderAnnotations(local,remote);assert.ok(merged.a.deletedAt);assert.equal(Object.keys(merged).length,3);
 const tied={...old,deletedAt:'now'};assert.ok(mergeReaderAnnotations({a:tied},{a:old}).a.deletedAt);assert.ok(mergeReaderAnnotations({a:old},{a:tied}).a.deletedAt);
});
test('reconciliation keeps ink from both devices even when the remote state is newer',()=>{
 const local={...defaultState(),userId:'u',updatedAt:'2026-11-18T10:00:00Z',readerAnnotations:{a:annotation('a')}};
 const remote={...local,updatedAt:'2026-11-18T12:00:00Z',readerAnnotations:{b:annotation('b')}};
 for(const [a,b] of [[local,remote],[remote,local]])assert.equal(Object.keys(reconcileState(a,b).state.readerAnnotations).length,2);
 assert.ok(reconcileState(local,remote).shouldPush);
 assert.equal(accountState('another',local,null).state.readerAnnotations,undefined);
 assert.equal(resetAllProgress(local).readerAnnotations,local.readerAnnotations);
});
test('offline replay resolves complete annotation records and retains deletion tombstones',()=>{
 const base={...defaultState(),userId:'u',readerAnnotations:{a:annotation('a')}};
 const local={...base,readerAnnotations:{a:{...annotation('a'),text:'old offline edit',updatedAt:'2026-11-18T10:30:00Z'}}};
 const remote={...base,readerAnnotations:{a:{...annotation('a'),deletedAt:'2026-11-18T11:00:00Z',updatedAt:'2026-11-18T11:00:00Z'},b:annotation('b')}};
 const merged=mergeOfflineState(base,local,remote);assert.ok(merged.readerAnnotations.a.deletedAt);assert.equal(merged.readerAnnotations.a.text,'');assert.ok(merged.readerAnnotations.b);
});
