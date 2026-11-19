const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),cp=require('node:child_process');
const {testPageHtml}=require('./build/coranTest/html');
test('embedded reader helpers are generated from the current typed source',()=>{assert.doesNotThrow(()=>cp.execFileSync(process.execPath,['scripts/generate-reader-functions.cjs','--check'],{stdio:'pipe'}));});
test('native bytecode functions need no Function.toString source to create executable reader HTML',()=>{
 const helpers=[require('./build/core/readerAnnotations').annotationRegions,require('./build/core/marginAnnotations').marginAnnotations,...['pressurePaths','inkShapePath','inkHit'].map(name=>require('./build/core/tabletInk')[name])];
 for(const helper of helpers)helper.toString=()=>{throw Error('Hermes source unavailable');};
 try{const html=testPageHtml({page:3,surah:2,juz:1,fontSize:70,lines:[]},{page:'data:font/woff2;base64,AA==',title:'data:font/woff2;base64,AA==',basmala:'data:font/woff2;base64,AA=='});assert.doesNotThrow(()=>new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]));assert.equal(html.includes('[bytecode]'),false);}finally{for(const helper of helpers)delete helper.toString;}
});
