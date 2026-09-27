const test=require('node:test'),assert=require('node:assert/strict');
const {defaultState,accountState,reconcileState}=require('./build/core/program.js');
const {saveBookmark,deleteBookmark,useBookmark,visibleBookmarks}=require('./build/core/bookmarks.js');
const {verseId,pageOf}=require('./build/core/quran.js');
test('un marque-page conserve le verset exact et survit à la sérialisation du compte',()=>{
 const id=verseId(2,2),state=saveBookmark({...defaultState(),userId:'a'},id,'2026-09-27T10:00:00Z');
 const restored=accountState('a',JSON.parse(JSON.stringify(state)),null).state;
 assert.deepEqual(visibleBookmarks(restored).map(b=>[b.surah,b.ayah,b.page,b.verseId]),[[2,2,pageOf(id),id]]);
 assert.equal(visibleBookmarks(accountState('b',restored,null).state).length,0);
});
test('plusieurs versets sur une page restent distincts et enregistrer deux fois ne crée pas de doublon',()=>{
 let s=saveBookmark(defaultState(),verseId(114,1));s=saveBookmark(s,verseId(114,5));s=saveBookmark(s,verseId(114,1));
 assert.equal(visibleBookmarks(s).length,2);
});
test('reprendre conserve le bon verset et la suppression ne revient pas après synchronisation',()=>{
 const id=verseId(2,2),saved=saveBookmark(defaultState(),id,'2026-09-27T10:00:00Z');
 const used=useBookmark(saved,id,'2026-09-27T11:00:00Z');assert.equal(used.lastRead.verseId,id);assert.equal(used.lastRead.page,pageOf(id));
 const removed=deleteBookmark(used,id,'2026-09-27T12:00:00Z');
 assert.equal(visibleBookmarks(reconcileState(removed,saved).state).length,0);
 const remote={...saved,updatedAt:'2026-09-27T13:00:00Z'};
 assert.equal(visibleBookmarks(reconcileState(removed,remote).state).length,0);
 assert.equal(reconcileState(removed,remote).shouldPush,true);
});
