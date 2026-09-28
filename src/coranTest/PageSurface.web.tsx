import React from 'react';
import {PageSurfaceProps} from './PageSurface';
export function PageSurface({html,onMessage}:PageSurfaceProps){
 const ref=React.useRef<HTMLIFrameElement>(null);
 React.useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source===ref.current?.contentWindow)onMessage(event.data);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[onMessage]);
 return <iframe ref={ref} title="Page originale du Coran Test" srcDoc={html} style={{border:0,width:'100%',height:'100%',display:'block',background:'#faf7f2'}}/>;
}
