const test=require('node:test');
const assert=require('node:assert/strict');
const {frenchVerse,tajweedVerse,tajweedSpans,verseAtImagePoint}=require('./build/core/readerData.js');
const {verseAt,verseId,pageRange,hizbs,juzs}=require('./build/core/quran.js');
const {defaultState,markKnowledge,goalIsAlreadyKnown}=require('./build/core/program.js');
const bounds=require('../src/data/bounds.json');

test('la traduction et le Tajweed couvrent exactement les références Hafs',()=>{
  for(let id=1;id<=6236;id++){
    const verse=verseAt(id),french=frenchVerse(id),tajweed=tajweedVerse(id);
    assert.equal(french.surah,verse.surah);
    assert.equal(french.ayah,verse.ayah);
    assert.ok(french.translation.length>0);
    assert.equal(tajweedSpans(id).map(span=>span.text).join(''),tajweed.text);
  }
});

test('l’appui long sur une zone vérifiée pointe le bon verset',()=>{
  const first=bounds['604'][0],x=(first[3]+first[4])/2,y=(first[5]+first[6])/2;
  assert.equal(verseAtImagePoint(bounds['604'],x,y,1920,3106),verseId(first[0],first[1]));
  assert.equal(verseAtImagePoint(bounds['604'],0,0,1920,3106),null);
  assert.deepEqual(pageRange(604),{start:verseId(112,1),end:verseId(114,6)});
});

test('un Juz Amma connu exclut Sabbih et Amma, mais pas le Coran complet',()=>{
  const state=markKnowledge(defaultState(),juzs[29],'perfect');
  assert.equal(goalIsAlreadyKnown(state,'sabbih'),true);
  assert.equal(goalIsAlreadyKnown(state,'amma'),true);
  assert.equal(goalIsAlreadyKnown(state,'all'),false);
  const sabbih=markKnowledge(defaultState(),hizbs[59],'perfect');
  assert.equal(goalIsAlreadyKnown(sabbih,'sabbih'),true);
  assert.equal(goalIsAlreadyKnown(sabbih,'amma'),false);
});
