import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {colors} from './theme';

export function ProfileHeaderButton({firstName,onPress}:{firstName?:string;onPress:()=>void}){
  const initial=Array.from(firstName?.trim()??'')[0]?.toLocaleUpperCase('fr-FR');
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="Ouvrir le profil"
    onPress={onPress}
    style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}
  >
    <View style={{width:36,height:36,borderRadius:18,backgroundColor:colors.green,borderWidth:1,borderColor:colors.gold,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
      {initial
        ? <Text style={{fontSize:17,lineHeight:22,includeFontPadding:false,fontWeight:'700',color:'#FFFFFF',textAlign:'center'}}>{initial}</Text>
        : <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{alignItems:'center',justifyContent:'center'}}>
            <View style={{width:9,height:9,borderRadius:5,backgroundColor:'#FFFFFF',marginBottom:2}} />
            <View style={{width:17,height:9,borderTopLeftRadius:9,borderTopRightRadius:9,backgroundColor:'#FFFFFF'}} />
          </View>}
    </View>
  </Pressable>;
}
