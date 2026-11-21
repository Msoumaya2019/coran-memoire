import type {AnnotationMark,InkPoint,ReaderAnnotation} from './readerAnnotations';
import type {TabletTool} from './tablet';
export type InkSettings={enabled:boolean;tool:TabletTool;color:string;width:number;stylusOnly:boolean;penStyle:'ink'|'pencil'};
export type InkCommit={id:string;page:number;tool:TabletTool;points:InkPoint[];color:string;width:number;penStyle?:'ink'|'pencil';related?:ReaderAnnotation['related']};
/** Standalone helpers are also embedded in the original WebView page. */
export function pressurePaths(points:InkPoint[],width:number){
 const paths:{d:string;width:number}[]=[];
 if(points.length===1)return [{d:`M${points[0].x},${points[0].y}l.00001,.00001`,width}];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],pressure=b.pressure===undefined?undefined:Math.max(.25,Math.min(1,b.pressure));
  const w=pressure===undefined?width:width*Math.round((.4+.8*pressure)*4)/4,last=paths[paths.length-1];
  if(last&&last.width===w)last.d+=`L${b.x},${b.y}`;else paths.push({d:`M${a.x},${a.y}L${b.x},${b.y}`,width:w});
 }
 return paths;
}
export function inkShapePath(tool:string,points:InkPoint[],headSize=.035){
 if(!points.length)return '';
 const a=points[0],b=points[points.length-1];
 if(tool==='underline')return `M${a.x},${a.y}L${b.x},${a.y}`;
 if(tool==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x),length=Math.min(headSize,Math.hypot(b.x-a.x,b.y-a.y)*.3);return `M${a.x},${a.y}L${b.x},${b.y}M${b.x-length*Math.cos(angle-.5)},${b.y-length*Math.sin(angle-.5)}L${b.x},${b.y}L${b.x-length*Math.cos(angle+.5)},${b.y-length*Math.sin(angle+.5)}`;}
 return points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
}
export function inkHit(mark:AnnotationMark,p:InkPoint){
 if(!mark.points.length)return false;
 const points=mark.points,r=Math.max(.006,(mark.width??.003)/2),a=points[0],b=points[points.length-1];
 if(mark.tool==='note')return Math.hypot(p.x-a.x,p.y-a.y)<.025;
 if(mark.tool==='circle'){const rx=Math.abs(b.x-a.x)/2,ry=Math.abs(b.y-a.y)/2;if(rx<.0001||ry<.0001)return Math.hypot(p.x-a.x,p.y-a.y)<r;const d=Math.sqrt(((p.x-(a.x+b.x)/2)/rx)**2+((p.y-(a.y+b.y)/2)/ry)**2);return Math.abs(d-1)<=r/Math.min(rx,ry);}
 for(let i=1;i<points.length;i++){const a=points[i-1],b=mark.tool==='underline'?{x:points[points.length-1].x,y:points[0].y}:points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=r)return true;if(mark.tool==='underline')break;}
 return points.length===1&&Math.hypot(p.x-a.x,p.y-a.y)<=r;
}
export function historyRestore(previous:ReaderAnnotation|undefined,current:ReaderAnnotation,now:string):ReaderAnnotation{
 return previous?{...previous,deletedAt:previous.deletedAt?now:undefined,updatedAt:now}:{...current,deletedAt:now,updatedAt:now};
}
