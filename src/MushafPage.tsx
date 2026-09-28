import React,{useEffect,useRef} from 'react';
import {Icon} from './ui/Premium';
import {GestureResponderEvent,Image,Pressable,Text,View} from 'react-native';
import {colors,Label} from './ui/theme';
import {mushafImages} from './data/mushafImages';
import boundsRaw from './data/bounds.json';
import {mushafTajweedImages} from './data/mushafTajweedImages';
import tajweedBoundsRaw from './data/mushaf-tajweed-bounds.json';
import tajweedDimensionsRaw from './data/mushaf-tajweed-dimensions.json';
import {frenchVerse,tajweedColor,tajweedSpans,verseAtImagePoint} from './core/readerData';
import {pageRange,Range,surahs,verseAt,verseId} from './core/quran';

type Props={textScale?:number;mapImagePoint?:(event:GestureResponderEvent,callback:(x:number,y:number)=>void)=>void;allowTap?:()=>boolean;page:number;width:number;height:number;mode:'traditional'|'tajweed'|'tajweedPages';language:'ar'|'fr';playingVerseId:number|null;difficultyIds?:number[];sessionRange:Range;showSession:boolean;bookmarkIds?:number[];onVersePress?:(id:number)=>void;onVerseLongPress:(id:number)=>void;onBlankLongPress:()=>void;onTap:()=>void};
const bounds=boundsRaw as Record<string,number[][]>;

export function MushafPage({textScale=1,mapImagePoint,allowTap=()=>true,page,width,height,mode,language,playingVerseId,difficultyIds=[],bookmarkIds=[],onVersePress,sessionRange,showSession,onVerseLongPress,onBlankLongPress,onTap}:Props){
  const pageView=useRef<View>(null),pendingTap=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(pendingTap.current)clearTimeout(pendingTap.current);},[page]);
  const selectAfterTap=(work:()=>void)=>{if(pendingTap.current)clearTimeout(pendingTap.current);pendingTap.current=setTimeout(()=>{pendingTap.current=null;if(allowTap())work();},300);};
  const colorPage=mode==='tajweedPages';
  const [sourceWidth,sourceHeight]=colorPage?(tajweedDimensionsRaw as Record<string,number[]>)[String(page)]:[1920,3106];
  const rows=(colorPage?tajweedBoundsRaw as Record<string,number[][]>:bounds)[String(page)]??[];
  const range=pageRange(page);
  const ids=Array.from({length:range.end-range.start+1},(_,index)=>range.start+index);
  const verseSelected=(id:number)=>id===playingVerseId||(showSession&&id>=sessionRange.start&&id<=sessionRange.end);
  if(language==='fr'||mode==='tajweed')return <View style={{width,minHeight:height,backgroundColor:colors.soft,borderRadius:9,padding:12}}>
    <Label style={{textAlign:'center',color:colors.gold,fontSize:13,marginBottom:12}}>{language==='fr'?'Traduction française du sens des versets':`Lecture simplifiée · page ${page}`}</Label>
    {ids.map(id=>{const verse=verseAt(id),translation=frenchVerse(id),spans=language==='ar'?tajweedSpans(id):[];const difficult=difficultyIds.includes(id);return <Pressable key={id} onLongPress={()=>onVerseLongPress(id)} delayLongPress={450} onPress={()=>{if(!allowTap())return;if(onVersePress)selectAfterTap(()=>onVersePress(id));else onTap();}} style={{padding:10,marginBottom:8,borderRadius:12,backgroundColor:bookmarkIds.includes(id)?colors.selected:difficult?'#FCE8E8':verseSelected(id)?colors.selected:colors.paper,borderWidth:difficult?1:0,borderColor:difficult?'#D97878':colors.green2}}>
      <Label style={{fontSize:12,color:colors.gold,marginBottom:5}}>{surahs[verse.surah-1].name} · verset {verse.ayah}</Label>
      {language==='fr'?<><Label style={{fontSize:16,lineHeight:25}}>{translation?.translation??'Traduction indisponible.'}</Label>{translation?.footnotes?<Label style={{fontSize:12,color:colors.muted,marginTop:5}}>{translation.footnotes}</Label>:null}</>:
        <Text style={{fontSize:Math.min(34,Math.max(25,width*.078))*textScale,lineHeight:Math.min(62,Math.max(48,width*.145))*textScale,textAlign:'right',writingDirection:'rtl',color:colors.text}}>{spans.map((span,index)=><Text key={index} style={{color:span.rule?tajweedColor(span.rule):colors.text}}>{span.text}</Text>)} <Text style={{color:colors.gold}}>۞</Text></Text>}
    </Pressable>;})}
    {language==='fr'?<Label style={{fontSize:11,color:colors.muted,marginTop:8}}>Traduction du sens : Rachid Maach · QuranEnc</Label>:<Label style={{fontSize:11,color:colors.muted,marginTop:8}}>Tajweed : cpfair, CC BY 4.0 · texte Hafs Tanzil 2017</Label>}
  </View>;
  const hitVerse=(event:GestureResponderEvent,callback:(id:number|null)=>void)=>{if(mapImagePoint){mapImagePoint(event,(x,y)=>callback(verseAtImagePoint(rows,x-2,y-2,width-4,height-4,sourceWidth,sourceHeight)));return;}const {pageX,pageY}=event.nativeEvent;pageView.current?.measureInWindow((left,top)=>callback(verseAtImagePoint(rows,pageX-left-2,pageY-top-2,width-4,height-4,sourceWidth,sourceHeight)));};
  return <Pressable ref={pageView} onPress={event=>{if(!allowTap())return;if(onVersePress)hitVerse(event,id=>{if(id!==null)selectAfterTap(()=>onVersePress(id));});else onTap();}} onLongPress={event=>hitVerse(event,id=>{if(id===null)onBlankLongPress();else onVerseLongPress(id);})} delayLongPress={450} style={{width,height,backgroundColor:'white',borderWidth:2,borderColor:colors.beige,borderRadius:9,overflow:'hidden',shadowColor:'#000',shadowOpacity:0.12,shadowRadius:10}}>
    <Image source={colorPage?mushafTajweedImages[page]:mushafImages[page]} style={{width:width-4,height:height-4}} resizeMode="contain" />
    {rows.filter(row=>{const id=verseId(row[0],row[1]);return id!==null&&(verseSelected(id)||difficultyIds.includes(id)||bookmarkIds.includes(id));}).map((row,index)=>{const id=verseId(row[0],row[1])!,active=id===playingVerseId,difficult=difficultyIds.includes(id);return <View key={index} pointerEvents="none" style={{position:'absolute',left:2+row[3]/sourceWidth*(width-4),top:2+row[5]/sourceHeight*(height-4),width:(row[4]-row[3])/sourceWidth*(width-4),height:(row[6]-row[5])/sourceHeight*(height-4),backgroundColor:bookmarkIds.includes(id)?colors.green2:difficult?'#E85B5B':active?colors.selected:colors.gold,opacity:bookmarkIds.includes(id)?0.18:difficult?0.18:active?0.42:0.11,borderWidth:0,borderColor:colors.green,borderRadius:4}} />;})}
    {bookmarkIds.map(id=>{const row=rows.find(r=>verseId(r[0],r[1])===id);return row?<View key={`bookmark-${id}`} pointerEvents="none" accessibilityLabel={`Marque-page verset ${verseAt(id).ayah}`} style={{position:'absolute',right:2,top:2+row[5]/sourceHeight*(height-4)}}><Icon name="bookmark" size={14} color={colors.green}/></View>:null;})}
  </Pressable>;
}
