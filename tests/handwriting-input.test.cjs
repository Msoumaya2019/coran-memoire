const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function pad(stylusOnly=true){
 const commits=[],drawing=[],React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:value=>({current:value}),useState:value=>[value&&value.width?{width:100,height:100}:value,()=>{}],useMemo:fn=>fn()};React.default=React;
 const exports={},code=ts.transpileModule(fs.readFileSync('src/ui/NoteHandwriting.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 vm.runInNewContext(code,{exports,require(name){if(name==='react')return React;if(name==='react-native')return {View:'View',PanResponder:{create:handlers=>({panHandlers:handlers})}};if(name==='react-native-svg')return {default:'Svg',Path:'Path',Circle:'Circle'};throw Error(name);}});
 const node=exports.NoteHandwriting({strokes:[],color:'#16A34A',stylusOnly,onChange:notes=>commits.push(notes),onDrawingChange:value=>drawing.push(value)});
 const emit=(name,values={})=>node.props[name]({nativeEvent:{locationX:10,locationY:20,offsetX:values.locationX??10,offsetY:values.locationY??20,pointerId:1,pointerType:'pen',touches:[{}],...values}});
 return {emit,commits,drawing,props:node.props};
}
test('Pencil writes even when the touch responder is negotiated before the pen pointer',()=>{
 const p=pad();assert.equal(p.props.onStartShouldSetPanResponder(),true);p.emit('onPanResponderGrant');p.emit('onPointerDownCapture');p.emit('onPointerMoveCapture',{locationX:30,locationY:40});p.emit('onPanResponderRelease');p.emit('onPointerUpCapture');assert.equal(p.commits.length,1);assert.equal(p.commits[0][0].points.length,2);assert.equal(p.commits[0][0].points[0].x,.1);assert.equal(p.commits[0][0].points[1].y,.4);assert.equal(p.drawing.at(-1),false);
});
test('pen pointer up followed by responder release saves only once and ignores a palm',()=>{
 const p=pad();p.emit('onPointerDownCapture');p.emit('onPointerDownCapture',{pointerId:2,pointerType:'touch'});p.emit('onPanResponderMove',{touches:[{},{}]});p.emit('onPointerUpCapture');p.emit('onPanResponderRelease');assert.equal(p.commits.length,1);
});
test('unclassified or passive stylus can use explicit finger opt-in, not silent fallback',()=>{
 const blocked=pad();blocked.emit('onPanResponderGrant');blocked.emit('onPanResponderRelease');assert.equal(blocked.commits.length,0);
 const allowed=pad(false);allowed.emit('onPanResponderGrant');allowed.emit('onPanResponderMove',{locationX:40,locationY:50});allowed.emit('onPanResponderRelease');assert.equal(allowed.commits.length,1);assert.equal(allowed.commits[0][0].points.length,2);
});
