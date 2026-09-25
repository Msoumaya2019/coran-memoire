const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeArabic}=require('./build/services/recitationRecognition/normalization.js');
const {alignWords}=require('./build/services/recitationRecognition/alignment.js');
const {PassageTracker}=require('./build/services/recitationRecognition/tracker.js');

test('normalise les signes sans modifier le texte affiché',()=>{
  assert.equal(normalizeArabic('ٱلرَّحْمَٰنِ'),'الرحمن');
  assert.equal(normalizeArabic('إِيَّاكَ'),'اياك');
});

test('ne signale un mot omis que lorsque des mots suivants sont reconnus',()=>{
  const expected=['بسم','الله','الرحمن','الرحيم'];
  assert.deepEqual(alignWords(expected,expected,true),['recognized','recognized','recognized','recognized']);
  assert.deepEqual(alignWords(expected,['بسم','الرحمن','الرحيم'],true),['recognized','omitted','recognized','recognized']);
  assert.equal(alignWords(expected,[],true).every(state=>state==='uncertain'),true);
});

test('tolère une répétition et une pause avant de conclure',()=>{
  const expected=['بسم','الله','الرحمن'];
  const repeated=alignWords(expected,['بسم','بسم','الله','الرحمن'],true);
  assert.equal(repeated.filter(state=>state==='recognized').length,3);
  const live=alignWords(expected,['بسم'],false);
  assert.equal(live[2],'pending');
});

test('conserve un verset sauté comme incertain sans preuve suffisante',()=>{
  const tracker=new PassageTracker({start:1,end:2});
  tracker.accept({type:'verse_match',verseId:2,confidence:0.8});
  const before=tracker.snapshot()[0].states;
  assert.equal(before.every(state=>state==='pending'),true);
  tracker.finish();
  assert.equal(tracker.snapshot()[0].states.every(state=>state==='uncertain'),true);
});
