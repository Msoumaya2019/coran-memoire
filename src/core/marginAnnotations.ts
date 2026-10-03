export type MarginRegion={id:number;ayah:number;x:number;y:number;width:number;height:number;line:number};
/** Normalized anchors only. Never change the geometry of the page or its text.
 * Verses on the same line share a marker containing all their numbers. */
export function marginAnnotations(regions:MarginRegion[],start:number,end:number,through=0){
 const first=new Map<number,MarginRegion>();
 for(const region of regions){if(region.id<start||region.id>end)continue;const old=first.get(region.id);if(!old||region.line<old.line||region.line===old.line&&region.y<old.y)first.set(region.id,region);}
 const groups=new Map<number,MarginRegion[]>();
 for(const region of first.values()){const group=groups.get(region.line)??[];group.push(region);groups.set(region.line,group);}
 return [...groups.values()].sort((a,b)=>a[0].y-b[0].y).map(group=>{group.sort((a,b)=>a.id-b.id);return {y:Math.min(...group.map(r=>r.y)),height:Math.max(...group.map(r=>r.height)),items:group.map(r=>({id:r.id,ayah:r.ayah,done:r.id<=through})),bottom:Math.max(...regions.filter(r=>group.some(g=>g.id===r.id)).map(r=>r.y+r.height))};});
}
