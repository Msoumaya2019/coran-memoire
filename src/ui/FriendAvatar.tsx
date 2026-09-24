import React,{useEffect,useState} from 'react';
import {Image,View} from 'react-native';
import {avatarUrl} from '../services/avatars';
import {colors,Label} from './theme';

export function FriendAvatar({name,path,size=42,uri}:{name:string;path?:string|null;size?:number;uri?:string|null}){
  const [remote,setRemote]=useState<string|null>(null);
  useEffect(()=>{let active=true;setRemote(null);if(path)avatarUrl(path).then(url=>{if(active)setRemote(url);}).catch(()=>{});return()=>{active=false;};},[path]);
  const source=uri??remote;
  return <View style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',backgroundColor:colors.soft,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.softBorder}}>
    {source?<Image source={{uri:source}} style={{width:size,height:size}} />:<Label style={{fontSize:size*0.43,fontWeight:'700',color:colors.green}}>{(name.trim()[0]??'?').toLocaleUpperCase('fr-FR')}</Label>}
  </View>;
}
