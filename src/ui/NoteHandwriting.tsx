import React,{useMemo,useRef,useState} from 'react';
import {PanResponder,View} from 'react-native';
import Svg,{Circle,Path} from 'react-native-svg';
import {InkPoint,NoteStroke} from '../core/readerAnnotations';

export function NoteHandwriting({strokes,color,onChange,stylusOnly=false,onDrawingChange}:{onDrawingChange?:(active:boolean)=>void;stylusOnly?:boolean;strokes:NoteStroke[];color:string;onChange:(strokes:NoteStroke[])=>void}){
 const [size,setSize]=useState({width:1,height:1}),[draft,setDraft]=useState<InkPoint[]>([]),points=useRef<InkPoint[]>([]),activePointer=useRef<number|null>(null);
 const current=useRef({strokes,color,onChange,size,stylusOnly});current.current={strokes,color,onChange,size,stylusOnly};
 const begin=(x:number,y:number)=>{onDrawingChange?.(true);const {size}=current.current;points.current=[{x:x/size.width,y:y/size.height}];setDraft([...points.current]);};
 const move=(x:number,y:number)=>{const {size}=current.current,last=points.current.at(-1);if(!last)return;const p={x:Math.max(0,Math.min(1,x/size.width)),y:Math.max(0,Math.min(1,y/size.height))};if(Math.hypot((p.x-last.x)*size.width,(p.y-last.y)*size.height)<1)return;if(points.current.length<4000){points.current=[...points.current,p];setDraft(points.current);}};
 const finish=()=>{onDrawingChange?.(false);if(points.current.length){const v=current.current;v.onChange([...v.strokes,{color:v.color,points:[...points.current]}]);}points.current=[];activePointer.current=null;setDraft([]);};
 const cancel=()=>{onDrawingChange?.(false);points.current=[];activePointer.current=null;setDraft([]);};
 // Capture contacts independently of pointer classification: some RN versions
 // negotiate the touch responder before dispatching the Pencil pointer event.
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,onPanResponderTerminationRequest:()=>false,
  onPanResponderGrant:event=>{if(activePointer.current!==null||current.current.stylusOnly)return;const e=event.nativeEvent;if(e.touches.length>1)return;begin(e.locationX,e.locationY);},
  onPanResponderMove:event=>{if(activePointer.current!==null)return;const e=event.nativeEvent;if(e.touches.length>1){cancel();return;}if(!current.current.stylusOnly)move(e.locationX,e.locationY);},
  onPanResponderRelease:()=>{if(activePointer.current===null)finish();},onPanResponderTerminate:cancel,
 }),[]);
 const all=[...strokes,...(draft.length?[{points:draft,color}]:[])];
 return <View {...responder.panHandlers}
  onPointerDownCapture={event=>{const e=event.nativeEvent;if(activePointer.current!==null)return;if(e.pointerType!=='pen')return;activePointer.current=e.pointerId;begin(e.offsetX,e.offsetY);}}
  onPointerMoveCapture={event=>{const e=event.nativeEvent;if(e.pointerId===activePointer.current)move(e.offsetX,e.offsetY);}}
  onPointerUpCapture={event=>{if(event.nativeEvent.pointerId===activePointer.current)finish();}}
  onPointerCancel={event=>{if(event.nativeEvent.pointerId===activePointer.current)cancel();}}
  accessibilityLabel={stylusOnly?'Écrire la note au stylet uniquement':'Écrire la note au stylet ou au doigt'} onLayout={event=>setSize(event.nativeEvent.layout)} style={{height:280,borderRadius:12,borderWidth:1,borderColor:'#DDD5C9',backgroundColor:'#FFFCF6',overflow:'hidden'}}><Svg pointerEvents="none" width={size.width} height={size.height}>{[.25,.5,.75].map(y=><Path key={y} d={`M0,${y*size.height}H${size.width}`} stroke="#E7E1D7" strokeWidth={1}/>)}{all.map((stroke,index)=>stroke.points.length===1?<Circle key={index} cx={stroke.points[0].x*size.width} cy={stroke.points[0].y*size.height} r={1.3} fill={stroke.color}/>:<Path key={index} d={stroke.points.map((p,i)=>`${i?'L':'M'}${p.x*size.width},${p.y*size.height}`).join(' ')} stroke={stroke.color} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>)}</Svg></View>;
}
