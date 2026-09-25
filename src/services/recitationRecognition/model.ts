import {Directory,File,Paths} from 'expo-file-system';

const base='https://github.com/yazinsai/tilawa/releases/download/v0.2.0';
const assets=[
  {name:'fastconformer_full_mixed.onnx',size:88307366},
  {name:'vocab.json',size:21062},
  {name:'quran_ctc_tokens.json',size:12211783},
  {name:'quran.json',size:3186385},
] as const;
const folder=()=>new Directory(Paths.document,'tilawa-fastconformer-v0.2.0');

export const modelDownloadBytes=assets.reduce((sum,asset)=>sum+asset.size,0);

export function modelAvailable(){
  const directory=folder();
  return assets.every(asset=>{const file=new File(directory,asset.name);return file.exists&&file.size===asset.size;});
}

export async function ensureModel(onProgress?:(fraction:number,label:string)=>void){
  const directory=folder();
  directory.create({idempotent:true,intermediates:true});
  let completed=0;
  for(const asset of assets){
    const file=new File(directory,asset.name);
    if(file.exists&&file.size===asset.size){completed+=asset.size;onProgress?.(completed/modelDownloadBytes,asset.name);continue;}
    const partial=new File(directory,`${asset.name}.part`);
    if(partial.exists)partial.delete();
    try{
      await File.downloadFileAsync(`${base}/${asset.name}`,partial,{onProgress:progress=>{
        const loaded=Math.min(asset.size,progress.bytesWritten);
        onProgress?.((completed+loaded)/modelDownloadBytes,asset.name);
      }});
      if(partial.size!==asset.size)throw new Error(`Téléchargement incomplet : ${asset.name}`);
      if(file.exists)file.delete();
      await partial.move(file);
      completed+=asset.size;
    }catch(error){if(partial.exists)partial.delete();throw error;}
  }
  return {
    model:new File(directory,'fastconformer_full_mixed.onnx'),
    vocab:new File(directory,'vocab.json'),
    tokens:new File(directory,'quran_ctc_tokens.json'),
    quran:new File(directory,'quran.json'),
  };
}
