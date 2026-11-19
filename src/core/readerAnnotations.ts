export type InkPoint = {x:number;y:number};
export type InkTool = 'highlight'|'circle'|'pen'|'note';
export type AnnotationRegion = {x:number;y:number;width:number;height:number;line?:number};
export type AnnotationSelection = {verseId:number;verseKey?:string;wordId?:number;wordIndex?:number;wordText?:string;regions:AnnotationRegion[];verseRegions:AnnotationRegion[];annotationId?:string};
export type NoteStroke = {points:InkPoint[];color:string};
export type ReaderAnnotation = {id:string;source:string;page:number;tool:InkTool;color:string;points:InkPoint[];text:string;updatedAt:string;deletedAt?:string;anchor?:AnnotationSelection;handwriting?:NoteStroke[]};
export type AnnotationMark = Pick<ReaderAnnotation,'id'|'source'|'page'|'tool'|'color'|'points'|'anchor'>;
export type ReaderAnnotations = Record<string,ReaderAnnotation>;
export function pageAnnotations(items:ReaderAnnotations|undefined,source:string,page:number){
  return Object.values(items??{}).filter(item=>!item.deletedAt&&item.source===source&&item.page===page).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id));
}
/** Only mark geometry is sent to the page renderer; comments stay in the editor. */
export function annotationMarks(items:ReaderAnnotations|undefined,source:string):AnnotationMark[]{
  return Object.values(items??{}).filter(item=>!item.deletedAt&&item.source===source).map(({id,source,page,tool,color,points,anchor})=>({id,source,page,tool,color,points,anchor}));
}
export function selectionForScope(selection:AnnotationSelection,scope:'word'|'verse'):AnnotationSelection{
  if(scope==='word'&&(selection.wordId!==undefined||selection.wordIndex!==undefined))return {...selection,annotationId:undefined};
  return {verseId:selection.verseId,verseKey:selection.verseKey,regions:selection.verseRegions,verseRegions:selection.verseRegions};
}
/** Resolve anchors against the current layout, including verses split over pages. */
export function annotationRegions(mark:AnnotationMark,page:number,verses:Record<string,AnnotationRegion[]>={},words:Record<string,AnnotationRegion>={}):AnnotationRegion[]{
  const anchor=mark.anchor;
  if(!anchor)return [];
  if(anchor.wordId!==undefined)return words[String(anchor.wordId)]?[words[String(anchor.wordId)]]:[];
  const regions=verses[anchor.verseKey??String(anchor.verseId)];
  if(regions)return regions;
  return mark.page===page?anchor.regions:[];
}
export function annotationAtPoint(marks:AnnotationMark[],point:InkPoint,page:number,verses:Record<string,AnnotationRegion[]>={},words:Record<string,AnnotationRegion>={}):string|undefined{
  const hits=marks.flatMap(mark=>{
    let zones=annotationRegions(mark,page,verses,words);
    if(!mark.anchor&&mark.page===page&&mark.points.length){
      const xs=mark.points.map(p=>p.x),ys=mark.points.map(p=>p.y);
      zones=[{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}];
    }
    return zones.filter(r=>point.x>=r.x-.006&&point.x<=r.x+r.width+.006&&point.y>=r.y-.006&&point.y<=r.y+r.height+.006).map(r=>({id:mark.id,area:(r.width+.012)*(r.height+.012)}));
  });
  return hits.sort((a,b)=>a.area-b.area)[0]?.id;
}
export function annotationForSelection(items:ReaderAnnotations|undefined,source:string,selection:AnnotationSelection){
  return Object.values(items??{}).filter(n=>!n.deletedAt&&n.source===source&&n.anchor?.verseId===selection.verseId&&n.anchor.wordId===selection.wordId&&n.anchor.wordIndex===selection.wordIndex).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
}
export function annotationTime(previous?:string){return new Date(Math.max(Date.now(),(Date.parse(previous??'')||0)+1)).toISOString();}
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
