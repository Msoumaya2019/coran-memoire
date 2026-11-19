/** Executed inside the original page; every rectangle shares its zoom transform. */
export const annotationLayerScript=String.raw`
let noteHits=[];
function notePoint(x,y){const p=paper.getBoundingClientRect();return {x:(x-p.left)/p.width,y:(y-p.top)/p.height};}
function noteAt(x,y){const p=notePoint(x,y);return noteHits.filter(r=>p.x>=r.x-.006&&p.x<=r.x+r.width+.006&&p.y>=r.y-.006&&p.y<=r.y+r.height+.006).sort((a,b)=>a.area-b.area)[0]?.id;}
function drawNotes(){
 const layer=document.getElementById('note-overlay');if(!layer)return;layer.replaceChildren();noteHits=[];
 const wordRegions=Object.fromEntries(measuredWords.map(w=>[String(w.id),w.region]));
 const make=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));layer.appendChild(n);return n;};
 for(const item of readerState.annotations||[]){
  const color=/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#D9A900';
  const zones=resolveNoteZones(item,PAGE_NUMBER,regions,wordRegions);
  for(const r of zones){
   noteHits.push({...r,id:item.id,area:(r.width+.012)*(r.height+.012)});
   if(item.tool==='circle')make('ellipse',{cx:(r.x+r.width/2)*1000,cy:(r.y+r.height/2)*2120,rx:r.width*500+7,ry:r.height*1060+5,stroke:color,'stroke-width':5,fill:'none'});
   else make('rect',{x:r.x*1000-3,y:r.y*2120,width:r.width*1000+6,height:r.height*2120,rx:7,fill:color,opacity:.24});
  }
  if(item.anchor||item.page!==PAGE_NUMBER||!item.points?.length)continue;
  const points=item.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),first=points[0],last=points[points.length-1];if(!first)continue;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),r={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  noteHits.push({...r,id:item.id,area:(r.width+.012)*(r.height+.012)});
  if(item.tool==='circle')make('ellipse',{cx:(first.x+last.x)*500,cy:(first.y+last.y)*1060,rx:Math.abs(last.x-first.x)*500,ry:Math.abs(last.y-first.y)*1060,stroke:color,'stroke-width':5,fill:'none'});
  else if(item.tool==='note'){const n=make('text',{x:first.x*1000,y:first.y*2120,fill:color,'font-size':40});n.textContent='✎';}
  else make('path',{d:points.map((p,i)=>(i?'L':'M')+p.x*1000+','+p.y*2120).join(' '),stroke:color,'stroke-width':item.tool==='highlight'?38:6,'stroke-linecap':'round','stroke-linejoin':'round',fill:'none',opacity:item.tool==='highlight'?.3:1});
 }
}
function selectedWord(x,y){const p=notePoint(x,y);const node=document.elementFromPoint(x,y)?.closest?.('.word');const found=node?measuredWords.find(w=>w.id===Number(node.dataset.id)):measuredWords.find(w=>p.x>=w.region.x&&p.x<=w.region.x+w.region.width&&p.y>=w.region.y&&p.y<=w.region.y+w.region.height);return found;}
`;
