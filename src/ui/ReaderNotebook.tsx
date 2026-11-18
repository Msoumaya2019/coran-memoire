import React,{useMemo,useRef,useState} from 'react';
import {KeyboardAvoidingView,Platform,PanResponder,Pressable,ScrollView,TextInput,View,useWindowDimensions} from 'react-native';
import Svg,{Ellipse,Path,Text as SvgText} from 'react-native-svg';
import {inkPoint,InkPoint,InkTool,pageAnnotations,paperRect,ReaderAnnotation,ReaderAnnotations} from '../core/readerAnnotations';
import {colors,Label} from './theme';

const toolNames:Record<InkTool,string>={highlight:'Surligner',circle:'Entourer',pen:'Stylet',note:'Note clavier'};
const palette=['#D9A900','#257452','#BA4563','#4869B0'];
export function ReaderNotebook({source,page,sourceWidth,sourceHeight,centerY=false,items,onSave,onClose,onPage,children}:{source:string;page:number;sourceWidth:number;sourceHeight:number;centerY?:boolean;items?:ReaderAnnotations;onSave:(item:ReaderAnnotation)=>void;onClose:()=>void;onPage:(page:number)=>void;children:React.ReactNode}){
 const window=useWindowDimensions(),wide=window.width>=900;
 const [tool,setTool]=useState<InkTool>('highlight'),[color,setColor]=useState(palette[0]),[size,setSize]=useState({width:0,height:0}),[draft,setDraft]=useState<InkPoint[]>([]),[editing,setEditing]=useState<ReaderAnnotation|null>(null),[text,setText]=useState('');
 const stroke=useRef<InkPoint[]>([]),notes=pageAnnotations(items,source,page);
 const rect=paperRect(size.width,size.height,sourceWidth,sourceHeight,centerY);
 const make=(points:InkPoint[]):ReaderAnnotation=>({id:`ink-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,source,page,tool,color,points,text:'',updatedAt:new Date().toISOString()});
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:event=>!!inkPoint(event.nativeEvent.locationX,event.nativeEvent.locationY,rect),
  onMoveShouldSetPanResponder:()=>true,
  onPanResponderTerminationRequest:()=>false,
  onPanResponderGrant:event=>{if(event.nativeEvent.touches.length>1)return;const point=inkPoint(event.nativeEvent.locationX,event.nativeEvent.locationY,rect);stroke.current=point?[point]:[];setDraft(stroke.current);},
  onPanResponderMove:event=>{if(event.nativeEvent.touches.length>1){stroke.current=[];setDraft([]);return;}const point=inkPoint(event.nativeEvent.locationX,event.nativeEvent.locationY,rect,true);if(point&&stroke.current.length){stroke.current=stroke.current.length<2000?[...stroke.current,point]:stroke.current;setDraft(stroke.current);}},
  onPanResponderRelease:()=>{const points=stroke.current;stroke.current=[];setDraft([]);if(!points.length)return;const item=make(points);if(tool==='note'){setEditing(item);setText('');}else if(points.length>1)onSave(item);},
  onPanResponderTerminate:()=>{stroke.current=[];setDraft([]);},
 }),[tool,color,source,page,rect.x,rect.y,rect.width,rect.height,onSave]);
 const button=(label:string,press:()=>void,selected=false,disabled=false)=><Pressable key={label} accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={press} style={{minHeight:44,paddingHorizontal:12,paddingVertical:10,borderRadius:12,borderWidth:1,borderColor:selected?colors.green:colors.line,backgroundColor:selected?colors.soft:colors.paper,opacity:disabled?0.4:1,justifyContent:'center'}}><Label style={{fontSize:12,fontWeight:'600'}}>{label}</Label></Pressable>;
 const saveText=()=>{if(editing&&text.trim()){onSave({...editing,text:text.trim().slice(0,2000),updatedAt:new Date().toISOString()});setEditing(null);setText('');}};
 const controls=<View style={{gap:8,padding:12,backgroundColor:colors.paper}}>
  <Label style={{fontWeight:'700'}}>{window.width>=768?'Atelier tablette':'Mes annotations'} · page {page}</Label>
  <Label style={{fontSize:12,color:colors.muted}}>Trace sur un mot ou un verset au doigt ou au stylet. Choisis « Note clavier » puis touche la page.</Label>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{(Object.keys(toolNames) as InkTool[]).map(key=>button(toolNames[key],()=>setTool(key),key===tool))}</View>
  <View style={{flexDirection:'row',gap:8}}>{palette.map((value,index)=><Pressable key={value} accessibilityRole="button" accessibilityLabel={['Or','Vert','Rose','Bleu'][index]} accessibilityState={{selected:color===value}} onPress={()=>setColor(value)} style={{width:44,height:44,borderRadius:22,backgroundColor:value,borderWidth:color===value?3:0,borderColor:colors.text}}/>)}</View>
  {editing&&<View style={{gap:8}}><Label>Annotation sur la page</Label><TextInput accessibilityLabel="Texte de l’annotation" autoFocus multiline maxLength={2000} value={text} onChangeText={setText} placeholder="Écris ton annotation…" placeholderTextColor={colors.muted} style={{minHeight:90,maxHeight:160,borderWidth:1,borderColor:colors.line,borderRadius:10,padding:10,color:colors.text,backgroundColor:colors.paper,textAlignVertical:'top'}}/><View style={{flexDirection:'row',gap:8}}>{button('Enregistrer',saveText,false,!text.trim())}{button('Annuler',()=>setEditing(null))}</View></View>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{button('Page précédente',()=>onPage(page-1),false,page<=1||!!editing)}{button('Page suivante',()=>onPage(page+1),false,page>=604||!!editing)}{button('Retour à la lecture',onClose,false,!!editing)}</View>
  <Label style={{fontSize:12,color:colors.muted}}>Enregistrement automatique · {notes.length} annotation(s)</Label>
  <ScrollView style={{maxHeight:wide?300:120}} keyboardShouldPersistTaps="handled">{notes.map((item,index)=><View key={item.id} style={{borderTopWidth:1,borderColor:colors.line,paddingVertical:6,gap:4}}><Pressable accessibilityRole="button" accessibilityLabel={`Modifier l’annotation ${index+1}`} onPress={()=>{setEditing(item);setText(item.text);}}><Label numberOfLines={3} style={{fontSize:12}}>{index+1}. {toolNames[item.tool]}{item.text?` · ${item.text}`:''}</Label></Pressable>{button('Supprimer',()=>onSave({...item,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}),false,!!editing)}</View>)}</ScrollView>
 </View>;
 const marks=[...notes,...(draft.length?[{...make(draft),id:'draft'}]:[])];
 return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,flexDirection:wide?'row':'column'}}><View onLayout={e=>setSize(e.nativeEvent.layout)} style={{flex:1,minHeight:120,overflow:'hidden'}}><View pointerEvents="none" style={{position:'absolute',inset:0}}>{children}</View><View {...responder.panHandlers} accessibilityLabel="Zone d’annotation de la page" style={{position:'absolute',inset:0}}><Svg pointerEvents="none" width={size.width} height={size.height}>{marks.map((item,index)=>{
  const points=item.points.map(p=>({x:rect.x+p.x*rect.width,y:rect.y+p.y*rect.height}));const first=points[0],last=points[points.length-1];if(!first||!last)return null;
  if(item.tool==='note')return <SvgText key={item.id} x={first.x} y={first.y} fontSize={16} fontWeight="bold" fill={item.color}>{index+1}✎</SvgText>;
  if(item.tool==='circle')return <Ellipse key={item.id} cx={(first.x+last.x)/2} cy={(first.y+last.y)/2} rx={Math.max(2,Math.abs(last.x-first.x)/2)} ry={Math.max(2,Math.abs(last.y-first.y)/2)} fill="none" stroke={item.color} strokeWidth={2}/>;
  return <Path key={item.id} d={points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke={item.color} opacity={item.tool==='highlight'?0.30:0.95} strokeWidth={item.tool==='highlight'?Math.max(12,rect.height*0.018):2.5} strokeLinecap="round" strokeLinejoin="round"/>;
 })}</Svg></View></View>{wide?<View style={{width:310}}><ScrollView keyboardShouldPersistTaps="handled">{controls}</ScrollView></View>:<ScrollView style={{maxHeight:window.height*0.40}} keyboardShouldPersistTaps="handled">{controls}</ScrollView>}</KeyboardAvoidingView>;
}
