const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function service(options={}){
 const rows=new Map(),files=new Map(),events=[],calls=[];
 const db={execSync(){},getFirstSync(sql,id){return rows.get(id)??null;},runSync(sql,...values){if(sql.startsWith('DELETE'))rows.delete(values[0]);else rows.set(values[0],{local_file_path:values[1],downloaded_at:values[2],source:values[3]});}};
 class Directory{constructor(){this.uri='file:///documents/roqya-audio';}create(){}}
 class File{constructor(dir,name){this.uri=name?`${dir.uri}/${name}`:dir;}get exists(){return files.has(this.uri);}get size(){return files.get(this.uri)??0;}delete(){files.delete(this.uri);}move(target){files.set(target.uri,this.size);files.delete(this.uri);this.uri=target.uri;}}
 const exports={},code=ts.transpileModule(fs.readFileSync('src/services/roqya.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,URL,Map,Set,Promise,Date,encodeURIComponent,require(name){return {'expo-sqlite':{openDatabaseSync:()=>db},'expo-file-system':{File,Directory,Paths:{document:'file:///documents'}},'react-native':{Platform:{OS:'ios'}},'./sync':{supabase:{storage:{from:()=>({createSignedUrl:async path=>{calls.push(path);return {data:{signedUrl:'https://example.com/signed.mp3'}};}})}}},'../core/roqya':{emptyRoqyaLibrary:()=>({}),normalizeRoqyaCatalog:x=>x,safeMediaUrl:x=>x?.startsWith('https://')?x:undefined},'expo-file-system/legacy':{FileSystemSessionType:{FOREGROUND:0},createDownloadResumable(url,uri,_,onProgress){return {async downloadAsync(){events.push(url);onProgress({totalBytesWritten:42,totalBytesExpectedToWrite:100});if(options.fail)throw Error('network interrupted');files.set(uri,options.bytes??100);return {uri,status:options.status??200};}};}}}[name];}});
 const audio={id:'audio',storagePath:'reciter/roqya.mp3',fileSize:100};return {exports,audio,files,rows,events,calls};
}
test('le téléchargement utilise les octets réels et le fichier local est préféré sans nouvelle URL',async()=>{
 const h=service(),states=[];h.exports.observeRoqyaDownloads(()=>states.push(h.exports.roqyaDownloadState(h.audio)));
 await Promise.all([h.exports.downloadRoqya(h.audio),h.exports.downloadRoqya(h.audio)]);
 assert(states.some(s=>s.phase==='downloading'&&s.progress===.42));assert.equal(h.events.length,1);
 const uri=await h.exports.roqyaPlaybackUrl(h.audio);assert(uri.startsWith('file:///'));assert.equal(h.calls.length,1);assert(h.rows.get('audio').downloaded_at);
 h.exports.deleteRoqyaDownload(h.audio);assert.equal(h.exports.roqyaDownloadState(h.audio).phase,'idle');assert.equal(h.files.size,0);
});
test('un fichier disparu ou changé ne reste jamais faussement téléchargé',async()=>{
 const h=service();await h.exports.downloadRoqya(h.audio);h.files.clear();assert.equal(h.exports.roqyaDownloadState(h.audio).phase,'idle');
 assert((await h.exports.roqyaPlaybackUrl(h.audio)).startsWith('https://'));
 await h.exports.downloadRoqya(h.audio);assert.equal(h.exports.localRoqyaFile({...h.audio,storagePath:'different.mp3'}),undefined);
});
test('interruption, réponse HTTP invalide et taille incomplète ne créent pas de fichier disponible',async()=>{
 for(const options of [{fail:true},{status:404},{bytes:42}]){const h=service(options);await assert.rejects(()=>h.exports.downloadRoqya(h.audio));assert.equal(h.rows.size,0);assert.equal(h.files.size,0);assert.equal(h.exports.roqyaDownloadState(h.audio).phase,'error');}
});
