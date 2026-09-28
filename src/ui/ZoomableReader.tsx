import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,GestureResponderEvent,PanResponder,View} from 'react-native';
import {constrainReaderZoom,zoomReaderAt,ReaderZoom} from '../core/readerZoom';
type ZoomTools={zoomed:boolean;textScale:number;mapPoint:(event:GestureResponderEvent,callback:(x:number,y:number)=>void)=>void;allowTap:()=>boolean};
export function ZoomableReader({width,height,reflow=false,children}:{width:number;height:number;reflow?:boolean;children:(tools:ZoomTools)=>React.ReactNode}){
 const view=useRef<View>(null),transform=useRef<ReaderZoom>({scale:1,x:0,y:0});
 const dimensions=useRef({width,height});dimensions.current={width,height};
 const [textScale,setTextScale]=useState(1);
 const [zoomed,setZoomed]=useState(false),scale=useRef(new Animated.Value(1)).current,x=useRef(new Animated.Value(0)).current,y=useRef(new Animated.Value(0)).current;
 const lastTap=useRef(0),suppressUntil=useRef(0),startTouch=useRef({x:0,y:0,time:0});
 const gesture=useRef<{start:ReaderZoom;distance:number;cx:number;cy:number;double:boolean}|null>(null);
 const apply=(next:ReaderZoom)=>{transform.current=next;scale.setValue(reflow?1:next.scale);x.setValue(reflow?0:next.x);y.setValue(reflow?0:next.y);setZoomed(next.scale>1.01);if(reflow)setTextScale(next.scale);};
 const local=(event:GestureResponderEvent,callback:(px:number,py:number)=>void)=>{const {pageX,pageY}=event.nativeEvent;view.current?.measureInWindow((left,top)=>callback(pageX-left,pageY-top));};
 const tools:ZoomTools={zoomed,textScale,allowTap:()=>Date.now()>suppressUntil.current,mapPoint:(event,callback)=>local(event,(px,py)=>{const z=transform.current;callback((px-z.x)/z.scale,(py-z.y)/z.scale);})};
 useEffect(()=>{apply(constrainReaderZoom(transform.current.scale,transform.current.x,transform.current.y,width,height));},[width,height]);
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponderCapture:event=>event.nativeEvent.touches.length>1||Date.now()-lastTap.current<280,
  onMoveShouldSetPanResponderCapture:(_,g)=>g.numberActiveTouches>1||(!reflow&&transform.current.scale>1.01&&Math.hypot(g.dx,g.dy)>5),
  onPanResponderGrant:event=>{
   suppressUntil.current=Date.now()+500;const touches=event.nativeEvent.touches;
   const double=touches.length===1&&Date.now()-lastTap.current<280;lastTap.current=0;
   gesture.current={start:{...transform.current},distance:touches.length>1?Math.hypot(touches[1].pageX-touches[0].pageX,touches[1].pageY-touches[0].pageY):0,cx:touches.length>1?(touches[0].pageX+touches[1].pageX)/2:0,cy:touches.length>1?(touches[0].pageY+touches[1].pageY)/2:0,double};
   if(double)local(event,(px,py)=>{const d=dimensions.current;apply(zoomReaderAt(transform.current,transform.current.scale>1.01?1:2,px,py,d.width,d.height));});
  },
  onPanResponderMove:(event,g)=>{
   const state=gesture.current;if(!state||state.double)return;const d=dimensions.current,touches=event.nativeEvent.touches;
   if(touches.length>1){
    const distance=Math.hypot(touches[1].pageX-touches[0].pageX,touches[1].pageY-touches[0].pageY);
    if(!state.distance){state.distance=distance;state.start={...transform.current};state.cx=(touches[0].pageX+touches[1].pageX)/2;state.cy=(touches[0].pageY+touches[1].pageY)/2;}
    view.current?.measureInWindow((left,top)=>{if(gesture.current!==state)return;const z=zoomReaderAt(state.start,state.start.scale*distance/state.distance,state.cx-left,state.cy-top,d.width,d.height);apply(constrainReaderZoom(z.scale,z.x+(touches[0].pageX+touches[1].pageX)/2-state.cx,z.y+(touches[0].pageY+touches[1].pageY)/2-state.cy,d.width,d.height));});
   }else if(state.distance===0)apply(constrainReaderZoom(state.start.scale,state.start.x+g.dx,state.start.y+g.dy,d.width,d.height));
  },
  onPanResponderRelease:()=>{gesture.current=null;suppressUntil.current=Date.now()+300;},
  onPanResponderTerminate:()=>{gesture.current=null;suppressUntil.current=Date.now()+300;},
  onPanResponderTerminationRequest:()=>false,
 }),[]);
 return <View ref={view} {...responder.panHandlers} onTouchStart={event=>{startTouch.current={x:event.nativeEvent.pageX,y:event.nativeEvent.pageY,time:Date.now()};}} onTouchEnd={event=>{const p=startTouch.current;if(!gesture.current&&Date.now()>suppressUntil.current&&Date.now()-p.time<280&&Math.hypot(event.nativeEvent.pageX-p.x,event.nativeEvent.pageY-p.y)<10)lastTap.current=Date.now();}} style={{width,height,overflow:'hidden'}} accessibilityHint="Pince avec deux doigts pour agrandir. Double touche pour zoomer ou revenir à la page entière."><Animated.View style={{width,height,alignItems:'center',transformOrigin:'top left',transform:[{translateX:x},{translateY:y},{scale}]}}>{children(tools)}</Animated.View></View>;
}
