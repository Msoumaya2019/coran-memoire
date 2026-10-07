import {createAudioPlayer as createExpoAudioPlayer} from 'expo-audio';
let active:ReturnType<typeof createExpoAudioPlayer>|null=null;
export function stopActiveAudio(){active?.pause();active?.clearLockScreenControls?.();(active as typeof active&{setSleepTimer?:(seconds:null)=>void})?.setSleepTimer?.(null);active=null;}
export const createManagedAudioPlayer:typeof createExpoAudioPlayer=(...args)=>{
 const player=createExpoAudioPlayer(...args),play=player.play.bind(player),release=player.release.bind(player);
 player.play=()=>{if(active&&active!==player){active.pause();active.clearLockScreenControls?.();(active as typeof active&{setSleepTimer?:(seconds:null)=>void}).setSleepTimer?.(null);}active=player;play();};
 player.release=()=>{if(active===player)active=null;release();};
 return player;
};
