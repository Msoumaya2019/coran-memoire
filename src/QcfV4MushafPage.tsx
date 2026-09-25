import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Image,Pressable,View} from 'react-native';
import {WebView,WebViewMessageEvent} from 'react-native-webview';
import {QcfV4Page} from './core/qcfV4';
import {qcfV4Html} from './core/qcfV4Html';
import {pageRange} from './core/quran';
import {tajweedImages} from './data/tajweedImages';
import {loadQcfV4Page} from './services/qcfV4';
import {colors,Label} from './ui/theme';

type Props={page:number;width:number;height:number;playingVerseId:number|null;difficultyIds:number[];sessionStart:number;sessionEnd:number;onVerseLongPress:(id:number)=>void;onTap:()=>void};

export function QcfV4MushafPage({page,width,height,playingVerseId,difficultyIds,sessionStart,sessionEnd,onVerseLongPress,onTap}:Props){
  const [data,setData]=useState<QcfV4Page|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [fontReady,setFontReady]=useState(false);
  // The package's generic declaration intersects Android, iOS and Windows props.
  // Native resolution still chooses the platform-specific implementation.
  const NativeWebView=WebView as unknown as React.ComponentType<any>;
  const web=useRef<{injectJavaScript:(source:string)=>void}|null>(null);
  useEffect(()=>{
    let active=true;
    setData(null);setError(null);setFontReady(false);
    loadQcfV4Page(page).then(result=>{
      if(!active)return;
      const expected=pageRange(page);
      if(result.firstVerseId!==expected.start||result.lastVerseId!==expected.end){
        setError('Cette page ne correspond pas encore aux limites du Moushaf existant.');return;
      }
      setData(result);
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Page Tajweed indisponible.');});
    return()=>{active=false;};
  },[page]);
  useEffect(()=>{
    if(data&&fontReady)web.current?.injectJavaScript(`setPlaying(${playingVerseId??'null'});true;`);
  },[data,fontReady,playingVerseId]);
  const html=useMemo(()=>data?qcfV4Html(data,playingVerseId,difficultyIds,sessionStart,sessionEnd):'',
    [data,difficultyIds.join(','),sessionStart,sessionEnd]);
  const onMessage=(event:WebViewMessageEvent)=>{
    try{
      const message=JSON.parse(event.nativeEvent.data);
      if(message.type==='ready')setFontReady(true);
      if(message.type==='font-error')setError('La police Tajweed ne s’est pas chargée.');
      if(message.type==='layout-error')setError(`La ligne ${message.line||'concernée'} ne tient pas sans réduire le texte. La page imprimée est affichée.`);
      if(message.type==='verse'&&data&&Number.isInteger(message.id)&&message.id>=data.firstVerseId&&message.id<=data.lastVerseId)onVerseLongPress(message.id);
      if(message.type==='tap')onTap();
    }catch{/* Ignore messages unrelated to the reader. */}
  };
  if(!data||error)return <View style={{width,backgroundColor:colors.paper}}>
    <Pressable onPress={onTap}><Image source={tajweedImages[page]} style={{width,height}} resizeMode="contain" /></Pressable>
    {error&&<Label style={{marginTop:5,textAlign:'center',fontSize:11,color:colors.muted}}>{error} Image Tajweed affichée sans surlignage.</Label>}
  </View>;
  return <View style={{width,height,backgroundColor:colors.paper}}>
    <NativeWebView ref={web} source={{html,baseUrl:'https://verses.quran.foundation'}} originWhitelist={['https://*']} scrollEnabled={false} javaScriptEnabled onMessage={onMessage} onError={()=>setError('Le Moushaf Tajweed ne s’est pas chargé.')} style={{width,height,backgroundColor:colors.paper}} />
  </View>;
}
