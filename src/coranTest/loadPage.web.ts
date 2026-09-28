import {testFonts,testPages,titleFont,basmalaFont} from './resources';
import {testPageHtml} from './html';
import {TestPage,validTestPage} from './model';
const cache=new Map<number,string>(),pending=new Map<number,Promise<string>>();
let shared:Promise<{title:string;basmala:string}>|undefined;
async function fontUrl(asset:number){
 const response=await fetch(String(asset));if(!response.ok)throw new Error('Police indisponible.');
 const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return 'data:font/woff2;base64,'+btoa(binary);
}
export function loadTestPage(page:number):Promise<string>{
 if(!validTestPage(page))return Promise.reject(new Error('Page invalide.'));
 const hit=cache.get(page);if(hit)return Promise.resolve(hit);
 const underway=pending.get(page);if(underway)return underway;
 if(!shared)shared=Promise.all([fontUrl(titleFont),fontUrl(basmalaFont)]).then(([title,basmala])=>({title,basmala})).catch(e=>{shared=undefined;throw e;});
 const task=Promise.all([fontUrl(testFonts[page]),shared]).then(([font,common])=>{
   const html=testPageHtml(testPages[page]() as TestPage,{page:font,...common});cache.set(page,html);
   while(cache.size>5)cache.delete(cache.keys().next().value!);return html;
 }).finally(()=>pending.delete(page));pending.set(page,task);return task;
}
