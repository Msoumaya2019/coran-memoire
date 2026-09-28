const test=require('node:test'),assert=require('node:assert/strict');
const {defaultState,migrateReaderState,accountState}=require('./build/core/program.js');
const {reciters,defaultReciter,verseAudioUrl}=require('./build/core/audio.js');
const {verseAt}=require('./build/core/quran.js');
test('ancienne source migrée sans toucher aux données et préférences du compte',()=>{
 const old={...defaultState(),userId:'u',reader:{mushaf:'tajweedPages',followAudio:false,testPage:10},theme:'feminine',audioPreferences:{reciterId:'ar.dussary'},lastRead:{verseId:69,page:10,readAt:'2026-09-28'},knowledge:{'69':'perfect'}};
 const next=migrateReaderState(old);assert.equal(next.reader.mushaf,'coranTest');assert.equal(next.reader.followAudio,false);assert.equal(next.reader.testPage,10);assert.deepEqual(next.audioPreferences,old.audioPreferences);assert.equal(next.knowledge,old.knowledge);assert.deepEqual(next.lastRead,old.lastRead);
 assert.equal(migrateReaderState(next),next);assert.equal(accountState('u',null,JSON.parse(JSON.stringify(old))).state.reader.mushaf,'coranTest');assert.equal(accountState('u',null,old).shouldPush,true);assert.equal(accountState('u',{...next,updatedAt:'2026-09-20'}, {...old,updatedAt:'2026-09-28'}).shouldPush,true);
 for(const mode of ['traditional','tajweed','coranTest']){const state={...next,reader:{...next.reader,mushaf:mode}};assert.equal(migrateReaderState(state),state);}
});
test('chaque nouveau réciteur possède 6236 URL de fichiers distincts sans timestamps partagés',()=>{
 assert.equal(defaultReciter.id,'ar.shaatree');
 for(const reciter of reciters.slice(4)){
  const urls=new Set();for(let id=1;id<=6236;id++){const v=verseAt(id);const url=verseAudioUrl(id,reciter);assert.equal(url,`https://everyayah.com/data/${reciter.verseFolder}/${String(v.surah).padStart(3,'0')}${String(v.ayah).padStart(3,'0')}.mp3`);urls.add(url);}assert.equal(urls.size,6236);
 }
 assert.equal(new Set(reciters.slice(4).map(r=>verseAudioUrl(1,r))).size,3);
});
