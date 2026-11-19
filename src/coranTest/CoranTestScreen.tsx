import type {InkCommit} from '../core/tabletInk';
import type {AnnotationSelection} from '../core/readerAnnotations';
import {ReaderPageTurn} from '../ui/ReaderPageTurn';
import React,{useEffect,useRef,useState} from 'react';
import {Platform,View,Pressable,Text} from 'react-native';
import {PageSurface} from './PageSurface';
import {loadTestPage} from './loadPage';
import {adjacentTestPages,MeasuredWord,verseRegions,ReaderOverlayState,verseIndex,VerseKey,selectionFromWords} from './model';
import {pageAfterSwipe} from '../core/pageNavigation';

export function CoranTestScreen({animate=true,preload=true,page,onPage,onClose,readerState,onStudyPress,onVersePress,onVerseLongPress,onSelection,onAnnotationPress,onBlankLongPress,onTap,onInkCommit,onInkErase,onInkCapability,onReady}:{animate?:boolean;preload?:boolean;onInkCommit?:(stroke:InkCommit,selection?:AnnotationSelection)=>void;onInkErase?:(ids:string[],page:number)=>void;onInkCapability?:(pen:boolean,pressure:boolean)=>void;onReady?:(page:number)=>void;page:number;onPage:(page:number)=>void;onClose:()=>void;readerState?:ReaderOverlayState;onStudyPress?:()=>void;onVersePress?:(id:number)=>void;onVerseLongPress?:(id:number)=>void;onSelection?:(selection:AnnotationSelection)=>void;onAnnotationPress?:(id:string)=>void;onBlankLongPress?:()=>void;onTap?:()=>void}){
 const [pages,setPages]=useState<Record<number,string>>({}),[displayPage,setDisplayPage]=useState(page),[readyPage,setReadyPage]=useState<number|null>(null),[loadError,setLoadError]=useState(false),[retry,setRetry]=useState(0);
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const applied=useRef(new Map<number,string|undefined>()),notified=useRef('');
 const readyPages=useRef(new Set<number>()),current=useRef(page);
 // Metadata remains independent of visible state. Future playback can use this
 // map without replacing the original glyphs or introducing another text view.
 const overlay=useRef(new Map<number,ReturnType<typeof verseRegions>>()),measurements=useRef(new Map<number,MeasuredWord[]>());
 current.current=page;
 useEffect(()=>{
   let alive=true;const neighbors=adjacentTestPages(page);
   for(const target of readyPage===page&&preload?neighbors:[page])loadTestPage(target).then(html=>{if(alive)setPages(old=>Object.fromEntries(Object.entries({...old,[target]:html}).filter(([key])=>neighbors.includes(Number(key)))));}).catch(error=>{console.error('[Coran avec règles de Tajwid] font/page',target,error);if(alive&&target===current.current)setLoadError(true);});
   if(readyPages.current.has(page)){setDisplayPage(page);if(readyPage!==page)setReadyPage(page);}
   return()=>{alive=false;};
 },[page,retry,readyPage,preload]);
 const reportReady=(target:number)=>{const token=readerState?.exportToken,key=target+':'+(token??'live');if(target===current.current&&readyPages.current.has(target)&&(!token||applied.current.get(target)===token)&&notified.current!==key){notified.current=key;onReady?.(target);}};
 const receive=(target:number,data:any)=>{
   if(!mounted.current)return;
   if(data.type==='ready'&&data.page===target){
     readyPages.current.add(target);measurements.current.set(target,data.words as MeasuredWord[]);overlay.current.set(target,verseRegions(data.words as MeasuredWord[]));
     for(const p of overlay.current.keys())if(!adjacentTestPages(current.current).includes(p)){overlay.current.delete(p);measurements.current.delete(p);readyPages.current.delete(p);}
     if(target===current.current){setDisplayPage(target);setReadyPage(target);setLoadError(false);reportReady(target);}
   }else if(data.type==='state-applied'){applied.current.set(target,data.token);reportReady(target);
   }else if(data.type==='ink-commit'&&target===current.current){
     const v=data.stroke;if(v&&['pen','highlight','circle','underline','arrow','note'].includes(v.tool)&&typeof v.id==='string'&&Array.isArray(v.points)&&v.points.length>0&&v.points.length<=4096&&v.points.every((p:any)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)&&/^#[0-9a-f]{6}$/i.test(v.color)&&Number.isFinite(v.width)&&v.width>0&&v.width<=.06){const related=v.related?.verseKey&&verseIndex[v.related.verseKey as VerseKey];onInkCommit?.({...v,page:target,related:related?{verseId:related.id,surah:Number(v.related.verseKey.split(':')[0])}:undefined},selectionFromWords(measurements.current.get(target)??[],data.key as VerseKey,data.wordId));}
   }else if(data.type==='ink-erase'&&target===current.current){if(Array.isArray(data.ids))onInkErase?.(data.ids.filter((id:unknown)=>typeof id==='string'),target);
   }else if(data.type==='ink-capability'&&target===current.current){onInkCapability?.(!!data.pen,!!data.pressure);
   }else if(data.type==='study'&&target===displayPage){onStudyPress?.();
   }else if(data.type==='tap'&&target===displayPage){
     const id=typeof data.key==='string'?verseIndex[data.key as VerseKey]?.id:undefined;
     if(readerState?.selecting&&id!==undefined)onVersePress?.(id);else if(typeof data.annotationId==='string')onAnnotationPress?.(data.annotationId);else onTap?.();
   }else if(data.type==='longpress'&&target===displayPage){
     const id=typeof data.key==='string'?verseIndex[data.key as VerseKey]?.id:undefined;
     const selection=selectionFromWords(measurements.current.get(target)??[],data.key as VerseKey,data.wordId);
     if(selection&&onSelection)onSelection({...selection,annotationId:typeof data.annotationId==='string'?data.annotationId:undefined});else if(id!==undefined)onVerseLongPress?.(id);else onBlankLongPress?.();
   }else if(data.type==='swipe'&&target===displayPage){
     if(Platform.OS==='ios'&&data.fromEdge&&data.dx>100){onClose();return;}
     const next=pageAfterSwipe(current.current,data.dx,data.dy);if(next!==current.current)onPage(next);
   }else if(data.type==='error'&&target===current.current){setLoadError(true);readyPages.current.delete(target);setReadyPage(null);}
 };
 return <View style={{flex:1,backgroundColor:readerState?.background??'#faf7f2'}}><ReaderPageTurn page={animate?displayPage:0}>{Object.entries(pages).map(([key,html])=>{const target=Number(key);return <View key={key} aria-hidden={target!==displayPage} pointerEvents={target===displayPage?'auto':'none'} accessibilityElementsHidden={target!==displayPage} importantForAccessibility={target===displayPage?'auto':'no-hide-descendants'} style={{position:'absolute',inset:0,opacity:target===displayPage?1:0}}><PageSurface html={html} readerState={readerState} onMessage={data=>receive(target,data)}/></View>;})}</ReaderPageTurn>{(readyPage!==page||loadError)&&<View style={{position:'absolute',top:8,left:12,right:12,alignItems:'center'}}>{loadError?<Pressable accessibilityRole="button" onPress={()=>{setLoadError(false);setPages(old=>{const next={...old};delete next[page];return next;});setRetry(n=>n+1);}} style={{padding:12,borderRadius:14,backgroundColor:'#FFFFFF',minHeight:44}}><Text style={{fontSize:13,color:'#246B48'}}>La page n’a pas pu être chargée. Réessayer</Text></Pressable>:<Text style={{fontSize:12,color:'#746D7B',backgroundColor:'#FFFFFF',padding:6,borderRadius:10}}>Chargement du Coran…</Text>}</View>}</View>;
}
