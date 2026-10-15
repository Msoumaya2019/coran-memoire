import {createAudioPlayer as createExpoAudioPlayer} from 'expo-audio';
let active:ReturnType<typeof createExpoAudioPlayer>|null=null;
const focusLost=new Map<ReturnType<typeof createExpoAudioPlayer>,Set<()=>void>>();
export function observeAudioFocusLost(player:ReturnType<typeof createExpoAudioPlayer>,fn:()=>void){const listeners=focusLost.get(player)??new Set();listeners.add(fn);focusLost.set(player,listeners);return()=>{listeners.delete(fn);if(!listeners.size)focusLost.delete(player);};}
function suspend(player:ReturnType<typeof createExpoAudioPlayer>){player.pause();player.clearLockScreenControls?.();(player as typeof player&{setSleepTimer?:(seconds:null)=>void}).setSleepTimer?.(null);focusLost.get(player)?.forEach(fn=>fn());}
export function stopActiveAudio(){if(active)suspend(active);active=null;}
export const createManagedAudioPlayer:typeof createExpoAudioPlayer=(...args)=>{
 const player=createExpoAudioPlayer(...args),play=player.play.bind(player),release=player.release.bind(player);
 const claim=()=>{if(active&&active!==player)suspend(active);active=player;};
 player.play=()=>{claim();play();};
 if(player.setActiveForLockScreen){const lock=player.setActiveForLockScreen.bind(player);player.setActiveForLockScreen=(enabled,...rest)=>{if(enabled)claim();lock(enabled,...rest);};}
 player.release=()=>{if(active===player)active=null;focusLost.delete(player);release();};
 return player;
};
