import {useEffect,useState} from 'react';
import * as Device from 'expo-device';
import type {DeviceClass} from '../core/tablet';
export function useDeviceClass():DeviceClass{
 const classify=(type:Device.DeviceType|null)=>type===Device.DeviceType.TABLET?'tablet':type===Device.DeviceType.PHONE?'phone':'unknown';
 const [kind,setKind]=useState<DeviceClass>(()=>classify(Device.deviceType));
 useEffect(()=>{let alive=true;Device.getDeviceTypeAsync().then(type=>{if(alive)setKind(classify(type));}).catch(()=>{});return()=>{alive=false;};},[]);
 return kind;
}
