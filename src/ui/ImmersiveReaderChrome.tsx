import React from 'react';
import {Pressable,View} from 'react-native';
import {Icon,premiumShadow} from './Premium';
import {colors,Label} from './theme';

export function ImmersiveReaderHeader({title,context,onBack,onTitle,onOptions,disabled=false}:{title:string;context?:string;onBack:()=>void;onTitle:()=>void;onOptions:()=>void;disabled?:boolean}){
 return <View style={{position:'absolute',top:0,left:4,right:4,height:46,flexDirection:'row',alignItems:'center',gap:4}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Retour" disabled={disabled} onPress={onBack} style={{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:colors.paper+'D9'}}><Icon name="chevron-left" color={colors.green}/></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Changer de sourate" disabled={disabled} onPress={onTitle} style={{flex:1,minHeight:44,alignItems:'center',justifyContent:'center'}}><Label numberOfLines={1} style={{fontSize:14,fontWeight:'700',textAlign:'center'}}>{title}</Label>{context&&<Label numberOfLines={1} style={{fontSize:10,color:colors.muted,textAlign:'center'}}>{context}</Label>}</Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Plus d’options" disabled={disabled} onPress={onOptions} style={{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:colors.paper+'D9'}}><Icon name="dots-horizontal" color={colors.green}/></Pressable>
 </View>;
}
export function ReaderFloatingActions({active,onAudio,onTranslation,onBookmark,disabled=false}:{active:'audio'|'translation'|'bookmark'|null;onAudio:()=>void;onTranslation:()=>void;onBookmark:()=>void;disabled?:boolean}){
 const actions=[{id:'audio',label:'Écouter',icon:'play' as const,press:onAudio},{id:'translation',label:'Traduction',icon:'book-open-variant' as const,press:onTranslation},{id:'bookmark',label:'Marque-page',icon:'bookmark' as const,press:onBookmark}];
 return <View style={{flexDirection:'row',alignItems:'center',backgroundColor:colors.paper+'F2',borderRadius:32,borderWidth:1,borderColor:colors.line,paddingHorizontal:8,paddingVertical:4,...premiumShadow}}>{actions.map((action,index)=><React.Fragment key={action.id}>{index>0&&<View style={{height:22,width:1,backgroundColor:colors.line}}/>}<Pressable accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{selected:active===action.id,disabled}} disabled={disabled} onPress={action.press} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',gap:1,borderRadius:24,backgroundColor:active===action.id?colors.soft:'transparent'}}><Icon name={action.icon} size={21} color={colors.green}/><Label numberOfLines={1} style={{fontSize:10,color:colors.green,fontWeight:'600'}}>{action.label}</Label></Pressable></React.Fragment>)}</View>;
}
