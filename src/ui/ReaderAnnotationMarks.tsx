import {pressurePaths,inkShapePath} from '../core/tabletInk';
import React from 'react';
import {View} from 'react-native';
import Svg,{Ellipse,G,Path,Rect,Text as SvgText} from 'react-native-svg';
import {AnnotationMark,AnnotationRegion,annotationRegions} from '../core/readerAnnotations';

export const ReaderAnnotationMarks=React.memo(function ReaderAnnotationMarks({marks,page,width,height,verses,canvas}:{canvas?:{width:number;height:number;offsetX:number;offsetY:number};marks:AnnotationMark[];page:number;width:number;height:number;verses:Record<string,AnnotationRegion[]>}){
 return <View pointerEvents="none" style={{position:'absolute',inset:0}}><Svg width={canvas?.width??width} height={canvas?.height??height}><G transform={`translate(${canvas?.offsetX??0},${canvas?.offsetY??0})`}>{marks.flatMap(item=>{
  if(item.anchor)return annotationRegions(item,page,verses).map((r,index)=>item.tool==='underline'?<Path key={item.id+'-'+index} d={'M'+r.x*width+','+(r.y+r.height)*height+'L'+(r.x+r.width)*width+','+(r.y+r.height)*height} stroke={item.color} strokeWidth={(item.width??.003)*width} strokeLinecap="round"/>:item.tool==='circle'?<Ellipse key={`${item.id}-${index}`} cx={(r.x+r.width/2)*width} cy={(r.y+r.height/2)*height} rx={r.width*width/2+3} ry={r.height*height/2+2} stroke={item.color} strokeWidth={item.width?item.width*width:2} fill="none"/>:<Rect key={`${item.id}-${index}`} x={r.x*width-1} y={r.y*height} width={r.width*width+2} height={r.height*height} rx={3} fill={item.color} opacity={.24}/>);
  if(item.page!==page||!item.points.length)return [];
  const points=item.points.map(p=>({...p,x:p.x*width,y:p.y*height})),first=points[0],last=points.at(-1)!;
  if(item.tool==='circle')return [<Ellipse key={item.id} cx={(first.x+last.x)/2} cy={(first.y+last.y)/2} rx={Math.abs(last.x-first.x)/2} ry={Math.abs(last.y-first.y)/2} stroke={item.color} strokeWidth={(item.width??.006)*width} fill="none"/>];
  if(item.tool==='note')return [<SvgText key={item.id} x={first.x} y={first.y} fontSize={16} fill={item.color}>✎</SvgText>];
  const strokeWidth=item.width?item.width*width:item.tool==='highlight'?height*.018:2.5;
  const parts=item.tool==='pen'?pressurePaths(points,strokeWidth):[{d:inkShapePath(item.tool,points,width*.035),width:strokeWidth}];
  return parts.map((part,index)=><Path key={item.id+'-'+index} d={part.d} stroke={item.color} opacity={item.tool==='highlight'?.26:item.penStyle==='pencil'?.6:1} strokeWidth={part.width} fill="none" strokeLinecap="round" strokeLinejoin="round"/>);
 })}</G></Svg></View>;
},(a,b)=>a.canvas?.width===b.canvas?.width&&a.canvas?.height===b.canvas?.height&&a.canvas?.offsetX===b.canvas?.offsetX&&a.canvas?.offsetY===b.canvas?.offsetY&&a.page===b.page&&a.width===b.width&&a.height===b.height&&a.verses===b.verses&&a.marks.length===b.marks.length&&a.marks.every((n,i)=>{const v=b.marks[i];return n.id===v.id&&n.color===v.color&&n.tool===v.tool&&n.width===v.width&&n.penStyle===v.penStyle&&n.points===v.points&&n.anchor===v.anchor;}));
