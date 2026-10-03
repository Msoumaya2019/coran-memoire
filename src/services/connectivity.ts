import {useEffect,useState} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {flushPendingSync} from './offlineSync';
export function useConnectivity(){
 const [offline,setOffline]=useState(false),[restored,setRestored]=useState(false);
 useEffect(()=>{let wasOffline=false,timer:ReturnType<typeof setTimeout>|undefined;
  const unsubscribe=NetInfo.addEventListener(network=>{const down=network.isConnected===false||network.isInternetReachable===false;setOffline(down);
   if(!down&&wasOffline){setRestored(true);if(timer)clearTimeout(timer);timer=setTimeout(()=>setRestored(false),3000);flushPendingSync().catch(()=>{});}
   wasOffline=down;
  });return()=>{unsubscribe();if(timer)clearTimeout(timer);};
 },[]);return {offline,restored};
}
