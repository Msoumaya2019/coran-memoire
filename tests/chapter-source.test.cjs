const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const core=require('./build/core/audio.js'),quran=require('./build/core/quran.js');
test('source sourate rétablie par défaut, cache et timestamps distincts par réciteur',async()=>{
 const cache=new Map(),requests=[],exports={};
 const source=ts.transpileModule(fs.readFileSync('src/services/quranAudioTimeline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,console,Date,Map,Promise,AbortController,setTimeout,clearTimeout,require(name){return name==='@react-native-async-storage/async-storage'?{getItem:async key=>cache.get(key),setItem:async(key,value)=>cache.set(key,value),removeItem:async key=>cache.delete(key)}:name==='../core/audio'?core:quran;},fetch:async url=>{requests.push(url);const resource=Number(url.split('/chapter_recitations/')[1].split('/')[0]);return {ok:true,json:async()=>({audio_file:{audio_url:`https://example.com/${resource}/114.mp3`,timestamps:Array.from({length:6},(_,i)=>({verse_key:`114:${i+1}`,timestamp_from:(resource+i)*1000,timestamp_to:(resource+i+1)*1000}))}})};}});
 const id=quran.verseId(114,1);
 for(const [index,resource] of [[0,6],[1,7],[2,9],[3,4]]){
  const reciter=core.reciters[index],timeline=await exports.chapterAudio(id,reciter);
  assert.equal(timeline.url,`https://example.com/${resource}/114.mp3`);
  assert.equal(timeline.verses[id].start,resource);assert.strictEqual(await exports.chapterAudio(id,reciter),timeline);
  assert.equal(await exports.chapterAudio(id,reciter,'verse-files'),null);
 }
 for(const reciter of core.reciters.slice(4))assert.equal(await exports.chapterAudio(id,reciter),null);
 assert.equal(requests.length,4);assert.equal(cache.size,4);
});
