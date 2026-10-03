import React from 'react';
import {Pressable,View} from 'react-native';
import {Label,colors} from './theme';
import {Icon} from './Premium';
import {Range} from '../core/quran';
import {studyMetrics} from '../core/studyProgress';
export function QuranSessionHeader({type,range,through,source,consolidationDay,onPress}:{type:'learning'|'revision'|'consolidation';range:Range;through:number;source:string;consolidationDay?:number;onPress:()=>void}){
 const m=studyMetrics(range,through,source),title=type==='consolidation'?`Consolidation · J+${consolidationDay??7}`:type==='learning'?'Apprentissage du jour':'Révision du jour';
 return <View style={{width:'100%',paddingHorizontal:12,paddingVertical:5}}><Pressable accessibilityRole="button" accessibilityLabel={type==='consolidation'?`Valider la consolidation J+${consolidationDay??7}`:type==='learning'?'Terminer mon apprentissage':'Terminer ma révision'} onPress={onPress} style={{minHeight:48,borderRadius:22,borderWidth:1,borderColor:'#DDECDC',backgroundColor:colors.reviewSoft,paddingHorizontal:12,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:10}}><Icon name="book-open-variant" color={colors.review} size={22}/><View style={{flex:1}}><Label numberOfLines={1} style={{fontSize:13,fontWeight:'700',color:colors.review}}>{title}</Label>{type!=='consolidation'&&<Label style={{fontSize:10,color:colors.review,marginTop:2}}>{m.done} / {m.total} {m.unit}</Label>}</View><View style={{borderLeftWidth:1,borderColor:'#C6DDC5',paddingLeft:10}}><Label style={{fontSize:10,color:colors.review}}>{m.first===m.last?'Page':'Pages'}</Label><Label style={{fontSize:12,color:colors.review}}>{m.first===m.last?m.first:`${m.first} → ${m.last}`}</Label></View></Pressable></View>;
}
