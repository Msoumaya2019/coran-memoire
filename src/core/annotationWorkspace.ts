import type {AnnotationMark} from './readerAnnotations';
/** Coordinates stay relative to the original printed page; margins are external. */
export const noteMarginX=.35,noteMarginY=.08;
export function hasMarginInk(marks:AnnotationMark[]){return marks.some(n=>!n.anchor&&n.points.some(p=>p.x<0||p.x>1||p.y<0||p.y>1));}
export function workspaceDimensions(width:number,height:number,enabled:boolean){return enabled?[width*(1+2*noteMarginX),height*(1+2*noteMarginY)]:[width,height];}
export function workspacePoint(x:number,y:number,margins:boolean){return {x:Math.max(margins?-noteMarginX:0,Math.min(margins?1+noteMarginX:1,x)),y:Math.max(margins?-noteMarginY:0,Math.min(margins?1+noteMarginY:1,y))};}
