export type InkPoint = {x:number;y:number};
export type InkTool = 'highlight'|'circle'|'pen'|'note';
export type ReaderAnnotation = {id:string;source:string;page:number;tool:InkTool;color:string;points:InkPoint[];text:string;updatedAt:string;deletedAt?:string};
export type ReaderAnnotations = Record<string,ReaderAnnotation>;
export function pageAnnotations(items:ReaderAnnotations|undefined,source:string,page:number){
  return Object.values(items??{}).filter(item=>!item.deletedAt&&item.source===source&&item.page===page).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
}
export function mergeReaderAnnotations(local:ReaderAnnotations={},remote:ReaderAnnotations={}):ReaderAnnotations{
  const result={...remote};
  for(const [id,item] of Object.entries(local)){
    const other=result[id];
    if(!other||item.updatedAt>other.updatedAt||item.updatedAt===other.updatedAt&&(
      !!item.deletedAt&&!other.deletedAt||!!item.deletedAt===!!other.deletedAt&&JSON.stringify(item)>JSON.stringify(other)
    ))result[id]=item;
  }
  return result;
}
/** Coordinates belong to the printed page, independently of tablet orientation. */
export function paperRect(width:number,height:number,sourceWidth:number,sourceHeight:number,centerY=false){
  const scale=Math.min(width/sourceWidth,height/sourceHeight);
  const w=sourceWidth*scale,h=sourceHeight*scale;
  return {x:(width-w)/2,y:centerY?(height-h)/2:0,width:w,height:h};
}
export function inkPoint(x:number,y:number,rect:ReturnType<typeof paperRect>,clamp=false):InkPoint|null{
  if(rect.width<=0||rect.height<=0)return null;
  const px=(x-rect.x)/rect.width,py=(y-rect.y)/rect.height;
  if(!clamp&&(px<0||px>1||py<0||py>1))return null;
  return {x:Math.max(0,Math.min(1,px)),y:Math.max(0,Math.min(1,py))};
}
