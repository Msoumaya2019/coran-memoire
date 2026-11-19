import React,{useMemo,useRef,useState} from 'react';
import {PanResponder,View} from 'react-native';
import Svg,{Circle,Path} from 'react-native-svg';
import {InkPoint,NoteStroke} from '../core/readerAnnotations';

export function NoteHandwriting({strokes,color,onChange}:{strokes:NoteStroke[];color:string;onChange:(strokes:NoteStroke[])=>void}){
 const [size,setSize]=useState({width:1,height:1}),[draft,setDraft]=useState<InkPoint[]>([]),points=useRef<InkPoint[]>([]);
 const current=useRef({strokes,color,onChange,size});current.current={strokes,color,onChange,size};
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,onPanResponderTerminationRequest:()=>false,
  onPanResponderGrant:event=>{const {locationX:x,locationY:y,touches}=event.nativeEvent;const {size}=current.current;points.current=touches.length>1?[]:[{x:x/size.width,y:y/size.height}];setDraft(points.current);},
  onPanResponderMove:event=>{const {locationX:x,locationY:y,touches}=event.nativeEvent;const {size}=current.current;if(touches.length>1){points.current=[];setDraft([]);return;}if(!points.current.length)return;const p={x:Math.max(0,Math.min(1,x/size.width)),y:Math.max(0,Math.min(1,y/size.height))},last=points.current.at(-1)!;if(Math.hypot((p.x-last.x)*size.width,(p.y-last.y)*size.height)<1.5)return;if(points.current.length<2000){points.current=[...points.current,p];setDraft(points.current);}},
  onPanResponderRelease:()=>{if(points.current.length){const v=current.current;v.onChange([...v.strokes,{points:points.current,color:v.color}]);}points.current=[];setDraft([]);},
  onPanResponderTerminate:()=>{points.current=[];setDraft([]);},
 }),[]);
 const all=[...strokes,...(draft.length?[{points:draft,color}]:[])];
 return <View {...responder.panHandlers} accessibilityLabel="Écrire la note au stylet ou au doigt" onLayout={event=>setSize(event.nativeEvent.layout)} style={{height:240,borderRadius:12,borderWidth:1,borderColor:'#DDD5C9',backgroundColor:'#FFFCF6',overflow:'hidden'}}><Svg pointerEvents="none" width={size.width} height={size.height}>{[.25,.5,.75].map(y=><Path key={y} d={`M0,${y*size.height}H${size.width}`} stroke="#E7E1D7" strokeWidth={1}/>)}{all.map((stroke,index)=>stroke.points.length===1?<Circle key={index} cx={stroke.points[0].x*size.width} cy={stroke.points[0].y*size.height} r={1.3} fill={stroke.color}/>:<Path key={index} d={stroke.points.map((p,i)=>`${i?'L':'M'}${p.x*size.width},${p.y*size.height}`).join(' ')} stroke={stroke.color} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>)}</Svg></View>;
}
