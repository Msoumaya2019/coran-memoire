import {Directory,File,Paths} from 'expo-file-system';
import {Platform} from 'react-native';
const pending=new Map<string,Promise<string>>();
// Disk prefetch avoids transferring AVPlayerItem objects between native iOS players.
export function cachedVerseAudio(url:string):Promise<string>{
 if(!url.startsWith('https://'))return Promise.reject(new Error('Source audio invalide.'));
 if(Platform.OS!=='ios')return Promise.resolve(url);
 const existing=pending.get(url);if(existing)return existing;
 const task=(async()=>{
  const folder=new Directory(Paths.cache,'quran-verse-audio-v1');
  folder.create({idempotent:true,intermediates:true});
  // These source URLs are short; reversible encoding also prevents key collisions.
  const name=encodeURIComponent(url);
  const target=new File(folder,`${name}.mp3`);
  if(target.exists&&target.size>0)return target.uri;
  const temporary=new File(folder,`${name}.part`);
  try{
   const downloaded=await File.downloadFileAsync(url,temporary,{idempotent:true});
   if(downloaded.size<=0)throw new Error('Fichier audio vide.');
   await downloaded.move(target,{overwrite:true});
   return target.uri;
  }catch(error){if(temporary.exists)temporary.delete();throw error;}
 })();
 pending.set(url,task);void task.finally(()=>pending.delete(url)).catch(()=>{});return task;
}
