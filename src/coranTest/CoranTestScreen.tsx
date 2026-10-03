import React,{useEffect,useRef,useState} from 'react';
import {Platform,View,Pressable,Text} from 'react-native';
import {PageSurface} from './PageSurface';
import {loadTestPage} from './loadPage';
import {adjacentTestPages,MeasuredWord,verseRegions,ReaderOverlayState,verseIndex,VerseKey} from './model';
import {pageAfterSwipe} from '../core/pageNavigation';

export function CoranTestScreen({page,onPage,onClose,readerState,onStudyPress,onVersePress,onVerseLongPress,onBlankLongPress,onTap}:{page:number;onPage:(page:number)=>void;onClose:()=>void;readerState?:ReaderOverlayState;onStudyPress?:()=>void;onVersePress?:(id:number)=>void;onVerseLongPress?:(id:number)=>void;onBlankLongPress?:()=>void;onTap?:()=>void}){
 const [pages,setPages]=useState<Record<number,string>>({}),[displayPage,setDisplayPage]=useState(page),[readyPage,setReadyPage]=useState<number|null>(null),[loadError,setLoadError]=useState(false),[retry,setRetry]=useState(0);
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const readyPages=useRef(new Set<number>()),current=useRef(page);
 // Metadata remains independent of visible state. Future playback can use this
 // map without replacing the original glyphs or introducing another text view.
 const overlay=useRef(new Map<number,ReturnType<typeof verseRegions>>());
 current.current=page;
 useEffect(()=>{
   let alive=true;const neighbors=adjacentTestPages(page);
   for(const target of readyPage===page?neighbors:[page])loadTestPage(target).then(html=>{if(alive)setPages(old=>Object.fromEntries(Object.entries({...old,[target]:html}).filter(([key])=>neighbors.includes(Number(key)))));}).catch(error=>{console.error('[Coran avec règles de Tajwid] font/page',target,error);if(alive&&target===current.current)setLoadError(true);});
   if(readyPages.current.has(page)){setDisplayPage(page);if(readyPage!==page)setReadyPage(page);}
   return()=>{alive=false;};
 },[page,retry,readyPage]);
 const receive=(target:number,data:any)=>{
   if(!mounted.current)return;
   if(data.type==='ready'&&data.page===target){
     readyPages.current.add(target);overlay.current.set(target,verseRegions(data.words as MeasuredWord[]));
     for(const p of overlay.current.keys())if(!adjacentTestPages(current.current).includes(p)){overlay.current.delete(p);readyPages.current.delete(p);}
     if(target===current.current){setDisplayPage(target);setReadyPage(target);setLoadError(false);}
   }else if(data.type==='study'&&target===displayPage){onStudyPress?.();
   }else if(data.type==='tap'&&target===displayPage){
     const id=typeof data.key==='string'?verseIndex[data.key as VerseKey]?.id:undefined;
     if(readerState?.selecting&&id!==undefined)onVersePress?.(id);else onTap?.();
   }else if(data.type==='longpress'&&target===displayPage){
     const id=typeof data.key==='string'?verseIndex[data.key as VerseKey]?.id:undefined;
     if(id!==undefined)onVerseLongPress?.(id);else onBlankLongPress?.();
   }else if(data.type==='swipe'&&target===displayPage){
     if(Platform.OS==='ios'&&data.fromEdge&&data.dx>100){onClose();return;}
     const next=pageAfterSwipe(current.current,data.dx,data.dy);if(next!==current.current)onPage(next);
   }else if(data.type==='error'&&target===current.current){setLoadError(true);readyPages.current.delete(target);setReadyPage(null);}
 };
 return <View style={{flex:1,backgroundColor:readerState?.background??'#faf7f2'}}>{Object.entries(pages).map(([key,html])=>{const target=Number(key);return <View key={key} aria-hidden={target!==displayPage} pointerEvents={target===displayPage?'auto':'none'} accessibilityElementsHidden={target!==displayPage} importantForAccessibility={target===displayPage?'auto':'no-hide-descendants'} style={{position:'absolute',inset:0,opacity:target===displayPage?1:0}}><PageSurface html={html} readerState={readerState} onMessage={data=>receive(target,data)}/></View>;})}{(readyPage!==page||loadError)&&<View style={{position:'absolute',top:8,left:12,right:12,alignItems:'center'}}>{loadError?<Pressable accessibilityRole="button" onPress={()=>{setLoadError(false);setPages(old=>{const next={...old};delete next[page];return next;});setRetry(n=>n+1);}} style={{padding:12,borderRadius:14,backgroundColor:'#FFFFFF',minHeight:44}}><Text style={{fontSize:13,color:'#246B48'}}>La page n’a pas pu être chargée. Réessayer</Text></Pressable>:<Text style={{fontSize:12,color:'#746D7B',backgroundColor:'#FFFFFF',padding:6,borderRadius:10}}>Chargement du Coran…</Text>}</View>}</View>;
}
