const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const annotations=require('./build/core/readerAnnotations');
const {selectionFromWords}=require('./build/coranTest/model');
const {testPageHtml}=require('./build/coranTest/html');
const {tajweedWordSpans}=require('./build/core/readerData');
const words=[{id:101,key:'1:1',text:'بِسْمِ',position:1,region:{x:.6,y:.2,width:.1,height:.025,line:1}},{id:102,key:'1:1',text:'ٱللَّهِ',position:2,region:{x:.45,y:.2,width:.12,height:.025,line:1}}];
test('selection targets the exact measured word and can expand to its verse without mutating measurements',()=>{
 const before=JSON.stringify(words),selection=selectionFromWords(words,'1:1',102);
 assert.equal(selection.wordId,102);assert.equal(selection.wordText,'ٱللَّهِ');assert.deepEqual(selection.regions,[words[1].region]);
 const verse=annotations.selectionForScope(selection,'verse');assert.equal(verse.wordId,undefined);assert.equal(verse.regions.length,1);assert.ok(verse.regions[0].width>.24);
 assert.equal(JSON.stringify(words),before);assert.equal(selectionFromWords(words,'1:1',999).wordId,undefined);assert.equal(selectionFromWords(words,'999:999',102),undefined);
});
test('marks resolve from word IDs after reflow and survive on both pages of a split verse',()=>{
 const anchor=selectionFromWords(words,'1:1',102),mark={id:'word',source:'coranTest',page:1,tool:'circle',color:'#257452',points:[],anchor};
 const reflow={x:.3,y:.5,width:.16,height:.03};assert.deepEqual(annotations.annotationRegions(mark,1,{}, {'102':reflow}),[reflow]);
 assert.deepEqual(annotations.annotationRegions(mark,2,{}, {'101':reflow}),[]);
 const verse={...mark,anchor:annotations.selectionForScope(anchor,'verse')};assert.deepEqual(annotations.annotationRegions(verse,2,{'1:1':[reflow]}),[reflow]);
 assert.deepEqual(annotations.annotationRegions(verse,2,{}),[]);
});
test('tapping an annotated word opens its own note before an overlapping verse note',()=>{
 const anchor=selectionFromWords(words,'1:1',102),word={id:'word',source:'coranTest',page:1,tool:'highlight',color:'#257452',points:[],anchor};
 const verse={...word,id:'verse',anchor:annotations.selectionForScope(anchor,'verse')},regions={'1:1':verse.anchor.regions};
 assert.equal(annotations.annotationAtPoint([verse,word],{x:.5,y:.21},1,regions,{'102':words[1].region}),'word');
 assert.equal(annotations.annotationAtPoint([verse,word],{x:.9,y:.21},1,regions,{'102':words[1].region}),undefined);
});
test('a saved handwritten comment and its mark survive serialization, while deletion removes the mark',()=>{
 const note={id:'word',source:'coranTest',page:1,tool:'circle',color:'#257452',points:[],anchor:selectionFromWords(words,'1:1',102),text:'À revoir',handwriting:[{color:'#257452',points:[{x:.2,y:.3},{x:.4,y:.5}]}],updatedAt:'2026-11-19T10:00:00Z'};
 const restored=JSON.parse(JSON.stringify({word:note}));assert.deepEqual(restored.word.handwriting,note.handwriting);
 assert.equal(annotations.annotationForSelection(restored,'coranTest',note.anchor).id,'word');assert.equal(annotations.annotationForSelection(restored,'tajweed',note.anchor),undefined);
 const marks=annotations.annotationMarks(restored,'coranTest');assert.equal(marks.length,1);assert.equal(marks[0].text,undefined);assert.equal(marks[0].handwriting,undefined);
 restored.word.deletedAt='now';assert.deepEqual(annotations.annotationMarks(restored,'coranTest'),[]);
 assert.ok(Date.parse(annotations.annotationTime('2099-01-01T00:00:00Z'))>Date.parse('2099-01-01T00:00:00Z'));
});
test('simplified reader groups colour boundaries within one real word',()=>{
 const result=tajweedWordSpans([{text:'بِسْ',rule:null},{text:'مِ ',rule:'madd'},{text:'ٱللَّهِ الرَّحْمَٰنِ',rule:null}]);
 assert.deepEqual(result.map(w=>w.text),['بِسْمِ','ٱللَّهِ','الرَّحْمَٰنِ']);assert.equal(result[0].spans.length,2);assert.equal(result[0].spans[1].rule,'madd');assert.deepEqual(result.map(w=>w.index),[0,1,2]);
});

