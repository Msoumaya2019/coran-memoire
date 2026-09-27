import {resolveContentMedia} from './services/dailyContentMedia';
import {createManagedAudioPlayer as createAudioPlayer} from './services/audioFocus';
import React,{useEffect,useRef,useState} from 'react';
import {AppState as DeviceState,FlatList,Image,ImageBackground,Pressable,ScrollView,Share,View} from 'react-native';

import {Button,Card,colors,Label,Title} from './ui/theme';
import * as service from './services/dailyContents';
import {RecitationRecorder} from './RecitationRecorder';

let activeAudio:ReturnType<typeof createAudioPlayer>|null=null;
export function ContentCard({item,userId,preview=false}:{item:service.DailyContent;userId?:string;preview?:boolean}){
 const [favorite,setFavorite]=useState(false),[notice,setNotice]=useState(''),[record,setRecord]=useState(false),[playing,setPlaying]=useState(false),[imageError,setImageError]=useState(false);
 useEffect(()=>setImageError(false),[item.image_url]);
 const [imageUrl,setImageUrl]=useState<string|null>(null);
 useEffect(()=>{let live=true;setImageUrl(null);resolveContentMedia(item.image_url).then(url=>{if(live)setImageUrl(url);}).catch(e=>{if(live)setNotice(String(e));});return()=>{live=false;};},[item.image_url]);
 const alive=useRef(true),audioPending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const player=useRef<ReturnType<typeof createAudioPlayer>|null>(null),audioGeneration=useRef(0);
 useEffect(()=>{audioGeneration.current++;setPlaying(false);return()=>{audioGeneration.current++;if(activeAudio===player.current)activeAudio=null;player.current?.release();player.current=null;};},[item.audio_url]);
 useEffect(()=>{let live=true;service.favorites(userId).then(ids=>{if(live)setFavorite(ids.includes(item.id));}).catch(e=>setNotice(String(e)));return()=>{live=false;};},[item.id,userId]);
 const audio=async()=>{if(audioPending.current)return;audioPending.current=true;const generation=audioGeneration.current;try{if(playing&&player.current){player.current.pause();setPlaying(false);return;}activeAudio?.pause();if(!player.current){const url=await resolveContentMedia(item.audio_url);if(!url||!alive.current||generation!==audioGeneration.current)return;player.current=createAudioPlayer({uri:url});}activeAudio=player.current;player.current.play();setPlaying(true);}catch(e){if(alive.current)setNotice(String(e));}finally{audioPending.current=false;}};
 useEffect(()=>{const timer=setInterval(()=>{if(player.current)setPlaying(player.current.playing);},250);return()=>clearInterval(timer);},[]);
 return <Card style={{padding:18,borderRadius:26}}>
  {(!!item.title||!!item.image_url&&!imageError)&&<View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:8}}><Label style={{flex:1,fontWeight:'700'}}>{item.title??(item.type==='invocation'?'Invocation':'Rappel')}</Label>{!!imageUrl&&!imageError&&<Image source={{uri:imageUrl!}} onError={()=>setImageError(true)} accessible={false} resizeMode="contain" style={{width:40,height:40,borderRadius:10,marginLeft:'auto'}} />}</View>}
  {!!item.arabic_text&&<Label style={{fontSize:30,lineHeight:54,textAlign:'center',writingDirection:'rtl',color:colors.green,marginVertical:6}}>{item.arabic_text}</Label>}
  {!!item.phonetic_text&&<Label style={{fontStyle:'italic',textAlign:'center',color:colors.muted,marginBottom:12}}>{item.phonetic_text}</Label>}
  <Label style={{fontSize:18,lineHeight:28,textAlign:'center',marginVertical:8}}>{item.french_text}</Label>
  {!!item.explanation&&<Label style={{color:colors.muted,lineHeight:24,marginBottom:8}}>{item.explanation}</Label>}
  {!!item.audio_url&&<Button small onPress={audio}>{playing?'Ⅱ Pause':'▶ Écouter'}</Button>}
  {item.type==='invocation'&&!preview&&<Button small secondary onPress={()=>{activeAudio?.pause();setPlaying(false);setRecord(!record);}}>Enregistrer ma voix</Button>}
  {record&&<RecitationRecorder invocation={item} onSaved={()=>setNotice('Prononciation sauvegardée dans Mes récitations.')} />}
  {!!item.source&&<Label style={{fontSize:12,color:colors.muted,marginTop:10}}>Source : {item.source}{item.reference?` · ${item.reference}`:''}</Label>}
  {!preview&&<View style={{flexDirection:'row',justifyContent:'flex-end',gap:12,marginTop:10}}><Pressable accessibilityRole="button" accessibilityLabel={favorite?'Retirer des favoris':'Ajouter aux favoris'} onPress={async()=>{try{await service.setFavorite(item.id,!favorite,userId);setFavorite(!favorite);}catch(e){setNotice(String(e));}}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:colors.soft}}><Label style={{fontSize:24,color:colors.green}}>{favorite?'♥':'♡'}</Label></Pressable><Button small secondary onPress={()=>Share.share({message:[item.title,item.arabic_text,item.phonetic_text,item.french_text,item.explanation,`Source : ${item.source} ${item.reference??''}`].filter(Boolean).join('\n\n')}).catch(e=>setNotice(String(e)))}>Partager</Button></View>}
  {!!notice&&<Label style={{fontSize:12,color:colors.muted}}>{notice}</Label>}
 </Card>;
}
export function ContentTabs({type,onChange}:{type:service.ContentType;onChange:(type:service.ContentType)=>void}){return <View style={{flexDirection:'row',gap:8,marginVertical:12}}>{(['reminder','invocation'] as const).map(t=><View key={t} style={{flex:1}}><Button small secondary={type!==t} onPress={()=>onChange(t)}>{t==='reminder'?'☀ Rappel':'☾ Invocation'}</Button></View>)}</View>;}
export function TodayContents({userId,theme='lilac'}:{userId?:string;theme?:'classic'|'feminine'|'lilac'|'night'}){
 const [items,setItems]=useState<service.DailyContent[]>([]),[type,setType]=useState<service.ContentType>('invocation'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const load=()=>service.dayContents().then(rows=>{if(alive){setItems(rows);setError('');}}).catch(e=>{if(alive)setError(String(e));}).finally(()=>{if(alive)setLoading(false);});service.cachedDayContents().then(rows=>{if(alive&&rows.length)setItems(rows);});void load();const remove=service.observeContents(()=>void load());const app=DeviceState.addEventListener('change',state=>{if(state==='active')void load();});let lastDate=service.localDate();const timer=setInterval(()=>{const date=service.localDate();if(date!==lastDate){lastDate=date;void load();}},60000);return()=>{alive=false;remove();app.remove();clearInterval(timer);};},[]);
 const item=items.find(row=>row.type===type);
 const artwork={classic:require('../assets/themes/emerald.png'),feminine:require('../assets/themes/rose.png'),lilac:require('../assets/themes/lilac.png'),night:require('../assets/themes/night.png')};
 return <Card style={{backgroundColor:colors.soft,padding:12,borderRadius:28,overflow:'hidden'}}><ImageBackground source={artwork[theme]} imageStyle={{opacity:0.13}} style={{padding:6,borderRadius:18,overflow:'hidden'}}><Label style={{fontWeight:'800',fontSize:25}}>Aujourd’hui</Label><Label style={{color:colors.green2,marginTop:4}}>Un rappel pour illuminer ta journée</Label></ImageBackground><ContentTabs type={type} onChange={setType} />
 {item?<ContentCard key={item.id} item={item} userId={userId} />:loading?<View accessibilityLabel="Chargement du contenu du jour" style={{height:110,backgroundColor:colors.paper,borderRadius:20,padding:20}}><View style={{height:14,width:'75%',backgroundColor:colors.line,borderRadius:7}} /><View style={{height:14,width:'90%',backgroundColor:colors.line,borderRadius:7,marginTop:20}} /></View>:<Label>{error?'Le contenu du jour est temporairement indisponible.':type==='reminder'?'Aucun rappel disponible aujourd’hui.':'Aucune invocation disponible aujourd’hui.'}</Label>}
 </Card>;
}
export function DailyContentsScreen({onClose,userId,initialId}:{onClose:()=>void;userId?:string;initialId?:string}){
 const [type,setType]=useState<service.ContentType>('invocation'),[cats,setCats]=useState<service.ContentCategory[]>([]),[selected,setSelected]=useState<string>(),[items,setItems]=useState<service.DailyContent[]>([]),[fav,setFav]=useState(false),[ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(true);
 const [detail,setDetail]=useState<service.DailyContent|null>(null);
 const generation=useRef(0),loading=useRef(false);
 const load=async(offset=0)=>{if(loading.current)return;loading.current=true;setBusy(true);const g=generation.current;try{const rows=fav?await service.favoriteContents(await service.favorites(userId),type,selected,offset):await service.contents(type,selected,offset);if(g===generation.current){setItems(old=>offset?[...old,...rows]:rows);setMore(rows.length===30);setError('');}}catch(e){if(g===generation.current)setError(String(e));}finally{if(g===generation.current){loading.current=false;setBusy(false);}}};
 useEffect(()=>{service.categories().then(setCats).catch(e=>setError(String(e)));},[]);
 useEffect(()=>{generation.current++;loading.current=false;setItems([]);void load();return()=>{generation.current++;};},[type,selected,fav,userId]);
 useEffect(()=>{service.favorites(userId).then(setIds).catch(e=>setError(String(e)));},[fav,userId]);
 useEffect(()=>{if(initialId&&service){service.getContent(initialId).then(row=>{if(row){setDetail(row);}}).catch(e=>setError(String(e)));}},[initialId]);
 if(detail)return <ScrollView contentContainerStyle={{padding:18,paddingBottom:40}}><Button secondary onPress={()=>initialId?onClose():setDetail(null)}>‹ Retour</Button><Title>Rappels & Invocations</Title><ContentCard item={detail} userId={userId} /></ScrollView>;
 return <FlatList data={items} keyExtractor={item=>item.id} contentContainerStyle={{padding:18,paddingBottom:40}}
 ListHeaderComponent={<View><Button secondary onPress={onClose}>‹ Retour</Button><Title>Rappels & Invocations</Title><ContentTabs type={type} onChange={t=>{setSelected(undefined);setType(t);}} /><ScrollView horizontal showsHorizontalScrollIndicator={false}><Button small secondary={!selected} onPress={()=>setSelected(undefined)}>Tout</Button>{cats.filter(c=>c.type===type).map(c=><View key={c.id} style={{marginLeft:8}}><Button small secondary={selected!==c.id} onPress={()=>setSelected(c.id)}>{c.icon} {c.name}</Button></View>)}</ScrollView><Button small secondary={!fav} onPress={()=>setFav(!fav)}>♡ Mes favoris</Button>{!!error&&<Label>{error}</Label>}</View>}
 renderItem={({item})=><View><Pressable accessibilityLabel={`Ouvrir ${item.title??'ce contenu'}`} onPress={()=>setDetail(item)}><Label style={{fontSize:12,color:colors.green,marginBottom:5}}>Ouvrir la fiche ›</Label></Pressable><ContentCard item={item} userId={userId} /></View>}
 ListEmptyComponent={<Label>{busy?'Chargement…':type==='reminder'?'Aucun rappel disponible.':'Aucune invocation disponible.'}</Label>}
 ListFooterComponent={more?<Button secondary disabled={busy} onPress={()=>void load(items.length)}>{busy?'Chargement…':'Afficher la suite'}</Button>:null} />;
}
