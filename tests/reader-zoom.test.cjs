const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {constrainReaderZoom,zoomReaderAt}=require('./build/core/readerZoom');
const {quranPaperOptions,quranPaperColor}=require('./build/core/readerAppearance');
const {migrateReaderState,defaultState}=require('./build/core/program');
const {testPageHtml}=require('./build/coranTest/html');
test('zoom conserve le point visé et borne le déplacement sans déformation',()=>{
 const z=zoomReaderAt({scale:1,x:0,y:0},2,150,250,400,800);
 assert.deepEqual(z,{scale:2,x:-150,y:-250});assert.equal((150-z.x)/z.scale,150);assert.equal((250-z.y)/z.scale,250);
 assert.deepEqual(zoomReaderAt(z,1,150,250,400,800),{scale:1,x:0,y:0});assert.deepEqual(constrainReaderZoom(8,-5000,50,400,800),{scale:3,x:-800,y:0});
});
test('fond mémorisé conservé lors de la migration et après sérialisation',()=>{
 for(const option of quranPaperOptions){const state={...defaultState(),reader:{mushaf:'tajweedPages',followAudio:false,paper:option.key}};const restored=migrateReaderState(JSON.parse(JSON.stringify(state)));assert.equal(restored.reader.paper,option.key);assert.equal(restored.reader.followAudio,false);assert.equal(quranPaperColor(restored.reader.paper),option.color);}
 assert.equal(quranPaperColor('unknown'),quranPaperColor('ivory'));
});
async function renderer(){
 const page=JSON.parse(fs.readFileSync('src/coranTest/data/10.json','utf8')),html=testPageHtml(page,{page:'data:font/woff2;base64,AA==',title:'data:font/woff2;base64,AA==',basmala:'data:font/woff2;base64,AA=='});
 const listeners={},messages=[],timers=new Map();let now=1000;
 const paper={style:{},getBoundingClientRect(){const scale=Number(this.style.transform?.match(/scale\(([^)]+)\)/)?.[1]??1);return {left:parseFloat(this.style.left??0),top:parseFloat(this.style.top??0),width:1000*scale,height:2120*scale};}};
 const overlay={style:{},replaceChildren(){},appendChild(){}};
 const word={dataset:{id:'1',verse:'2:66'},parentElement:{dataset:{line:'8'}},getBoundingClientRect(){const p=paper.getBoundingClientRect();return {left:p.left+p.width*.4,top:p.top+p.height*.3,width:p.width*.2,height:p.height*.04};}};
 const document={getElementById:id=>id==='paper'?paper:id==='verse-overlay'?overlay:null,querySelectorAll:()=>[word],fonts:{ready:Promise.resolve()},body:{style:{}},documentElement:{style:{}},createElement:()=>({style:{}}),createElementNS:()=>({style:{},setAttribute(){},appendChild(){}})};
 const context=vm.createContext({document,innerWidth:500,innerHeight:1000,Math,Number,Object,JSON,Date:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(fn,ms);return fn;},clearTimeout:fn=>timers.delete(fn),window:{ReactNativeWebView:{postMessage:message=>messages.push(JSON.parse(message))}},addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);}});
 vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1],context);await new Promise(resolve=>setImmediate(resolve));
 vm.runInContext(`window.applyReaderState({enabled:true,selecting:true,playing:'2:66',selected:null,bookmarks:[],difficulty:[],session:[],primary:'#123456',selection:'#abcdef',gold:'#654321',background:'#f5e1e7'})`,context);
 const emit=(name,event)=>listeners[name]?.forEach(fn=>fn(event));
 const center=()=>{const r=word.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
 const tap=()=>{const p=center();emit('pointerdown',{pointerType:'mouse',clientX:p.x,clientY:p.y});emit('pointerup',{pointerType:'mouse',clientX:p.x,clientY:p.y});};
 return {context,paper,document,word,messages,timers,emit,center,tap,tick:n=>now+=n,read:s=>vm.runInContext(s,context)};
}
test('double toucher : zoom/reset, sélection au bon verset et fond sans modifier les glyphes',async()=>{
 const c=await renderer();c.tap();c.tick(100);c.tap();assert.equal(c.read('zoom'),2);assert.equal(c.messages.filter(m=>m.type==='tap').length,0);
 let p=c.center();assert.equal(c.read(`hit(${p.x},${p.y})`),'2:66');assert.equal(c.paper.style.backgroundColor,'#f5e1e7');assert.equal(c.document.body.style.backgroundColor,'#f5e1e7');
 c.tick(400);c.tap();c.tick(100);c.tap();assert.equal(c.read('zoom'),1);
});
test('pincement puis déplacement : pas de changement de page ni sélection accidentelle',async()=>{
 const c=await renderer();const t=(x,y)=>({clientX:x,clientY:y});c.emit('touchstart',{touches:[t(200,400),t(300,400)]});c.emit('touchmove',{touches:[t(100,400),t(400,400)]});assert.equal(c.read('zoom'),3);
 c.emit('touchend',{touches:[],changedTouches:[t(400,400)]});c.emit('pointerdown',{pointerType:'mouse',clientX:250,clientY:400});c.emit('pointermove',{pointerType:'mouse',clientX:350,clientY:500});c.emit('pointerup',{pointerType:'mouse',clientX:350,clientY:500});assert.equal(c.messages.filter(m=>m.type==='swipe'||m.type==='tap').length,0);
 const p=c.center();assert.equal(c.read(`hit(${p.x},${p.y})`),'2:66');
});
test('le swipe continue de changer de page à taille normale',async()=>{
 const c=await renderer();c.emit('pointerdown',{pointerType:'mouse',clientX:250,clientY:400});c.emit('pointermove',{pointerType:'mouse',clientX:350,clientY:400});c.emit('pointerup',{pointerType:'mouse',clientX:350,clientY:400});assert.equal(c.messages.filter(m=>m.type==='swipe').length,1);
});
