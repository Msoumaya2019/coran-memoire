import React from 'react';
import {PageSurfaceProps} from './PageSurface';
export function PageSurface({html,onMessage,readerState}:PageSurfaceProps){
 const ref=React.useRef<HTMLIFrameElement>(null);
 const stateJson=JSON.stringify(readerState??{enabled:false});
 const sync=()=>ref.current?.contentWindow?.postMessage({type:'reader-state',state:JSON.parse(stateJson)},'*');
 React.useEffect(sync,[stateJson,html]);
 React.useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source===ref.current?.contentWindow)onMessage(event.data);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[onMessage]);
 return <iframe ref={ref} onLoad={sync} title="Page originale du Coran avec règles de Tajwid" srcDoc={html} style={{border:0,width:'100%',height:'100%',display:'block',background:'#faf7f2'}}/>;
}
