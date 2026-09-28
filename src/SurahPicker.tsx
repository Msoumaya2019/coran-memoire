import React,{useState,useEffect} from 'react';
import {Alert,FlatList,Modal,Pressable,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {surahs,Surah} from './core/quran';
import {Button,colors,Field,Label,Title} from './ui/theme';

/** Uses the same local Quran metadata as the reader and audio selection. */
export function SurahPicker({visible,currentSurah,currentPage,onPage,onClose,onSelect}:{visible:boolean;currentSurah:number;currentPage?:number;onPage?:(page:number)=>void;onClose:()=>void;onSelect:(surah:Surah)=>void}){
 const [pageText,setPageText]=useState(String(currentPage??1));
 useEffect(()=>{if(visible)setPageText(String(currentPage??1));},[visible,currentPage]);
 const goPage=()=>{const page=Number(pageText);if(!Number.isInteger(page)||page<1||page>604){Alert.alert('Page invalide','Choisis une page entre 1 et 604.');return;}onPage?.(page);};
 return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
  <SafeAreaView style={{flex:1,backgroundColor:colors.cream}}>
   <View style={{padding:18}}><Button small secondary onPress={onClose}>Fermer</Button><Title>Choisir une sourate</Title><Label style={{color:colors.muted}}>Les 114 sourates du Coran</Label>{onPage&&<View style={{flexDirection:'row',gap:8,alignItems:'center',marginTop:10}}><View style={{flex:1}}><Field value={pageText} onChangeText={setPageText} placeholder="Page 1 à 604" keyboardType="number-pad"/></View><Button small onPress={goPage}>Aller à la page</Button></View>}</View>
   {visible&&<FlatList data={surahs} keyExtractor={s=>String(s.number)} initialScrollIndex={Math.max(0,currentSurah-1)} getItemLayout={(_,index)=>({length:64,offset:64*index,index})} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`${item.number}. ${item.name}`} accessibilityState={{selected:item.number===currentSurah}} onPress={()=>onSelect(item)} style={{height:64,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:colors.line,backgroundColor:item.number===currentSurah?colors.selected:colors.paper}}><Label style={{width:30,color:colors.green,fontWeight:'700'}}>{item.number}</Label><View style={{flex:1}}><Label numberOfLines={1} style={{fontWeight:'700'}}>{item.name}</Label><Label style={{fontSize:12,color:colors.muted}}>{item.count} versets</Label></View><Label style={{fontSize:23,writingDirection:'rtl',color:colors.green}}>{item.arabic}</Label></Pressable>} />}
  </SafeAreaView>
 </Modal>;
}
