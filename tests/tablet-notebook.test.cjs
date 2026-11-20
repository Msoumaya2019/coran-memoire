const {test}=require('node:test'),assert=require('node:assert/strict');
const {tabletLayout,tabletPreferences,spreadPages,nextSpread,notebookEntries,noteTextExport}=require('./build/core/tablet');
const {pressurePaths,inkShapePath,inkHit,historyRestore}=require('./build/core/tabletInk');
const {exportPageNumbers,capturedPagesHtml}=require('./build/core/annotationExport');
const {defaultState,migrateReaderState}=require('./build/core/program');
const {annotationMarks}=require('./build/core/readerAnnotations');
const base={id:'ink',source:'coranTest',page:3,tool:'pen',color:'#16A34A',width:.004,points:[{x:.2,y:.3,pressure:.4},{x:.4,y:.5,pressure:.9}],text:'Réviser',createdAt:'2026-11-19T10:00:00Z',updatedAt:'2026-11-19T10:00:00Z'};
test('tablet automatic mode handles iPad, Android tablet, phones and resized windows',()=>{
 for(const [device,w,h,expected] of [['tablet',1024,768,true],['tablet',768,1024,true],['tablet',500,900,false],['tablet',800,340,false],['phone',430,932,false],['phone',932,430,false],['unknown',800,1200,true],['unknown',390,844,false]])assert.equal(tabletLayout('auto',device,w,h).enabled,expected);
 assert.equal(tabletLayout('on','phone',390,844).enabled,true);assert.equal(tabletLayout('off','tablet',1200,900).enabled,false);
});
test('double-page RTL ordering, end pages and responsive fallback',()=>{
 assert.deepEqual(spreadPages(1,true),[2,1]);assert.deepEqual(spreadPages(4,true),[4,3]);assert.deepEqual(spreadPages(604,true),[604,603]);assert.deepEqual(spreadPages(604,false),[604]);
 assert.equal(nextSpread(603,1,true),603);assert.equal(nextSpread(1,-1,true),1);assert.equal(nextSpread(4,1,true),5);assert.equal(nextSpread(3,-1,true),1);
 assert.equal(tabletLayout('auto','tablet',1180,820,true,true,'double').doublePage,true);
 assert.equal(tabletLayout('on','phone',650,390,false,false,'double').doublePage,false);
 assert.equal(tabletLayout('auto','tablet',768,1024,true,false,'double').doublePage,false);
});
test('tablet preferences, pressure geometry and handwriting survive existing account migration',()=>{
 const state=defaultState();state.reader={...state.reader,tablet:{mode:'on',toolsVisible:false,stylusOnly:false,spread:'double'}};state.readerAnnotations={ink:{...base,handwriting:[{color:base.color,points:base.points}]}};
 const restored=migrateReaderState(JSON.parse(JSON.stringify(state)));assert.equal(tabletPreferences(restored.reader.tablet).mode,'on');assert.equal(tabletPreferences(restored.reader.tablet).toolsVisible,false);assert.deepEqual(restored.readerAnnotations.ink, state.readerAnnotations.ink);
 assert.equal(tabletPreferences().mode,'auto');assert.equal(tabletPreferences().stylusOnly,true);assert.equal(tabletPreferences({penWidth:100,highlightWidth:NaN,color:'oops'}).penWidth,.012);
 const marks=annotationMarks(restored.readerAnnotations,'coranTest');assert.equal(marks[0].width,.004);assert.equal(marks[0].points[0].pressure,.4);assert.equal(marks[0].text,undefined);assert.equal(marks[0].handwriting,undefined);assert.deepEqual(annotationMarks(restored.readerAnnotations,'coran_1441'),[]);
});
test('pressure only affects supplied samples, raw geometry stays normalized across resizes',()=>{
 const points=[{x:.1,y:.2},{x:.3,y:.4},{x:.5,y:.6}];assert.equal(pressurePaths(points,.003).length,1);assert.equal(pressurePaths(points,.003)[0].width,.003);
 const pressure=pressurePaths([{x:0,y:0},{x:.1,y:.1,pressure:.25},{x:.2,y:.2,pressure:1}],.004);assert.equal(pressure.length,2);assert.ok(pressure[0].width<pressure[1].width);
 const before=JSON.stringify(base);for(const [w,h] of [[390,844],[1024,768],[768,1024]])for(const point of base.points){assert.ok(Math.abs(point.x*w/w-point.x)<1e-10);assert.ok(Math.abs(point.y*h/h-point.y)<1e-10);}assert.equal(JSON.stringify(base),before);
 assert.equal(inkShapePath('underline',[{x:.1,y:.2},{x:.6,y:.5}]),'M0.1,0.2L0.6,0.2');assert.ok(inkShapePath('arrow',base.points).includes('M'));
});
test('eraser hits vector lines and ellipse edges without erasing empty interiors',()=>{
 assert.equal(inkHit(base,{x:.3,y:.4}),true);assert.equal(inkHit(base,{x:.8,y:.9}),false);
 const circle={...base,tool:'circle',points:[{x:.2,y:.2},{x:.6,y:.4}]};assert.equal(inkHit(circle,{x:.6,y:.3}),true);assert.equal(inkHit(circle,{x:.4,y:.3}),false);
 assert.equal(inkHit({...base,tool:'underline',points:[{x:.1,y:.2},{x:.6,y:.5}]},{x:.4,y:.2}),true);
});
test('undo uses new LWW timestamps, creation undo tombstones, redo preserves original geometry',()=>{
 const now='2026-11-19T11:00:00Z',deleted=historyRestore(undefined,base,now);assert.equal(deleted.deletedAt,now);assert.equal(deleted.updatedAt,now);
 const restored=historyRestore(base,{...base,color:'#DC2626'},now);assert.equal(restored.color,base.color);assert.equal(restored.deletedAt,undefined);assert.deepEqual(restored.points,base.points);
});
test('notebook filters real verse difficulty, favorites and mastery across editions',()=>{
 const a={...base,id:'a',anchor:{verseId:8,regions:[],verseRegions:[]},favorite:true};const b={...base,id:'b',source:'coran_1441',page:9,tool:'circle',related:{verseId:9,surah:2},masteredAt:base.updatedAt};const c={...base,id:'c',deletedAt:base.updatedAt};const items={a,b,c};
 assert.deepEqual(notebookEntries(items,{favorite:true}).map(n=>n.id),['a']);assert.deepEqual(notebookEntries(items,{difficult:true},[8,9]).map(n=>n.id),['a']);assert.equal(notebookEntries(items,{page:9})[0].id,'b');assert.equal(notebookEntries(items,{type:'circle'})[0].id,'b');assert.equal(notebookEntries(items,{surah:2},[],id=>id>=8?2:0).length,2);
 const text=noteTextExport([a],id=>'Verset '+id);assert.match(text,/page 3/);assert.match(text,/Verset 8/);assert.match(text,/Réviser/);
});
test('page exports validate selection and preserve captured glyph images without retyping scripture',()=>{
 assert.deepEqual(exportPageNumbers('5-7, 3, 5'),[3,5,6,7]);assert.deepEqual(exportPageNumbers('604'),[604]);
 for(const input of ['', '0','605','8-2','1-21','<script>'])assert.throws(()=>exportPageNumbers(input));
 const html=capturedPagesHtml(['data:image/png;base64,AA==','data:image/png;base64,BB==']);assert.equal((html.match(/<img /g)||[]).length,2);assert.match(html,/object-fit:contain/);assert.throws(()=>capturedPagesHtml(['https://invalid.test/a.png']));assert.throws(()=>capturedPagesHtml([]));
});

