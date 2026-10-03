import {createSyncWorker} from '../core/offlineQueue';
import {mergeOfflineState} from '../core/offlineMerge';
import {pushState,pullState} from './sync';
import {loadState,saveState,pendingOperations,acknowledgeOperation,SyncOperation} from './storage';
const listeners=new Set<()=>void>();
export function observeOfflineSync(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const flushPendingSync=createSyncWorker<SyncOperation>({owner:()=>loadState().userId,list:pendingOperations,acknowledge:acknowledgeOperation},async operation=>{
 const remote=await pullState();if(loadState().userId!==operation.userId)throw new Error('Compte changé');
 const merged=mergeOfflineState(operation.base,operation.payload,remote);await pushState(merged);
 const current=loadState();if(current.userId===operation.userId){saveState(mergeOfflineState(operation.payload,current,merged));for(const listener of listeners)listener();}
});
