import type {ReaderAnnotation} from './readerAnnotations';
export type DeviceClass='tablet'|'phone'|'unknown';
export type TabletMode='auto'|'on'|'off';
export type TabletTool='pen'|'highlight'|'circle'|'underline'|'arrow'|'eraser'|'select'|'note';
export type TabletPreferences={mode:TabletMode;toolsVisible:boolean;stylusOnly:boolean;color:string;penWidth:number;highlightWidth:number;penStyle:'ink'|'pencil';spread:'single'|'double'};
export const tabletPalette=[{name:'Jaune',value:'#EAB308'},{name:'Bleu',value:'#2563EB'},{name:'Vert',value:'#16A34A'},{name:'Rouge',value:'#DC2626'},{name:'Orange',value:'#EA580C'},{name:'Rose',value:'#DB2777'}];
export const tabletDefaults:TabletPreferences={mode:'auto',toolsVisible:true,stylusOnly:true,color:'#16A34A',penWidth:.003,highlightWidth:.018,penStyle:'ink',spread:'single'};
export function tabletPreferences(value?:Partial<TabletPreferences>):TabletPreferences{
 const v={...tabletDefaults,...value};
 return {...v,mode:['auto','on','off'].includes(v.mode)?v.mode:'auto',spread:v.spread==='double'?'double':'single',penWidth:Number.isFinite(v.penWidth)?Math.max(.001,Math.min(.012,v.penWidth)):.003,highlightWidth:Number.isFinite(v.highlightWidth)?Math.max(.006,Math.min(.06,v.highlightWidth)):.018,color:/^#[0-9a-f]{6}$/i.test(v.color)?v.color:tabletDefaults.color};
}
export function tabletLayout(mode:TabletMode,device:DeviceClass,width:number,height:number,showTools=true,notesOpen=false,spread='single'){
 const enabled=mode==='on'||mode!=='off'&&device!=='phone'&&width>=(device==='tablet'?600:768)&&height>=360;
 const landscape=width>height,sidebars=enabled&&landscape&&width>=1000&&height>=480;
 const availableWidth=Math.max(0,width-(sidebars&&showTools&&spread!=='double'?72:0));
 const doublePage=enabled&&landscape&&spread==='double'&&availableWidth>=640&&height>=460;
 const notesOverlay=!sidebars||doublePage;
 const centerWidth=Math.max(0,availableWidth-(sidebars&&notesOpen&&!notesOverlay?280:0));
 return {enabled,landscape,sidebars,doublePage,centerWidth,notesOverlay};
}
/** Consecutive pages are read from the right pane to the left pane. */
export function spreadPages(page:number,doublePage:boolean):number[]{
 const p=Math.max(1,Math.min(604,Math.trunc(page)));
 if(!doublePage)return [p];
 const right=p%2?p:p-1;return [right+1,right];
}
export function nextSpread(page:number,direction:1|-1,doublePage:boolean){
 if(!doublePage)return Math.max(1,Math.min(604,page+direction));
 const start=page%2?page:page-1;
 return Math.max(1,Math.min(603,start+direction*2));
}
export type NotebookFilter={surah?:number;page?:number;color?:string;type?:string;favorite?:boolean;difficult?:boolean;sort?:'surah'|'page'|'date'|'color'|'type'|'difficulty'};
export function notebookEntries(items:Record<string,ReaderAnnotation>|undefined,filter:NotebookFilter={},difficultIds:number[]=[],surahOf:(id:number)=>number=()=>0){
 const difficult=new Set(difficultIds),verse=(n:ReaderAnnotation)=>{const id=n.anchor?.verseId||n.related?.verseId||0;return Number.isInteger(id)&&id>=1&&id<=6236?id:0;};
 const list=Object.values(items??{}).filter(n=>!n.deletedAt&&(!filter.surah||surahOf(verse(n))===filter.surah)&&(!filter.page||n.page===filter.page)&&(!filter.color||n.color===filter.color)&&(!filter.type||n.tool===filter.type)&&(!filter.favorite||n.favorite)&&(!filter.difficult||!n.masteredAt&&difficult.has(verse(n))));
 const key=(n:ReaderAnnotation)=>filter.sort==='page'?`${n.source}:${String(n.page).padStart(3,'0')}`:filter.sort==='surah'?String(surahOf(verse(n))).padStart(3,'0'):filter.sort==='color'?n.color:filter.sort==='type'?n.tool:filter.sort==='difficulty'?(!n.masteredAt&&difficult.has(verse(n))?'0':'1'):'';
 return list.sort((a,b)=>key(a).localeCompare(key(b))||(b.createdAt??b.updatedAt).localeCompare(a.createdAt??a.updatedAt)||a.id.localeCompare(b.id));
}
export function noteTextExport(notes:ReaderAnnotation[],label:(id:number)=>string){
 return notes.map(n=>`${n.source} · page ${n.page}${n.anchor?.verseId||n.related?.verseId?' · '+label(n.anchor?.verseId||n.related!.verseId):''}${n.anchor?.wordText?' · '+n.anchor.wordText:''}\n${n.createdAt??n.updatedAt}\n${n.text||'(Sans commentaire textuel)'}${n.handwriting?.length?'\n[Note manuscrite jointe dans l’application]':''}`).join('\n\n---\n\n');
}

/** Double-page is a reading surface; existing annotations remain stored. */
export function tabletReaderControls(tablet:boolean,doublePage:boolean,fullscreen:boolean,annotating:boolean,toolsVisible:boolean,sidebars:boolean){const canAnnotate=tablet&&!doublePage,showTools=canAnnotate&&toolsVisible&&(!fullscreen||annotating);return {canAnnotate,showTools,verticalTools:showTools&&sidebars&&!fullscreen,floatingTools:showTools&&(!sidebars||fullscreen)};}
