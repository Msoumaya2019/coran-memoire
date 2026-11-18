import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,View} from 'react-native';

/** Turn the outgoing sheet around its binding while revealing the next page. */
export function ReaderPageTurn({page,children}:{page:number;children:React.ReactNode}){
  const progress=useRef(new Animated.Value(0)).current,previous=useRef(page),lastChildren=useRef(children);
  const [outgoing,setOutgoing]=useState<React.ReactNode>(null),[direction,setDirection]=useState(1);
  const [reduced,setReduced]=useState(true);
  useEffect(()=>{let alive=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive)setReduced(value);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{alive=false;sub.remove();};},[]);
  useEffect(()=>{
    const changed=page!==previous.current;setDirection(page>previous.current?1:-1);previous.current=page;
    progress.stopAnimation();progress.setValue(0);
    if(changed&&!reduced){setOutgoing(lastChildren.current);Animated.timing(progress,{toValue:1,duration:420,useNativeDriver:true}).start(({finished})=>{if(finished)setOutgoing(null);});}else setOutgoing(null);
    return()=>progress.stopAnimation();
  },[page,reduced,progress]);
  useEffect(()=>{lastChildren.current=children;});
  return <View style={{flex:1,overflow:'hidden'}}>{children}{outgoing&&<Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{position:'absolute',inset:0,backfaceVisibility:'hidden',transformOrigin:direction>0?'right center':'left center',transform:[{perspective:1600},{rotateY:progress.interpolate({inputRange:[0,1],outputRange:['0deg',direction>0?'-88deg':'88deg']})}],opacity:progress.interpolate({inputRange:[0,0.85,1],outputRange:[1,1,0]})}}>{outgoing}<Animated.View style={{position:'absolute',inset:0,backgroundColor:'#624828',opacity:progress.interpolate({inputRange:[0,0.5,1],outputRange:[0,0.22,0.35]})}}/><View style={{position:'absolute',top:0,bottom:0,left:direction>0?undefined:0,right:direction>0?0:undefined,width:5,backgroundColor:'rgba(85,57,29,0.20)'}}/></Animated.View>}</View>;
}
