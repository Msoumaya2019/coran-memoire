import {AppState} from './program';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(value:any)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** Three-way merge: unchanged local fields inherit the server; explicit local
 * edits (including deletions) win a same-field conflict. IDs preserve history. */
function merge(base:any,local:any,remote:any,path=''):any{
 if(same(local,base))return remote;
 if(same(remote,base)||same(local,remote))return local;
 if(Array.isArray(local)&&Array.isArray(remote)){
  if([...local,...remote].every(v=>object(v)&&typeof v.id==='string')){
   const keyed=(rows:any[])=>Object.fromEntries(rows.map(v=>[v.id,v]));
   const b=keyed(Array.isArray(base)?base:[]),l=keyed(local),r=keyed(remote);
   return [...new Set([...Object.keys(l),...Object.keys(r)])].flatMap(id=>{const value=l[id]===undefined&&r[id]?.status==='done'?r[id]:merge(b[id],l[id],r[id],path+'.'+id);return value===undefined?[]:[value];});
  }
  if(path.endsWith('validations')||path.endsWith('History'))return [...new Map([...remote,...local].map(value=>[JSON.stringify(value),value])).values()];
  if(path.endsWith('completed')&&[...local,...remote].every(v=>typeof v==='number'))return [...new Set([...local,...remote])].sort((a,b)=>a-b);
  return local;
 }
 if(object(remote)&&(object(local)||local===undefined&&object(base))){
  local=local??{};
  const result:any={};for(const key of new Set([...Object.keys(base??{}),...Object.keys(local),...Object.keys(remote)])){const value=merge(base?.[key],local[key],remote[key],path+'.'+key);if(value!==undefined)result[key]=value;}
  if(typeof result.through==='number'&&typeof result.end==='number')result.status=result.through>=result.end?'completed':'partial';
  return result;
 }
 if(path.endsWith('.through')&&typeof local==='number'&&typeof remote==='number')return Math.max(local,remote);
 if(path.endsWith('.status')&&(local==='done'||remote==='done'))return 'done';
 return local;
}
export function mergeOfflineState(base:AppState|undefined,local:AppState,remote:AppState|null):AppState{
 if(!remote||!base||base.userId!==local.userId||remote.userId!==local.userId)return local;
 if(base.onboardingDone&&!local.onboardingDone)return local; // Explicit reset.
 return {...merge(base,local,remote),userId:local.userId,updatedAt:new Date(Math.max(Date.now(),Date.parse(local.updatedAt)+1,Date.parse(remote.updatedAt)+1)).toISOString()};
}
