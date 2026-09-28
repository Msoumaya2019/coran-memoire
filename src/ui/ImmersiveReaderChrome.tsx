import React from 'react';
import {Pressable,View} from 'react-native';
import {Icon,premiumShadow} from './Premium';
import {colors,Label} from './theme';

export function ReaderFloatingActions({active,onHome,onAudio,onRecord,onBookmark,onMore,disabled=false}:{active:'audio'|'record'|'bookmark'|'options'|null;onHome:()=>void;onAudio:()=>void;onRecord:()=>void;onBookmark:()=>void;onMore:()=>void;disabled?:boolean}){
 const actions=[{id:'home',label:'Accueil',icon:'home' as const,press:onHome},{id:'audio',label:'Écouter',icon:'play' as const,press:onAudio},{id:'record',label:'Enregistrer',icon:'microphone' as const,press:onRecord},{id:'bookmark',label:'Marque-page',icon:'bookmark' as const,press:onBookmark},{id:'options',label:'Plus',icon:'dots-horizontal' as const,press:onMore}];
 return <View style={{flexDirection:'row',alignItems:'center',backgroundColor:colors.paper,borderRadius:28,borderWidth:1,borderColor:colors.line,paddingHorizontal:3,paddingVertical:5,...premiumShadow}}>{actions.map((action,index)=><React.Fragment key={action.id}>{index>0&&<View style={{height:22,width:1,backgroundColor:colors.line}}/>}<Pressable accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{selected:active===action.id,disabled}} disabled={disabled} onPress={action.press} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',gap:2,borderRadius:20,backgroundColor:active===action.id?colors.soft:'transparent'}}><Icon name={action.icon} size={22} color={colors.green}/><Label numberOfLines={1} style={{fontSize:9,textAlign:'center',color:colors.green,fontWeight:'600'}}>{action.label}</Label></Pressable></React.Fragment>)}</View>;
}
