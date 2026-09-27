import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {currentUser,supabase} from './sync';
const bucket='daily-content-media';
const marker=`/storage/v1/object/public/${bucket}/`;
const signed=new Map<string,{url:string;expires:number}>();
function pathOf(url:string){if(!supabase)return null;const root=supabase.storage.from(bucket).getPublicUrl('').data.publicUrl;if(!url.startsWith(root))return null;return url.split(marker)[1]??null;}
export async function resolveContentMedia(url:string|null):Promise<string|null>{
 if(!url)return null;const path=pathOf(url);if(!path)return url;
 const cached=signed.get(url);if(cached&&cached.expires>Date.now())return cached.url;
 const {data,error}=await supabase!.storage.from(bucket).createSignedUrl(path,3600);if(error)throw error;
 signed.set(url,{url:data.signedUrl,expires:Date.now()+3300000});return data.signedUrl;
}
export async function chooseAndUploadContentMedia(kind:'image'|'audio',progress:(value:number)=>void):Promise<string|null>{
 let uri:string,mime:string,extension:string;
 if(kind==='image'){
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,quality:0.65,allowsEditing:true,aspect:[1,1]});if(result.canceled)return null;
  const asset=result.assets[0];uri=asset.uri;mime=asset.mimeType??'image/jpeg';extension=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Choisis une image JPEG, PNG ou WebP.');
 }else{
  const result=await DocumentPicker.getDocumentAsync({type:['audio/*','video/mp4'],copyToCacheDirectory:true,multiple:false});if(result.canceled)return null;
  const asset=result.assets[0];uri=asset.uri;extension=asset.name.split('.').pop()?.toLowerCase()??'';
  if(!['mp3','m4a','aac'].includes(extension))throw new Error('Choisis un fichier MP3, M4A ou AAC.');
  mime=extension==='mp3'?'audio/mpeg':extension==='aac'?'audio/aac':'audio/mp4';
 }
 const user=await currentUser();if(!user||!supabase)throw new Error('Connecte-toi avec ton compte administrateur.');
 progress(0.15);const file=new File(uri),bytes=await file.bytes();
 const limit=kind==='image'?5*1024*1024:30*1024*1024;if(bytes.byteLength>limit)throw new Error(kind==='image'?'Image limitée à 5 Mo.':'Audio limité à 30 Mo.');
 progress(0.4);const path=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
 const {error}=await supabase.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});if(error)throw error;
 progress(1);return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
export async function removeContentMedia(urls:(string|null)[]){const paths=urls.map(url=>url?pathOf(url):null).filter((path):path is string=>!!path);if(!paths.length||!supabase)return;const {error}=await supabase.storage.from(bucket).remove(paths);if(error)throw error;for(const url of urls)if(url)signed.delete(url);}
export async function cleanUnusedContentMedia(urls:(string|null)[]){
 if(!supabase)return;
 for(const url of new Set(urls)){if(!url||!pathOf(url))continue;
  const results=await Promise.all([supabase.from('daily_contents').select('id',{count:'exact',head:true}).eq('image_url',url),supabase.from('daily_contents').select('id',{count:'exact',head:true}).eq('audio_url',url)]);
  for(const result of results)if(result.error)throw result.error;
  if(results.every(result=>result.count===0))await removeContentMedia([url]);
 }
}
