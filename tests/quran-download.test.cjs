const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const esbuild=require('esbuild');

function harness(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'quran-download-'));
 const root=path.resolve(__dirname,'..');
 const output=path.join(directory,'service.cjs');
 esbuild.buildSync({entryPoints:[path.join(root,'src/services/quranDownload.ts')],bundle:true,platform:'node',format:'cjs',outfile:output,external:['expo-file-system','expo-file-system/legacy']});
 let downloads=0,resumes=0,pauses=0;
 class File{
  constructor(parent,...parts){this.uri=path.join(typeof parent==='string'?parent:parent.uri,...parts);}
  get exists(){return fs.existsSync(this.uri);}
  get size(){return this.exists?fs.statSync(this.uri).size:0;}
  write(bytes){fs.writeFileSync(this.uri,bytes);}
  text(){return Promise.resolve(fs.readFileSync(this.uri,'utf8'));}
  textSync(){return fs.readFileSync(this.uri,'utf8');}
  delete(){fs.unlinkSync(this.uri);}
  open(){const fd=fs.openSync(this.uri,'r');let offset=0;return {get offset(){return offset;},readBytes(length){const buffer=Buffer.alloc(length);const read=fs.readSync(fd,buffer,0,length,offset);offset+=read;return new Uint8Array(buffer.buffer,buffer.byteOffset,read);},close(){fs.closeSync(fd);}};}
 }
 class Directory extends File{create(){fs.mkdirSync(this.uri,{recursive:true});}}
 const Module=require('node:module'),original=Module._load;
 const archive=path.join(root,'work-dist/quran-zips/coran_1441.zip');
 let finish;
 let mode='normal';
 Module._load=function(name,...args){
  if(name==='expo-file-system')return {File,Directory,Paths:{document:directory}};
  if(name==='expo-file-system/legacy')return {FileSystemSessionType:{FOREGROUND:1},createDownloadResumable(url,uri,options,progress,resumeData){assert.match(url,/madani_1441/);assert.equal(options.sessionType,1);return {
   async downloadAsync(){downloads++;if(mode==='native-error'&&downloads===1)throw new Error('ERR_FILESYSTEM_CANNOT_DOWNLOAD: undefined reason');if(mode==='pause')return new Promise(resolve=>{finish=resolve;});if(mode!=='normal'){fs.writeFileSync(uri,'partial');return {status:503};}fs.copyFileSync(archive,uri);progress({totalBytesWritten:102608011,totalBytesExpectedToWrite:102608011});return {status:mode==='error'?503:200};},
   async resumeAsync(){resumes++;if(mode==='resume-failure')throw new Error('ERR_FILESYSTEM_CANNOT_DOWNLOAD: stale resume');assert.equal(resumeData,'saved');return this.downloadAsync();},
   async pauseAsync(){pauses++;finish?.(undefined);return {resumeData:'saved'};}
  };}};
  return original.call(this,name,...args);
 };
 let service;try{service=require(output);}finally{Module._load=original;}
 return {service,directory,archive,get downloads(){return downloads;},get resumes(){return resumes;},get pauses(){return pauses;},set mode(value){mode=value;},cleanup(){fs.rmSync(directory,{recursive:true,force:true});}};
}

test('Coran 1441 has no embedded image imports in the native bundle',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/MushafPage.tsx'),'utf8');
 assert.ok(!source.includes('coran_1441-images'));
 assert.ok(!fs.existsSync(path.join(__dirname,'../assets/quran-tests/coran_1441')));
});

test('failed download never activates an incomplete source',async()=>{
 const h=harness();try{h.mode='error';await assert.rejects(h.service.ensureQuranDownloaded());assert.equal(h.service.quranDownloaded(),false);assert.equal(h.service.quranDownloadState().phase,'error');}finally{h.cleanup();}
});

test('download pause is persisted and does not activate the source',async()=>{
 const h=harness();try{
  h.mode='pause';const pending=h.service.ensureQuranDownloaded();
  const rejected=assert.rejects(pending);
  await h.service.pauseQuranDownload();await rejected;
  assert.equal(h.service.quranDownloadState().phase,'paused');assert.equal(h.service.quranDownloaded(),false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(h.directory,'quran/coran_1441/resume.json'))).resumeData,'saved');
 }finally{h.cleanup();}
});

test('official ZIP installs all 9060 original lines once and remains available offline',{skip:!fs.existsSync(path.join(__dirname,'../work-dist/quran-zips/coran_1441.zip'))},async()=>{
 const h=harness();try{
  const phases=new Set();const unsubscribe=h.service.subscribeQuranDownload(value=>phases.add(value.phase));
  const first=h.service.ensureQuranDownloaded();assert.equal(first,h.service.ensureQuranDownloaded());await first;
  assert.equal(h.downloads,1);assert.equal(h.service.quranDownloaded(),true);
  const files=fs.readdirSync(path.join(h.directory,'quran/coran_1441'));
  assert.equal(files.filter(name=>name.endsWith('.png')).length,9060);
  assert.equal(fs.readFileSync(h.service.quranLineUri(604,14)).readUInt32BE(16),1440);
  assert.ok(phases.has('downloading')&&phases.has('extracting')&&phases.has('ready'));
  assert.ok(!files.includes('download.zip'));h.mode='error';await h.service.ensureQuranDownloaded();assert.equal(h.downloads,1);
  unsubscribe();
 }finally{h.cleanup();}
});


test('iOS temporary resume token is used even when destination ZIP does not exist; stale token falls back once',async()=>{
 const h=harness();try{
  const dir=path.join(h.directory,'quran/coran_1441');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'resume.json'),JSON.stringify({resumeData:'saved'}));
  h.mode='resume-failure';await assert.rejects(h.service.ensureQuranDownloaded());
  assert.equal(h.resumes,1);assert.equal(h.downloads,1);assert.equal(fs.existsSync(path.join(dir,'resume.json')),false);assert.equal(h.service.quranDownloaded(),false);
 }finally{h.cleanup();}
});
test('native cannot-download failure starts one fresh foreground attempt and never activates partial data',async()=>{
 const h=harness();try{h.mode='native-error';await assert.rejects(h.service.ensureQuranDownloaded());assert.equal(h.downloads,2);assert.equal(h.service.quranDownloaded(),false);}finally{h.cleanup();}
});
test('concurrent pause callbacks share one native pause and retain its token',async()=>{
 const h=harness();try{h.mode='pause';const pending=h.service.ensureQuranDownloaded(),rejected=assert.rejects(pending);const first=h.service.pauseQuranDownload();assert.equal(first,h.service.pauseQuranDownload());await first;await rejected;assert.equal(h.pauses,1);}finally{h.cleanup();}
});
test('download error shown to the user excludes the Swift implementation trace',()=>{
 const h=harness();try{assert.match(h.service.quranDownloadError(new Error('ERR_FILESYSTEM_CANNOT_DOWNLOAD: undefined reason at Promise.swift:65')),/connexion/);assert.doesNotMatch(h.service.quranDownloadError(new Error('ERR_FILESYSTEM_CANNOT_DOWNLOAD: undefined reason')),/undefined|Swift|ERR_/);}finally{h.cleanup();}
});
