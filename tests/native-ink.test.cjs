const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function surface(overrides={}){
 const effects=[],measurements=[],commits=[],erasures=[];
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:fn=>effects.push(fn)};React.default=React;
 const exports={},script=ts.transpileModule(fs.readFileSync('src/ui/NativeInkSurface.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 vm.runInNewContext(script,{exports,requestAnimationFrame:()=>1,cancelAnimationFrame(){},require(name){if(name==='react')return React;if(name==='react-native')return {View:'View'};if(name.includes('ReaderAnnotationMarks'))return {ReaderAnnotationMarks:'Marks'};if(name.includes('readerAnnotations'))return require('./build/core/readerAnnotations');if(name.includes('tabletInk'))return require('./build/core/tabletInk');throw Error(name);}});
 const tree=exports.NativeInkSurface({width:1000,height:2000,page:3,ink:{enabled:true,tool:'pen',color:'#16A34A',width:.003,stylusOnly:true},marks:[],mapPoint:(event,callback)=>measurements.push(()=>callback(event.nativeEvent.pageX,event.nativeEvent.pageY)),onCommit:n=>commits.push(n),onErase:ids=>erasures.push(ids),...overrides});
 const cleanup=effects.map(fn=>fn()).filter(Boolean);
 const emit=(name,values={})=>tree.props[name]({nativeEvent:{pointerId:1,pointerType:'pen',pageX:200,pageY:400,pressure:.7,...values},stopPropagation(){}});
 return {emit,measurements,commits,erasures,unmount:()=>cleanup.forEach(fn=>fn())};
}
test('native ink waits for pending coordinate measurements before committing a quick Pencil tap',()=>{
 const s=surface();s.emit('onPointerDownCapture');s.emit('onPointerUpCapture');assert.equal(s.commits.length,0);s.measurements.shift()();assert.equal(s.commits.length,1);assert.equal(s.commits[0].points[0].x,.2);assert.equal(s.commits[0].points[0].y,.2);assert.equal(s.commits[0].points[0].pressure,.7);
});
test('native ink ignores a palm during a pen stroke and rejects delayed callbacks after cancellation',()=>{
 const s=surface();s.emit('onPointerDownCapture');s.emit('onPointerDownCapture',{pointerType:'touch',pointerId:2});s.measurements.shift()();s.emit('onPointerUpCapture');assert.equal(s.commits.length,1);
 const cancelled=surface();cancelled.emit('onPointerDownCapture');cancelled.emit('onPointerCancel');cancelled.measurements.shift()();assert.equal(cancelled.commits.length,0);
 const unmounted=surface();unmounted.emit('onPointerDownCapture');unmounted.unmount();unmounted.measurements.shift()();assert.equal(unmounted.commits.length,0);
});
test('native finger drawing requires opt-in and two fingers cancel an unfinished stroke',()=>{
 const s=surface();s.emit('onPointerDownCapture',{pointerType:'touch'});assert.equal(s.measurements.length,0);
 const finger=surface({ink:{enabled:true,tool:'pen',color:'#16A34A',width:.003,stylusOnly:false}});finger.emit('onPointerDownCapture',{pointerType:'touch'});finger.emit('onPointerDownCapture',{pointerType:'touch',pointerId:2});finger.measurements.shift()();finger.emit('onPointerUpCapture',{pointerType:'touch'});assert.equal(finger.commits.length,0);
});