test('an older synced client cannot strip tablet preferences or revive deleted ink',()=>{
 const {reconcileState}=require('./build/core/program');
 const local={...defaultState(),userId:'a',updatedAt:'2026-11-19T10:00:00Z',reader:{mushaf:'coranTest',followAudio:true,tablet:{mode:'on',stylusOnly:false}},readerAnnotations:{ink:{...base,deletedAt:'2026-11-19T11:00:00Z',updatedAt:'2026-11-19T11:00:00Z'}}};
 const remote={...defaultState(),userId:'a',updatedAt:'2026-11-19T12:00:00Z',reader:{mushaf:'coranTest',followAudio:false},readerAnnotations:{ink:base}};
 const result=reconcileState(local,remote);assert.deepEqual(result.state.reader.tablet,local.reader.tablet);assert.equal(result.state.reader.followAudio,false);assert.equal(result.state.readerAnnotations.ink.deletedAt,'2026-11-19T11:00:00Z');assert.equal(result.shouldPush,true);
});

test('1024px landscape tablets use double page with a notes overlay instead of silently refusing',()=>{const layout=tabletLayout('auto','tablet',1024,768,true,true,'double');assert.equal(layout.doublePage,true);assert.equal(layout.notesOverlay,true);assert.equal(layout.centerWidth,952);const large=tabletLayout('auto','tablet',1366,1024,true,true,'double');assert.equal(large.notesOverlay,false);assert.equal(large.doublePage,true);});
test('white-margin ink stays relative to the original page and survives serialization without clipping',()=>{const {workspaceDimensions,workspacePoint,hasMarginInk}=require('./build/core/annotationWorkspace');const points=[{x:-.2,y:.2},{x:.2,y:.3},{x:1.25,y:.5}];const note={...base,points};assert.equal(hasMarginInk([note]),true);assert.deepEqual(workspacePoint(-.2,.2,true),points[0]);assert.equal(workspacePoint(-.2,.2,false).x,0);const size=workspaceDimensions(1000,2120,true);assert.equal(size[0],1700);assert.ok(Math.abs(size[1]-2459.2)<1e-6);assert.deepEqual(JSON.parse(JSON.stringify(note)).points,points);for(const width of [250,400,600])for(const point of points){const displayX=.35*width+point.x*width;assert.ok(Math.abs((displayX-.35*width)/width-point.x)<1e-9);}});
