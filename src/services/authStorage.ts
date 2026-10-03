import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
const safe=(key:string)=>key.replace(/[^a-zA-Z0-9._-]/g,'_');
const options={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
/** Chunked native Keychain/Keystore storage; migrate only after a secure write succeeds. */
export const authStorage={
 async getItem(key:string):Promise<string|null>{
  if(Platform.OS==='web')return AsyncStorage.getItem(key);
  const name=safe(key),pointer=await SecureStore.getItemAsync(name,options);
  if(pointer){const {generation,count,encoding}=JSON.parse(pointer);let value='';for(let i=0;i<count;i++){const part=await SecureStore.getItemAsync(`${name}.${generation}.${i}`,options);if(part===null)return null;value+=part;}return encoding==='json'?JSON.parse(value):value;}
  const legacy=await AsyncStorage.getItem(key);if(legacy){await authStorage.setItem(key,legacy);await AsyncStorage.removeItem(key);}return legacy;
 },
 async setItem(key:string,value:string):Promise<void>{
  if(Platform.OS==='web'){await AsyncStorage.setItem(key,value);return;}
  const name=safe(key),old=await SecureStore.getItemAsync(name,options),generation=Date.now().toString(36)+Math.random().toString(36).slice(2,7),encoded=JSON.stringify(value).replace(/[^\x00-\x7F]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0')),count=Math.ceil(encoded.length/1500);
  for(let i=0;i<count;i++)await SecureStore.setItemAsync(`${name}.${generation}.${i}`,encoded.slice(i*1500,(i+1)*1500),options);
  await SecureStore.setItemAsync(name,JSON.stringify({generation,count,encoding:'json'}),options);
  if(old){const previous=JSON.parse(old);for(let i=0;i<previous.count;i++)await SecureStore.deleteItemAsync(`${name}.${previous.generation}.${i}`,options);}
 },
 async removeItem(key:string):Promise<void>{
  await AsyncStorage.removeItem(key);if(Platform.OS==='web')return;
  const name=safe(key),old=await SecureStore.getItemAsync(name,options);await SecureStore.deleteItemAsync(name,options);
  if(old){const previous=JSON.parse(old);for(let i=0;i<previous.count;i++)await SecureStore.deleteItemAsync(`${name}.${previous.generation}.${i}`,options);}
 }
};
