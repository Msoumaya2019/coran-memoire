import {Directory,File,Paths} from 'expo-file-system';
import * as FS from 'expo-file-system/legacy';
import {Unzip,UnzipInflate} from 'fflate';

const url='https://files.quran.app/hafs/madani_1441/zips/images_1440.zip';
const archiveBytes=102608011;
const root=()=>new Directory(Paths.document,'quran','coran_1441');
const readyFile=()=>new File(root(),'ready-v1.json');
export type DownloadState={phase:'idle'|'downloading'|'extracting'|'ready'|'paused'|'error';progress:number;message?:string};
let state:DownloadState={phase:'idle',progress:0};
const listeners=new Set<(value:DownloadState)=>void>();
let running:Promise<void>|null=null;
let task:ReturnType<typeof FS.createDownloadResumable>|null=null;
let pauseRequested=false;
function publish(value:DownloadState){state=value;listeners.forEach(fn=>fn(value));}
export function quranDownloaded(){try{const file=readyFile();if(!file.exists)return false;const ready=JSON.parse(file.textSync());return ready.version===1&&ready.files===9060;}catch{return false;}}
export function quranDownloadState():DownloadState{return quranDownloaded()?{phase:'ready',progress:1}:state.phase==='ready'?{phase:'idle',progress:0}:state;}
export function subscribeQuranDownload(fn:(value:DownloadState)=>void){listeners.add(fn);fn(quranDownloadState());return ()=>{listeners.delete(fn);};}
export function quranLineUri(page:number,line:number){return new File(root(),`${String(page).padStart(3,'0')}-${String(line+1).padStart(2,'0')}.png`).uri;}
export async function pauseQuranDownload(){
 if(!task||state.phase!=='downloading')return;
 pauseRequested=true;
 const saved=await task.pauseAsync();
 new File(root(),'resume.json').write(JSON.stringify(saved));
 publish({phase:'paused',progress:state.progress});
}
const yieldUI=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
export function ensureQuranDownloaded():Promise<void>{
 if(quranDownloaded())return Promise.resolve();
 if(running)return running;
 running=install().finally(()=>{running=null;task=null;});
 return running;
}
async function install(){
 pauseRequested=false;
 try{
  root().create({idempotent:true,intermediates:true});
  const zip=new File(root(),'download.zip'),resume=new File(root(),'resume.json');
  let completed=new File(root(),'download-complete.json').exists&&zip.exists&&zip.size===archiveBytes;
  if(!completed){
   let resumeData:string|undefined;
   if(resume.exists&&zip.exists){try{resumeData=JSON.parse(await resume.text()).resumeData;}catch{}}
   publish({phase:'downloading',progress:0});
   task=FS.createDownloadResumable(url,zip.uri,{},event=>publish({phase:'downloading',progress:event.totalBytesExpectedToWrite>0?event.totalBytesWritten/event.totalBytesExpectedToWrite:0}),resumeData);
   const result=await (resumeData?task.resumeAsync():task.downloadAsync());
   if(pauseRequested||!result)throw new Error('Téléchargement en pause.');
   if(![200,206].includes(result.status)||zip.size!==archiveBytes){if(resume.exists)resume.delete();throw new Error('Téléchargement incomplet. Réessayez avec une connexion stable.');}
   new File(root(),'download-complete.json').write('{}');
   if(resume.exists)resume.delete();
  }
  publish({phase:'extracting',progress:0});
  let failure:Error|undefined;
  const installed=new Set<string>();
  const unzip=new Unzip(entry=>{
   const match=/^width_1440\/(\d+)\/(\d+)\.png$/.exec(entry.name);
   if(!match)return; // Never extract arbitrary archive paths or databases.
   const page=Number(match[1]),line=Number(match[2]);
   if(page<1||page>604||line<1||line>15){failure=new Error('Page invalide dans le ZIP.');return;}
   const name=`${String(page).padStart(3,'0')}-${String(line).padStart(2,'0')}.png`;
   const chunks:Uint8Array[]=[];let length=0;
   entry.ondata=(error,data,final)=>{
    if(error){failure=error;return;}
    chunks.push(data);length+=data.length;
    if(length>2*1024*1024){failure=new Error('Image trop volumineuse.');return;}
    if(final){
     const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
     if(length<24||bytes[0]!==137||bytes[1]!==80||new DataView(bytes.buffer).getUint32(16)!==1440||new DataView(bytes.buffer).getUint32(20)!==232){failure=new Error('Image du Mushaf invalide.');return;}
     new File(root(),name).write(bytes);installed.add(name);
    }
   };
   entry.start();
  });
  unzip.register(UnzipInflate);
  const handle=zip.open();
  try{
   while((handle.offset??0)<archiveBytes){
    const chunk=handle.readBytes(Math.min(256*1024,archiveBytes-(handle.offset??0)));
    unzip.push(chunk,(handle.offset??0)===archiveBytes);
    if(failure)throw failure;
    publish({phase:'extracting',progress:installed.size/9060});
    await yieldUI();
   }
  }finally{handle.close();}
  if(installed.size!==9060)throw new Error('Certaines pages sont manquantes. Réessayez.');
  readyFile().write(JSON.stringify({version:1,files:9060,installedAt:new Date().toISOString()}));
  zip.delete();new File(root(),'download-complete.json').delete();
  publish({phase:'ready',progress:1});
 }catch(error){
  publish({phase:pauseRequested?'paused':'error',progress:state.progress,message:error instanceof Error?error.message:String(error)});
  throw error;
 }
}
