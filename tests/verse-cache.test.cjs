const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness(platform='ios'){
 const files=new Map(),downloads=[];let fail=false;
 class Directory{constructor(...parts){this.uri=parts.map(p=>p.uri??p).join('/');}create(){}}
 class File{constructor(...parts){this.uri=parts.map(p=>p.uri??p).join('/');}get exists(){return files.has(this.uri);}get size(){return files.get(this.uri)??0;}delete(){files.delete(this.uri);}async move(target){files.set(target.uri,this.size);this.delete();}
 static async downloadFileAsync(url,target){downloads.push(url);files.set(target.uri,1234);await Promise.resolve();if(fail)throw Error('download failed');return target;}}
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/verseAudioCache.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Map,Promise,encodeURIComponent,require(name){return name==='react-native'?{Platform:{OS:platform}}:{Directory,File,Paths:{cache:'file:///cache'}};}});
 return {...exports,downloads,files,setFail(value){fail=value;}};
}
test('iOS cache : téléchargement unique simultané, puis réutilisation du MP3 local',async()=>{
 const c=harness(),url='https://example.com/001002.mp3';const a=c.cachedVerseAudio(url),b=c.cachedVerseAudio(url);
 assert.strictEqual(a,b);const uri=await a;assert.ok(uri.startsWith('file:///cache/'));assert.equal(await c.cachedVerseAudio(url),uri);assert.equal(c.downloads.length,1);assert.equal(c.files.size,1);
 const other=await c.cachedVerseAudio('https://other.example.com/001002.mp3');assert.notEqual(uri,other);
});
test('un téléchargement échoué ne laisse pas un faux fichier prêt et peut être retenté',async()=>{
 const c=harness(),url='https://example.com/001002.mp3';c.setFail(true);await assert.rejects(c.cachedVerseAudio(url),/download failed/);assert.equal(c.files.size,0);c.setFail(false);assert.ok((await c.cachedVerseAudio(url)).startsWith('file:'));assert.equal(c.downloads.length,2);
});
test('Android et web conservent leur chemin ; les URL invalides restent des erreurs',async()=>{
 for(const platform of ['android','web']){const c=harness(platform),url='https://example.com/001002.mp3';assert.equal(await c.cachedVerseAudio(url),url);assert.equal(c.downloads.length,0);await assert.rejects(c.cachedVerseAudio('bad-url'),/Source audio invalide/);}
});
