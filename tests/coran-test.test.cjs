const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./build/coranTest/model');
const {testPageHtml}=require('./build/coranTest/html');
const root=path.resolve(__dirname,'..');
const page=p=>JSON.parse(fs.readFileSync(path.join(root,`src/coranTest/data/${p}.json`),'utf8'));

test('604 original pages cover every original word exactly once and all 6236 ayat',()=>{
 const seen=new Set(),keys=new Set();
 for(let p=1;p<=604;p++){
  const data=page(p);assert.equal(data.page,p);assert.ok(data.lines.length>0);
  const font=fs.readFileSync(path.join(root,`assets/coran-test/${p}.woff2`));assert.equal(font.subarray(0,4).toString(),'wOF2');
  for(const line of data.lines)for(const word of line.words){
   assert.ok(!seen.has(word[0]),`duplicate word ${word[0]}`);seen.add(word[0]);
   const key=`${word[1]}:${word[2]}`;keys.add(key);assert.ok(model.verseIndex[key].pages.includes(p));assert.ok(word[4]);assert.ok(word[5]);
  }
 }
 assert.equal(seen.size,83668);assert.equal(keys.size,6236);assert.equal(Object.keys(model.verseIndex).length,6236);
});
test('Al Baqarah 66 retains two original lines on page 10',()=>{
 assert.deepEqual(model.verseIndex['2:66'].pages,[10]);
 assert.deepEqual(model.verseIndex['2:66'].lines,[[10,8],[10,9]]);
 assert.equal(page(10).lines.length,15);
});
test('verse regions merge words on the same line without merging different lines',()=>{
 const regions=model.verseRegions([
  {id:1,key:'2:66',region:{x:.6,y:.3,width:.1,height:.02,line:8}},
  {id:2,key:'2:66',region:{x:.4,y:.3,width:.15,height:.02,line:8}},
  {id:3,key:'2:66',region:{x:.1,y:.4,width:.2,height:.02,line:9}},
 ]);
 assert.equal(regions['2:66'].length,2);assert.equal(regions['2:66'][0].x,.4);
 assert.ok(Math.abs(regions['2:66'][0].width-.3)<1e-10);
 assert.equal(regions['2:66'][1].line,9);
});
test('neighbor preloading stays within the original page range',()=>{
 assert.deepEqual(model.adjacentTestPages(1),[1,2]);assert.deepEqual(model.adjacentTestPages(10),[9,10,11]);assert.deepEqual(model.adjacentTestPages(604),[603,604]);
 assert.equal(model.validTestPage(0),false);assert.equal(model.validTestPage(605),false);
});
test('renderer contains original glyphs, invisible overlay, RTL and no visible controls',()=>{
 const html=testPageHtml(page(10),{page:'data:font/woff2;base64,AA==',title:'data:font/woff2;base64,AA==',basmala:'data:font/woff2;base64,AA=='});
 assert.match(html,/direction:rtl/);assert.match(html,/data-verse="2:66"/);assert.match(html,/verse-overlay/);assert.match(html,/visibility:hidden/);
 assert.doesNotMatch(html,/<(?:button|audio|video|nav|img)\b/);assert.match(html,/Math.min\(innerWidth\/1000,innerHeight\/2120\)/);
 for(const word of page(10).lines.flatMap(l=>l.words))assert.ok(html.includes(word[4]));
});
test('future audio adapter uses existing reciter and repeat logic',async()=>{
 const audio=await model.testAudioAdapter.resolve('2:66');assert.match(audio.url,/ar\.shaatree\/73\.mp3$/);
 const next=model.testAudioAdapter.next({start:73,end:74},{verseId:73,repetition:1},'each-verse',3);
 assert.deepEqual(next,{verseId:73,repetition:2});assert.deepEqual(model.emptyPlaybackState(),{currentVerse:null,position:null,isPlaying:false});
});
