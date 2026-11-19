export const inkLayerScript=String.raw`
let liveInk=null,inkFrame=null,erasedInk=new Set(),pendingInk=new Map(),lastFocus=0;
function renderInkShape(item,layer){
 const points=item.points.map(p=>({...p,x:p.x*1000,y:p.y*2120})),first=points[0],last=points[points.length-1];if(!first)return;
 const color=/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#16A34A',width=(item.width||(item.tool==='highlight'?.038:.006))*1000;
 const make=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));layer.appendChild(n);return n;};
 if(item.tool==='circle')make('ellipse',{cx:(first.x+last.x)/2,cy:(first.y+last.y)/2,rx:Math.max(1,Math.abs(first.x-last.x)/2),ry:Math.max(1,Math.abs(first.y-last.y)/2),stroke:color,'stroke-width':width,fill:'none'});
 else if(item.tool==='note'){const n=make('text',{x:first.x,y:first.y,fill:color,'font-size':40});n.textContent='✎';}
 else {const parts=item.tool==='pen'?inkPressurePaths(points,width):[{d:inkShapePath(item.tool,points,30),width}];for(const part of parts)make('path',{d:part.d,stroke:color,'stroke-width':part.width,'stroke-linecap':'round','stroke-linejoin':'round',fill:'none',opacity:item.tool==='highlight'?.26:item.penStyle==='pencil'?.6:1});}
}
function drawLiveInk(){inkFrame=null;const layer=document.getElementById('ink-live');if(!layer)return;layer.replaceChildren();for(const item of pendingInk.values())renderInkShape(item,layer);if(liveInk&&liveInk.tool!=='eraser'&&liveInk.tool!=='note')renderInkShape(liveInk,layer);}
function queueInkPaint(){if(inkFrame===null)inkFrame=requestAnimationFrame(drawLiveInk);}
function canInk(event){const settings=readerState.ink;return settings?.enabled&&settings.tool!=='select'&&(event.pointerType==='pen'||!settings.stylusOnly&&(event.pointerType==='mouse'||event.pointerType==='touch'));}
function inkCoordinate(event,clamp=false){const p=notePoint(event.clientX,event.clientY);if(!clamp&&(p.x<0||p.y<0||p.x>1||p.y>1))return null;const value={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};if(event.pointerType==='pen'&&Number.isFinite(event.pressure)&&event.pressure>0)value.pressure=event.pressure;return value;}
function eraseInkAt(p){for(const mark of readerState.annotations||[]){if(erasedInk.has(mark.id))continue;const zones=resolveNoteZones(mark,PAGE_NUMBER,regions,Object.fromEntries(measuredWords.map(w=>[String(w.id),w.region])));if(zones.some(r=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height)||!mark.anchor&&mark.page===PAGE_NUMBER&&inkHit(mark,p))erasedInk.add(mark.id);}drawNotes(true);}
function finishInk(cancel=false){
 if(!liveInk)return;const stroke=liveInk;liveInk=null;queueInkPaint();
 if(cancel){erasedInk.clear();drawNotes(true);return;}
 if(stroke.tool==='eraser'){const ids=[...erasedInk];erasedInk.clear();if(ids.length)send({type:'ink-erase',page:PAGE_NUMBER,ids});drawNotes(true);return;}
 if(stroke.points.length){const keys=new Set(stroke.points.map(p=>measuredWords.find(w=>p.x>=w.region.x&&p.x<=w.region.x+w.region.width&&p.y>=w.region.y&&p.y<=w.region.y+w.region.height)?.key));if(keys.size===1&&!keys.has(undefined)){const key=[...keys][0];stroke.related={verseKey:key};}pendingInk.set(stroke.id,stroke);queueInkPaint();send({type:'ink-commit',page:PAGE_NUMBER,stroke,wordId:stroke.wordId,key:stroke.key});}
}
addEventListener('pointerdown',event=>{
 if(event.target?.closest?.('#study-banner'))return;
 if(liveInk){if(event.pointerId!==liveInk.pointerId&&event.pointerType!=='pen')return;}
 if(!canInk(event))return;const point=inkCoordinate(event);if(!point)return;
 event.preventDefault();event.stopImmediatePropagation();cancelHold();gesture=null;pinch=null;if(tapTimer)clearTimeout(tapTimer);tapTimer=null;lastTap=null;
 const settings=readerState.ink,word=selectedWord(event.clientX,event.clientY);liveInk={id:'ink-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),page:PAGE_NUMBER,pointerId:event.pointerId,pointerType:event.pointerType,tool:settings.tool,color:settings.color,width:settings.width,penStyle:settings.penStyle,points:[point],key:word?.key,wordId:word?.id};
 if(event.pointerType==='pen')send({type:'ink-capability',page:PAGE_NUMBER,pen:true,pressure:point.pressure!==undefined});
 if(settings.tool==='eraser')eraseInkAt(point);else queueInkPaint();
},{capture:true,passive:false});
addEventListener('pointermove',event=>{
 if(!liveInk||event.pointerId!==liveInk.pointerId)return;event.preventDefault();event.stopImmediatePropagation();
 const events=event.getCoalescedEvents?.()||[event];for(const e of events.length?events:[event]){const p=inkCoordinate(e,true),last=liveInk.points[liveInk.points.length-1];if(!p||Math.hypot(p.x-last.x,(p.y-last.y)*2.12)<.001)continue;if(liveInk.points.length<4096)liveInk.points.push(p);if(liveInk.tool==='eraser')eraseInkAt(p);}queueInkPaint();
},{capture:true,passive:false});
addEventListener('pointerup',event=>{if(liveInk&&event.pointerId===liveInk.pointerId){event.preventDefault();event.stopImmediatePropagation();finishInk();}},{capture:true,passive:false});
addEventListener('pointercancel',event=>{if(liveInk&&event.pointerId===liveInk.pointerId)finishInk(true);},{capture:true});
function ignoreInkTouch(event){if(liveInk){if(liveInk.pointerType==='pen')return true;if(event.touches?.length>1&&liveInk.pointerId!==undefined&&readerState.ink&&!readerState.ink.stylusOnly){finishInk(true);return false;}return true;}return false;}
function focusNote(){const focus=readerState.focus;if(!focus||focus.serial===lastFocus)return;const item=(readerState.annotations||[]).find(n=>n.id===focus.id);if(!item)return;const zones=resolveNoteZones(item,PAGE_NUMBER,regions,Object.fromEntries(measuredWords.map(w=>[String(w.id),w.region])));const r=zones[0]||(!item.anchor&&item.page===PAGE_NUMBER&&item.points[0]?{...item.points[0],width:0,height:0}:null);if(!r)return;lastFocus=focus.serial;zoom=1.5;panX=innerWidth/2-(r.x+r.width/2)*1000*scale*zoom;panY=innerHeight/2-(r.y+r.height/2)*2120*scale*zoom;paintZoom();}
`;