function renderer(paperLeft=0){
 const page={page:1,surah:1,juz:1,fontSize:70,lines:[]};const html=testPageHtml(page,{page:'data:font/woff2;base64,AA==',title:'data:font/woff2;base64,AA==',basmala:'data:font/woff2;base64,AA=='});
 const script=html.match(/<script>([\s\S]*)<\/script>/)[1],messages=[],handlers={},timers=new Map();let clock=1000,sequence=0,ready;
 const node=()=>({style:{},attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];}});
 const paper={...node(),getBoundingClientRect:()=>({left:paperLeft,top:0,width:1000,height:2120})},overlay=node(),notes=node();
 const elements=words.map(w=>({...node(),dataset:{id:String(w.id),verse:w.key,position:String(w.position)},parentElement:{dataset:{line:String(w.region.line)}},getAttribute:k=>k==='aria-label'?w.text:null,getBoundingClientRect:()=>({left:paperLeft+w.region.x*1000,top:w.region.y*2120,width:w.region.width*1000,height:w.region.height*2120}),closest(selector){return selector==='.word'?this:null;}}));
 const document={getElementById:id=>({paper,'verse-overlay':overlay,'note-overlay':notes})[id]??null,createElement:node,createElementNS:node,querySelectorAll:()=>elements,body:node(),documentElement:node(),fonts:{ready:{then(fn){ready=fn;return {catch(){}};}}},elementFromPoint:(x,y)=>elements.find(w=>{const r=w.getBoundingClientRect();return x>=r.left&&x<=r.left+r.width&&y>=r.top&&y<=r.top+r.height;})};
 const window={ReactNativeWebView:{postMessage:s=>messages.push(JSON.parse(s))},parent:{}};
 const context={requestAnimationFrame:()=>1,document,window,innerWidth:1000,innerHeight:2120,Date:{now:()=>clock},setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,time:clock+delay});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn);}};
 vm.runInNewContext(script,context);ready();const state={enabled:true,bookmarks:[],difficulty:[],session:[],primary:'#257452',selection:'#eeeeee',gold:'#dddddd',annotations:[]};window.applyReaderState(state);
 const event=(name,values={})=>{let stopped=false;const e={pointerType:'mouse',pointerId:1,clientX:500,clientY:445,target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){stopped=true;},...values};for(const fn of handlers[name]??[]){if(stopped)break;fn(e);}};
 const advance=ms=>{clock+=ms;for(const [id,t] of timers)if(t.time<=clock){timers.delete(id);t.fn();}};
 return {event,advance,messages,notes,apply:annotations=>window.applyReaderState({...state,annotations}),settings:(ink,workspace=false)=>window.applyReaderState({...state,ink,workspace}),state:values=>window.applyReaderState({...state,...values}),read:code=>vm.runInNewContext(code,context)};
}
test('the actual page sends a word-specific long press and never follows it with a tap',()=>{
 const r=renderer();r.event('pointerdown');r.advance(450);r.event('pointerup');r.advance(300);
 assert.equal(r.messages.filter(m=>m.type==='longpress').length,1);assert.equal(r.messages.find(m=>m.type==='longpress').wordId,102);assert.equal(r.messages.some(m=>m.type==='tap'),false);
});
test('scroll and pinch cancel word selection instead of creating accidental notes',()=>{
 const r=renderer();r.event('pointerdown');r.event('pointermove',{clientX:650});r.advance(500);r.event('pointerup',{clientX:650});
 assert.equal(r.messages.some(m=>m.type==='longpress'),false);
 r.event('touchstart',{touches:[{clientX:500,clientY:445}]});r.event('touchstart',{touches:[{clientX:500,clientY:445},{clientX:600,clientY:445}]});r.advance(500);r.event('touchend',{touches:[],changedTouches:[{clientX:500,clientY:445}]});
 assert.equal(r.messages.some(m=>m.type==='longpress'),false);
});
test('persistent HTML marks reopen the attached note and disappear when it is deleted',()=>{
 const r=renderer(),anchor=selectionFromWords(words,'1:1',102),mark={id:'saved',source:'coranTest',page:1,tool:'circle',color:'#257452',points:[],anchor};
 r.apply([mark]);assert.equal(r.notes.children.length,1);assert.equal(Number(r.notes.children[0].attrs.rx),67);
 r.event('pointerdown');r.event('pointerup');r.advance(300);assert.equal(r.messages.find(m=>m.type==='tap').annotationId,'saved');
 r.apply([]);assert.equal(r.notes.children.length,0);r.event('pointerdown');r.event('pointerup');r.advance(300);assert.equal(r.messages.filter(m=>m.type==='tap').at(-1).annotationId,undefined);
});


