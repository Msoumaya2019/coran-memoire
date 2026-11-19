import React,{useEffect,useRef,useState} from 'react';
import {PointerEvent,View} from 'react-native';
import {AnnotationMark,AnnotationRegion,annotationRegions,InkPoint} from '../core/readerAnnotations';
import {InkCommit,InkSettings,inkHit} from '../core/tabletInk';
import {ReaderAnnotationMarks} from './ReaderAnnotationMarks';

type Gesture={stroke:InkCommit;pointerId:number;pointerType:string;pending:number;ended:boolean;cancelled:boolean;erased:Set<string>};
type Props={width:number;height:number;page:number;ink?:InkSettings;marks:AnnotationMark[];mapPoint:(event:PointerEvent,callback:(x:number,y:number)=>void)=>void;onCommit?:(stroke:InkCommit)=>void;onErase?:(ids:string[],page:number)=>void;onCapability?:(pen:boolean,pressure:boolean)=>void;onPointerType?:(type:string)=>void;onStrokeActive?:(active:boolean)=>void;verses?:Record<string,AnnotationRegion[]>;children:React.ReactNode};

export function NativeInkSurface({width,height,page,ink,marks,mapPoint,onCommit,onErase,onCapability,onPointerType,onStrokeActive,verses={},children}:Props){
 const gesture=useRef<Gesture|null>(null),frame=useRef<number|null>(null),[draft,setDraft]=useState<InkCommit|null>(null);
 const paint=()=>{if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;const current=gesture.current;setDraft(current&&!current.ended&&!current.cancelled?{...current.stroke}:null);});};
 const cancel=()=>{if(gesture.current)gesture.current.cancelled=true;gesture.current=null;onStrokeActive?.(false);setDraft(null);};
 useEffect(()=>()=>{if(gesture.current)gesture.current.cancelled=true;if(frame.current!==null)cancelAnimationFrame(frame.current);onStrokeActive?.(false);},[]);
 // The page may resize while a native coordinate measurement is pending. Cancel
 // that gesture instead of applying the old coordinate system to the new page.
 useEffect(()=>{cancel();},[page,width,height]);
 const eligible=(event:PointerEvent)=>!!ink?.enabled&&ink.tool!=='select'&&(event.nativeEvent.pointerType==='pen'||!ink.stylusOnly&&['touch','mouse'].includes(event.nativeEvent.pointerType));
 const complete=(current:Gesture)=>{
  if(current.cancelled||!current.ended||current.pending)return;
  current.cancelled=true;if(gesture.current===current)gesture.current=null;
  if(current.stroke.tool==='eraser'){if(current.erased.size)onErase?.([...current.erased],current.stroke.page);}
  else if(current.stroke.points.length)onCommit?.(current.stroke);
 };
 const append=(event:PointerEvent,current:Gesture)=>{
  const pressure=event.nativeEvent.pointerType==='pen'&&Number.isFinite(event.nativeEvent.pressure)&&event.nativeEvent.pressure>0?event.nativeEvent.pressure:undefined;
  current.pending++;
  mapPoint(event,(x,y)=>{
   current.pending--;if(current.cancelled)return;
   const p:InkPoint={x:Math.max(0,Math.min(1,x/width)),y:Math.max(0,Math.min(1,y/height)),...(pressure===undefined?{}:{pressure})};
   const last=current.stroke.points.at(-1);
   if(!last||Math.hypot((last.x-p.x)*width,(last.y-p.y)*height)>=1){
    if(current.stroke.points.length<4096)current.stroke.points=[...current.stroke.points,p];
    if(current.stroke.tool==='eraser')for(const n of marks)if((n.page===page&&!n.anchor&&inkHit(n,p))||annotationRegions(n,page,verses).some(r=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height))current.erased.add(n.id);
   }
   if(current.ended)complete(current);else paint();
  });
 };
 return <View style={{width,height}}
  onPointerDownCapture={event=>{
   const type=event.nativeEvent.pointerType;onPointerType?.(type);
   if(gesture.current){event.stopPropagation();if(type==='touch'&&gesture.current.pointerType!=='pen')cancel();return;}
   if(!eligible(event))return;event.stopPropagation();onStrokeActive?.(true);
   const settings=ink!,current:Gesture={stroke:{id:`ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,page,tool:settings.tool,points:[],color:settings.color,width:settings.width,penStyle:settings.penStyle},pointerId:event.nativeEvent.pointerId,pointerType:type,pending:0,ended:false,cancelled:false,erased:new Set()};
   gesture.current=current;append(event,current);
   if(type==='pen')onCapability?.(true,event.nativeEvent.pressure>0);
  }}
  onPointerMoveCapture={event=>{const current=gesture.current;if(!current||current.ended||event.nativeEvent.pointerId!==current.pointerId)return;event.stopPropagation();append(event,current);}}
  onPointerUpCapture={event=>{const current=gesture.current;if(!current||event.nativeEvent.pointerId!==current.pointerId)return;event.stopPropagation();current.ended=true;onStrokeActive?.(false);setDraft(null);complete(current);}}
  onPointerCancel={event=>{if(event.nativeEvent.pointerId===gesture.current?.pointerId)cancel();}}
 >{children}{draft&&draft.tool!=='eraser'&&draft.tool!=='note'&&<ReaderAnnotationMarks marks={[{...draft,source:'preview'} as AnnotationMark]} page={page} width={width} height={height} verses={{}}/>}</View>;
}
