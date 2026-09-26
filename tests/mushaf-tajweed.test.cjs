const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pageRange,verseId}=require('./build/core/quran.js');
const {fitMushafPage}=require('./build/core/readerLayout.js');
const {verseAtImagePoint}=require('./build/core/readerData.js');
const bounds=require('../src/data/mushaf-tajweed-bounds.json');
const dimensions=require('../src/data/mushaf-tajweed-dimensions.json');
const hashes=require('../src/data/mushaf-tajweed-hashes.json');

test('les 604 images Tajweed sont les originaux inchangés du paquet Quran',()=>{
 assert.equal(Object.keys(hashes).length,604);
 for(let p=1;p<=604;p++){
  const file=`page${String(p).padStart(3,'0')}.png`;
  const bytes=fs.readFileSync(path.join(__dirname,'../assets/mushaf-tajweed',file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hashes[file],file);
  assert.equal(bytes.readUInt32BE(16),dimensions[p][0],file);
  assert.equal(bytes.readUInt32BE(20),dimensions[p][1],file);
 }
});
test('chaque verset des 604 pages Tajweed possède ses propres zones exactes',()=>{
 for(let page=1;page<=604;page++){
  const [w,h]=dimensions[page],rows=bounds[page],range=pageRange(page);
  const ids=[...new Set(rows.map(r=>verseId(r[0],r[1])))].sort((a,b)=>a-b);
  assert.deepEqual(ids,Array.from({length:range.end-range.start+1},(_,i)=>range.start+i),`page ${page}`);
  for(const r of rows){
   assert.ok(r[3]>=0&&r[4]<=w&&r[5]>=0&&r[6]<=h&&r[3]<r[4]&&r[5]<r[6]);
   const x=(r[3]+r[4])/2,y=(r[5]+r[6])/2;
   assert.equal(verseAtImagePoint(rows,x,y,w,h,w,h),verseId(r[0],r[1]),`page ${page}, ${r[0]}:${r[1]}`);
  }
 }
});
test('changer vingt fois de page et de Moushaf conserve le ratio propre à chaque édition',()=>{
 for(const [availableWidth,availableHeight] of [[320,550],[375,720],[430,850],[480,700],[800,480]]){
  for(let i=0;i<20;i++)for(const page of [1,2,3,603,604]){
   const [w,h]=dimensions[page],fit=fitMushafPage(availableWidth,availableHeight,w,h);
   assert.ok(fit.width<=availableWidth&&fit.height<=availableHeight);
   assert.ok(Math.abs((fit.width-4)/(fit.height-4)-w/h)<1e-10);
  }
 }
});
