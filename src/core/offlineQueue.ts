export function createSyncWorker<T extends {id:string;userId:string}>(store:{owner:()=>string|undefined;list:(userId:string)=>T[];acknowledge:(id:string)=>void},send:(operation:T)=>Promise<void>){
 let flight:Promise<void>|null=null;
 return ()=>{
  if(flight)return flight;
  flight=(async()=>{const owner=store.owner();if(!owner)return;
   const operations=store.list(owner);if(!operations.length||store.owner()!==owner)return;
   // A full latest snapshot includes earlier edits. Acknowledge those versions only
   // after the server confirms it; versions created during the request stay queued.
   await send(operations[operations.length-1]);for(const operation of operations)store.acknowledge(operation.id);
  })().finally(()=>{flight=null;});return flight;
 };
}
