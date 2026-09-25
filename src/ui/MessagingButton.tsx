import React from 'react';
import {Pressable,Text,View} from 'react-native';

const turquoise='#00BCD4';
const dot='#008FAA';

export function MessagingButton({unreadCount,onPress}:{unreadCount:number;onPress:()=>void}){
  const count=Math.max(0,Math.floor(unreadCount||0));
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={count?`Messagerie, ${count} message${count>1?'s':''} non lu${count>1?'s':''}`:'Messagerie, aucun message non lu'}
    accessibilityHint="Ouvre la liste des conversations"
    onPress={onPress}
    hitSlop={4}
    style={{width:52,height:52,alignItems:'center',justifyContent:'center'}}>
    <View style={{width:43,height:43,borderRadius:22,backgroundColor:turquoise,borderWidth:2,borderColor:'#DDFBFF',alignItems:'center',justifyContent:'center',elevation:4,shadowColor:'#003B50',shadowOpacity:0.3,shadowRadius:5,shadowOffset:{width:0,height:2}}}>
      <View style={{position:'absolute',left:7,top:4,width:24,height:8,borderRadius:8,backgroundColor:'#FFFFFF66',transform:[{rotate:'-17deg'}]}} />
      <View style={{width:29,height:22,borderRadius:11,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}>
        <View style={{position:'absolute',left:3,bottom:-2,width:8,height:8,backgroundColor:'#FFFFFF',transform:[{rotate:'45deg'}]}} />
        <View style={{flexDirection:'row',gap:3}}>{[0,1,2].map(index=><View key={index} style={{width:4,height:4,borderRadius:2,backgroundColor:dot}} />)}</View>
      </View>
    </View>
    {count>0?<View pointerEvents="none" style={{position:'absolute',right:-2,top:0,minWidth:19,height:19,borderRadius:10,backgroundColor:'#E73549',borderWidth:1.5,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center',paddingHorizontal:count>9?3:0}}><Text style={{color:'#FFFFFF',fontSize:count>99?9:11,fontWeight:'800',lineHeight:15}}>{count>99?'99+':count}</Text></View>:null}
  </Pressable>;
}