test('actual HTML pen drawing records normalized pressure samples without accidental word selection',()=>{
 const r=renderer();r.settings({enabled:true,tool:'pen',color:'#16A34A',width:.003,stylusOnly:true,penStyle:'ink'});
 r.event('pointerdown',{pointerType:'pen',pressure:.3});r.event('pointermove',{pointerType:'pen',clientX:600,clientY:500,pressure:.8});r.event('pointerup',{pointerType:'pen'});r.advance(600);
 const commits=r.messages.filter(m=>m.type==='ink-commit');assert.equal(commits.length,1);assert.equal(commits[0].stroke.points[0].pressure,.3);assert.equal(commits[0].stroke.points[1].x,.6);assert.equal(r.messages.some(m=>m.type==='longpress'||m.type==='tap'||m.type==='swipe'),false);
 assert.ok(r.messages.some(m=>m.type==='ink-capability'&&m.pressure));
});
test('stylus-only refuses finger drawing; opt-in finger pinch cancels the incomplete stroke',()=>{
 const r=renderer(),settings={enabled:true,tool:'highlight',color:'#EAB308',width:.018,stylusOnly:true};r.settings(settings);
 r.event('pointerdown',{pointerType:'touch'});r.event('pointermove',{pointerType:'touch',clientX:600});r.event('pointerup',{pointerType:'touch'});assert.equal(r.messages.some(m=>m.type==='ink-commit'),false);
 r.settings({...settings,stylusOnly:false});r.event('pointerdown',{pointerType:'touch'});r.event('touchstart',{touches:[{clientX:400,clientY:400},{clientX:600,clientY:400}]});r.event('pointerup',{pointerType:'touch'});assert.equal(r.messages.some(m=>m.type==='ink-commit'),false);assert.equal(r.read('liveInk'),null);
});
test('palm touches during a pen stroke do not zoom or cancel its vector path',()=>{
 const r=renderer();r.settings({enabled:true,tool:'circle',color:'#DC2626',width:.003,stylusOnly:true});r.event('pointerdown',{pointerType:'pen'});
 r.event('pointerdown',{pointerType:'touch',pointerId:2});r.event('touchstart',{touches:[{clientX:400,clientY:400},{clientX:600,clientY:400}]});assert.equal(r.read('zoom'),1);
 r.event('pointermove',{pointerType:'pen',clientX:600,clientY:500});r.event('pointerup',{pointerType:'pen'});assert.equal(r.messages.filter(m=>m.type==='ink-commit').length,1);
});


test('actual page accepts a handwritten arrow in the white margin, restores it and opens its note',()=>{
 const r=renderer(400);r.settings({enabled:true,tool:'arrow',color:'#16A34A',width:.003,stylusOnly:true},true);
 r.event('pointerdown',{pointerType:'pen',clientX:200,pressure:.6});r.event('pointermove',{pointerType:'pen',clientX:900,clientY:500,pressure:.8});r.event('pointerup',{pointerType:'pen'});
 const commit=r.messages.find(m=>m.type==='ink-commit');assert.ok(commit);assert.equal(commit.stroke.points[0].x,-.2);assert.equal(commit.stroke.points[1].x,.5);assert.equal(commit.stroke.related,undefined);
 const mark={...commit.stroke,source:'coranTest',page:1};r.state({workspace:true,annotations:[mark]});assert.equal(r.notes.children.length,1);assert.match(r.notes.children[0].attrs.d,/M-200,/);
 r.event('pointerdown',{clientX:200});r.event('pointerup',{clientX:200});r.advance(350);assert.equal(r.messages.filter(m=>m.type==='tap').at(-1).annotationId,mark.id);
});
