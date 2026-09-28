import React,{useEffect,useRef,useMemo} from 'react';
import {WebView} from 'react-native-webview';
import {ReaderOverlayState} from './model';
export type PageSurfaceProps={html:string;onMessage:(data:any)=>void;readerState?:ReaderOverlayState};
export function PageSurface({html,onMessage,readerState}:PageSurfaceProps){
 const ref=useRef<WebView>(null),source=useMemo(()=>({html,baseUrl:'about:blank'}),[html]);
 const stateJson=JSON.stringify(readerState??{enabled:false});
 const sync=()=>ref.current?.injectJavaScript(`window.applyReaderState&&window.applyReaderState(${stateJson});true;`);
 useEffect(sync,[stateJson,html]);
 return <WebView ref={ref} source={source} onLoadEnd={sync} originWhitelist={['about:blank']} javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} setSupportMultipleWindows={false} allowFileAccess={false} onShouldStartLoadWithRequest={request=>request.url==='about:blank'} onMessage={event=>{try{onMessage(JSON.parse(event.nativeEvent.data));}catch{console.warn('[Coran Test] Invalid renderer message');}}} onError={()=>onMessage({type:'error'})} style={{flex:1,backgroundColor:'#faf7f2'}} />;
}
