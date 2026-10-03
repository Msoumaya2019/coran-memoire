const {test}=require('node:test'),assert=require('node:assert/strict');
const {QuranSourceTransition}=require('./build/core/quranSourceTransition');
test('each reader mode keeps its current page and session while waiting for source readiness',async()=>{
 for(const mode of ['reading','learning','revision','consolidation'])for(const [old,next] of [['traditional','coranTest'],['coranTest','traditional']]){
  const context={mode,id:'same-session',through:3428},state={source:old,page:396,context};let resolve;const waiting=new Promise(r=>resolve=r),events=[];
  const tx=new QuranSourceTransition(),pending=tx.change(next,state.page,async(source,page)=>{events.push(['prepare',source,page]);await waiting;},(source,page)=>{events.push(['commit',source,page]);state.source=source;});
  assert.equal(state.source,old);assert.equal(state.page,396);assert.equal(await tx.change(old,397,async()=>{},()=>assert.fail('concurrent commit')),false);
  resolve();await pending;assert.equal(state.source,next);assert.equal(state.page,396);assert.equal(state.context,context);assert.deepEqual(events,[['prepare',next,396],['commit',next,396]]);
 }
});
test('failed readiness leaves old source and context intact; retry can commit',async()=>{
 const tx=new QuranSourceTransition();let source='traditional';await assert.rejects(tx.change('coranTest',396,async()=>{throw Error('unavailable');},s=>source=s));assert.equal(source,'traditional');await tx.change('coranTest',396,async()=>{},s=>source=s);assert.equal(source,'coranTest');
});
test('closing the reader invalidates pending source commits',async()=>{
 const tx=new QuranSourceTransition();let done;const pending=tx.change('coranTest',396,()=>new Promise(r=>done=r),()=>assert.fail('late commit'));tx.dispose();done();assert.equal(await pending,false);
});
