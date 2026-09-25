const test=require('node:test');
const assert=require('node:assert/strict');
const {parseQcfV4Page}=require('./build/core/qcfV4.js');
const {verseId}=require('./build/core/quran.js');
const {qcfV4Html}=require('./build/core/qcfV4Html.js');
const {ayahMarkerHtml,easternArabicNumber}=require('./build/core/ayahMarker.js');

const page={pagination:{total_pages:1},verses:[
  {verse_key:'2:6',words:[{position:1,page_number:3,line_number:1,char_type_name:'word',code_v2:'ﱁ',text_qpc_hafs:'إِنَّ'},{position:2,page_number:3,line_number:2,char_type_name:'end',text_qpc_hafs:'٦'}]},
  {verse_key:'2:7',words:[{position:1,page_number:3,line_number:2,char_type_name:'word',code_v2:'ﱂ',text_qpc_hafs:'خَتَمَ'}]},
]};

test('le rendu QCF V4 conserve les versets distincts sur une même ligne',()=>{
  const parsed=parseQcfV4Page(3,page);
  assert.equal(parsed.firstVerseId,verseId(2,6));
  assert.equal(parsed.lastVerseId,verseId(2,7));
  assert.deepEqual(parsed.lines[1].words.map(word=>word.verseKey),['2:6','2:7']);
  const html=qcfV4Html(parsed,verseId(2,7),[verseId(2,6)],0,0);
  assert.ok(html.includes(`data-verse="${verseId(2,7)}"`));
  assert.match(html,/class="word playing"/);
  assert.match(html,/class="word difficult"/);
  assert.match(html,/data-verse-key="2:6"><svg class="ayah-ornament"/);
  assert.match(html,/>٦<\/text><\/svg>/);
  assert.match(html,/\.end\.playing,\.end\.difficult\{background:transparent/);
});

test('le médaillon utilise le numéro réel du verset avec un, deux ou trois chiffres',()=>{
  assert.equal(easternArabicNumber(1),'١');
  assert.equal(easternArabicNumber(10),'١٠');
  assert.equal(easternArabicNumber(255),'٢٥٥');
  assert.match(ayahMarkerHtml('2:255'),/>٢٥٥<\/text>/);
  assert.throws(()=>ayahMarkerHtml('2:<script>'),/invalide/);
});

test('une réponse paginée ou issue d’une autre édition est rejetée',()=>{
  assert.throws(()=>parseQcfV4Page(3,{...page,pagination:{total_pages:2}}),/incomplète/);
  assert.throws(()=>parseQcfV4Page(4,page),/Aucun mot/);
  assert.throws(()=>parseQcfV4Page(3,{...page,verses:[page.verses[0],{...page.verses[1],verse_key:'2:8'}]}),/manquants/);
});

test('un verset à cheval sur deux pages ne transporte pas ses mots sur la mauvaise page',()=>{
  const split={pagination:{total_pages:1},verses:[{verse_key:'2:6',words:[
    {position:1,page_number:2,line_number:15,char_type_name:'word',code_v2:'ﱁ'},
    {position:2,page_number:3,line_number:1,char_type_name:'word',code_v2:'ﱂ'},
  ]}]};
  const parsed=parseQcfV4Page(3,split);
  assert.equal(parsed.lines[0].words.length,1);
  assert.equal(parsed.lines[0].words[0].position,2);
});
