import React,{useEffect,useState} from 'react';
import {AppState,View} from 'react-native';
import {ensureQuranDownloaded,pauseQuranDownload,quranDownloadState,quranDownloaded,subscribeQuranDownload} from '../services/quranDownload';
import {Button,Choice,Label,colors} from './theme';

export function DownloadSourceChoice({selected,onSelect}:{selected:boolean;onSelect:()=>void}){
 const [expanded,setExpanded]=useState(false);
 return <><Choice label="Coran 1441" subtitle="Pages originales · téléchargement à la demande · lecture hors connexion" selected={selected} onPress={()=>{if(quranDownloaded())onSelect();else setExpanded(true);}}/>{expanded&&<QuranDownload onReady={()=>{setExpanded(false);onSelect();}} onBack={()=>setExpanded(false)}/>}</>;
}

export function QuranDownload({onReady,onBack}:{onReady:()=>void;onBack?:()=>void}){
 const [status,setStatus]=useState(quranDownloadState);
 useEffect(()=>subscribeQuranDownload(setStatus),[]);
 useEffect(()=>{if(status.phase==='ready')onReady();},[status.phase]);
 useEffect(()=>{const subscription=AppState.addEventListener('change',value=>{if(value!=='active')pauseQuranDownload().catch(()=>{});});return ()=>{subscription.remove();pauseQuranDownload().catch(()=>{});};},[]);
 const busy=status.phase==='downloading'||status.phase==='extracting';
 return <View style={{padding:16,gap:8}}>
  <Label style={{fontWeight:'700'}}>Coran 1441</Label>
  <Label style={{fontSize:13,color:colors.muted}}>Téléchargement initial · environ 98 Mo. Les pages resteront disponibles hors connexion.</Label>
  {busy&&<><Label>{status.phase==='extracting'?'Installation des pages':'Téléchargement'} · {Math.round(status.progress*100)} %</Label><View style={{height:5,backgroundColor:colors.line,borderRadius:3}}><View style={{height:5,width:`${status.progress*100}%`,backgroundColor:colors.green,borderRadius:3}}/></View></>}
  {status.message&&<Label>{status.message}</Label>}
  {status.phase==='downloading'?<Button secondary onPress={()=>pauseQuranDownload().catch(()=>{})}>Mettre en pause</Button>:!busy&&<Button onPress={()=>ensureQuranDownloaded().catch(()=>{})}>{status.phase==='idle'?'Télécharger et utiliser':'Reprendre le téléchargement'}</Button>}
  {onBack&&<Button secondary onPress={onBack}>Retour</Button>}
 </View>;
}
