import {Directory,File,Paths} from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {currentUser,supabase} from './sync';

const bucket='friend-avatars';
const pendingDirectory=new Directory(Paths.document,'pending-avatars');
const selectedDirectory=new Directory(Paths.cache,'selected-avatars');
const pendingKey=(email:string)=>`pending-avatar:${email.trim().toLowerCase()}`;

export async function chooseAvatar():Promise<string|null>{
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.65,base64:true});
  if(result.canceled)return null;
  const asset=result.assets[0];
  if(!asset.base64)throw new Error('La photo sélectionnée ne peut pas être lue.');
  if(asset.base64.length>2_800_000)throw new Error('Choisis une photo de moins de 2 Mo.');
  selectedDirectory.create({idempotent:true,intermediates:true});
  const file=new File(selectedDirectory,`${Date.now()}.jpg`);
  file.write(Uint8Array.from(atob(asset.base64),character=>character.charCodeAt(0)));
  return file.uri;
}

export async function stageAvatar(email:string,uri:string){
  pendingDirectory.create({idempotent:true,intermediates:true});
  const path=new File(pendingDirectory,`${encodeURIComponent(email.trim().toLowerCase())}.jpg`);
  await new File(uri).copy(path);
  await AsyncStorage.setItem(pendingKey(email),path.uri);
}

export async function uploadAvatar(uri:string):Promise<string>{
  const user=await currentUser();if(!supabase||!user)throw new Error('Connecte-toi pour enregistrer ta photo.');
  const path=`${user.id}/avatar.jpg`;
  const bytes=await new File(uri).bytes();
  if(bytes.byteLength>2_097_152)throw new Error('Choisis une photo de moins de 2 Mo.');
  const {error:uploadError}=await supabase.storage.from(bucket).upload(path,bytes,{upsert:true,contentType:'image/jpeg',cacheControl:'3600'});
  if(uploadError)throw uploadError;
  const {error:profileError}=await supabase.rpc('ensure_social_profile');
  if(profileError)throw profileError;
  const {error}=await supabase.from('friend_profiles').update({avatar_path:path}).eq('id',user.id);
  if(error)throw error;
  return path;
}

export async function syncStagedAvatar(email:string){
  const key=pendingKey(email),uri=await AsyncStorage.getItem(key);
  if(!uri)return;
  await uploadAvatar(uri);
  await AsyncStorage.removeItem(key);
  const file=new File(uri);if(file.exists)file.delete();
}

export async function removeAvatar(){
  const user=await currentUser();if(!supabase||!user)throw new Error('Connexion requise.');
  const path=`${user.id}/avatar.jpg`;
  const {error}=await supabase.from('friend_profiles').update({avatar_path:null}).eq('id',user.id);
  if(error)throw error;
  const {error:removeError}=await supabase.storage.from(bucket).remove([path]);
  if(removeError)throw removeError;
}

export async function avatarUrl(path:string|null|undefined):Promise<string|null>{
  if(!path||!supabase)return null;
  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,60);
  if(error)throw error;
  return data.signedUrl;
}
