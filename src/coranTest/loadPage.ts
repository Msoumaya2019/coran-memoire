import {Asset} from 'expo-asset';
import {readAsStringAsync,EncodingType} from 'expo-file-system/legacy';
import {testFonts,testPages,titleFont,basmalaFont} from './resources';
import {testPageHtml} from './html';
import {TestPage,validTestPage} from './model';

const cache=new Map<number,string>(),pending=new Map<number,Promise<string>>();
let sharedFonts:Promise<{title:string;basmala:string}>|undefined;
async function fontUrl(module:number){
 const asset=Asset.fromModule(module);await asset.downloadAsync();
 if(!asset.localUri)throw new Error('Police locale indisponible.');
 return 'data:font/woff2;base64,'+await readAsStringAsync(asset.localUri,{encoding:EncodingType.Base64});
}
export function loadTestPage(page:number):Promise<string>{
 if(!validTestPage(page))return Promise.reject(new Error('Page invalide.'));
 const hit=cache.get(page);if(hit){cache.delete(page);cache.set(page,hit);return Promise.resolve(hit);}
 const underway=pending.get(page);if(underway)return underway;
 if(!sharedFonts)sharedFonts=Promise.all([fontUrl(titleFont),fontUrl(basmalaFont)]).then(([title,basmala])=>({title,basmala})).catch(e=>{sharedFonts=undefined;throw e;});
 const promise=Promise.all([fontUrl(testFonts[page]),sharedFonts]).then(([font,shared])=>{
   const html=testPageHtml(testPages[page]() as TestPage,{page:font,...shared});cache.set(page,html);
   while(cache.size>5)cache.delete(cache.keys().next().value!);
   return html;
 }).finally(()=>pending.delete(page));pending.set(page,promise);return promise;
}
