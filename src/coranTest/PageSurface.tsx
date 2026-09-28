import React from 'react';
import {WebView} from 'react-native-webview';
export type PageSurfaceProps={html:string;onMessage:(data:any)=>void};
export function PageSurface({html,onMessage}:PageSurfaceProps){
 return <WebView source={{html,baseUrl:'about:blank'}} originWhitelist={['about:blank']} javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} setSupportMultipleWindows={false} allowFileAccess={false} onShouldStartLoadWithRequest={request=>request.url==='about:blank'} onMessage={event=>{try{onMessage(JSON.parse(event.nativeEvent.data));}catch{console.warn('[Coran Test] Invalid renderer message');}}} onError={()=>onMessage({type:'error'})} style={{flex:1,backgroundColor:'#faf7f2'}} />;
}
