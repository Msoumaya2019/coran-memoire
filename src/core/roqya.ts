export type RoqyaReciter={id:string;name:string;photoUrl?:string;description:string;sortOrder:number};
export type RoqyaAudio={id:string;roqyaId:string;reciterId:string;audioUrl?:string;storagePath?:string;duration:number;fileSize?:number;sortOrder:number};
export type Roqya={id:string;title:string;description:string;category:string;imageUrl?:string;sortOrder:number;createdAt:string;reciters:RoqyaReciter[];audios:RoqyaAudio[]};
export type RoqyaListen={audioId:string;position:number;duration:number;listenedAt:string};
export type RoqyaLibrary={favorites:string[];listens:Record<string,RoqyaListen>;selected:Record<string,string>};
export const emptyRoqyaLibrary=():RoqyaLibrary=>({favorites:[],listens:{},selected:{}});
export const roqyaSpeeds=[0.75,1,1.25,1.5,2] as const;
export function safeMediaUrl(value:unknown):string|undefined{
 if(typeof value!=='string')return;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?value:undefined;}catch{return;}
}
export function normalizeRoqyaCatalog(rows:any[]):Roqya[]{
 return rows.filter(r=>r.enabled===true).map(r=>{
  const versions=(r.roqya_audios??[]).filter((a:any)=>a.enabled===true&&a.roqya_reciters?.enabled===true&&(a.storage_path||safeMediaUrl(a.audio_url)));
  const audios:RoqyaAudio[]=versions.map((a:any)=>({id:a.id,roqyaId:r.id,reciterId:a.reciter_id,audioUrl:safeMediaUrl(a.audio_url),storagePath:a.storage_path||undefined,duration:Number(a.duration_seconds)||0,fileSize:a.file_size?Number(a.file_size):undefined,sortOrder:a.sort_order??0})).sort((a:RoqyaAudio,b:RoqyaAudio)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id));
  const reciters:RoqyaReciter[]=Array.from(new Map<string,RoqyaReciter>(versions.map((a:any)=>{const c=a.roqya_reciters;return [c.id,{id:c.id,name:c.name,photoUrl:safeMediaUrl(c.photo_url),description:c.description??'',sortOrder:c.sort_order??0}];})).values()).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
  return {id:r.id,title:r.title,description:r.description??'',category:r.category??'complete',imageUrl:safeMediaUrl(r.image_url),sortOrder:r.sort_order??0,createdAt:r.created_at,reciters,audios};
 }).filter(r=>r.audios.length).sort((a,b)=>a.sortOrder-b.sortOrder||a.title.localeCompare(b.title));
}
export function resumeRoqyaPosition(position:number,duration:number){return Number.isFinite(position)?Math.max(0,duration>0&&position>=duration-2?0:duration>0?Math.min(position,duration):position):0;}
export function roqyaTime(seconds:number){const s=Math.max(0,Math.floor(seconds||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
export function roqyaDuration(seconds:number){return seconds>0?`${Math.ceil(seconds/60)} min`:'Durée à charger';}
export function selectedRoqyaAudio(roqya:Roqya,library:RoqyaLibrary){return roqya.audios.find(a=>a.id===library.selected[roqya.id])??roqya.audios[0];}
