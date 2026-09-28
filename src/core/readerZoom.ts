export type ReaderZoom={scale:number;x:number;y:number};
/** Pure geometry shared by native pages and the original HTML Mushaf. */
export function constrainReaderZoom(scale:number,x:number,y:number,width:number,height:number):ReaderZoom{
 const s=Math.max(1,Math.min(3,Number.isFinite(scale)?scale:1));
 return {scale:s,x:Math.max(width*(1-s),Math.min(0,x)),y:Math.max(height*(1-s),Math.min(0,y))};
}
export function zoomReaderAt(current:ReaderZoom,scale:number,anchorX:number,anchorY:number,width:number,height:number):ReaderZoom{
 const s=Math.max(1,Math.min(3,scale)),ratio=s/current.scale;
 return constrainReaderZoom(s,anchorX-(anchorX-current.x)*ratio,anchorY-(anchorY-current.y)*ratio,width,height);
}
