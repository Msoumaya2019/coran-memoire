import React,{useState} from 'react';
import {Alert,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,TextInput,View} from 'react-native';
import {AnnotationSelection,annotationTime,NoteStroke,ReaderAnnotation,selectionForScope} from '../core/readerAnnotations';
import {reference} from '../core/quran';
import {Button,colors,Label} from './theme';
import {NoteHandwriting} from './NoteHandwriting';

const palette=['#D9A900','#257452','#BA4563','#4869B0'];
export function ReaderAnnotationEditor({selection,existing,source,page,onSave,onDelete,onClose}:{selection:AnnotationSelection;existing?:ReaderAnnotation;source:string;page:number;onSave:(item:ReaderAnnotation)=>void;onDelete:(item:ReaderAnnotation)=>void;onClose:()=>void}){
 const [tool,setTool]=useState(existing?.tool??'highlight'),[color,setColor]=useState(existing?.color??palette[0]),[text,setText]=useState(existing?.text??''),[strokes,setStrokes]=useState<NoteStroke[]>(existing?.handwriting??[]);
 const [scope,setScope]=useState<'word'|'verse'>((existing?.anchor??selection).wordId!==undefined||(existing?.anchor??selection).wordIndex!==undefined?'word':'verse');
 const [input,setInput]=useState<'keyboard'|'pen'>(strokes.length&&!text?'pen':'keyboard'),[reanchor,setReanchor]=useState(!existing);
 const dirty=text!==(existing?.text??'')||JSON.stringify(strokes)!==JSON.stringify(existing?.handwriting??[])||color!==(existing?.color??palette[0])||tool!==(existing?.tool??'highlight')||reanchor&&!!existing;
 const close=()=>{if(dirty)Alert.alert('Fermer sans enregistrer ?','Les modifications de cette note ne seront pas conservées.',[{text:'Continuer',style:'cancel'},{text:'Ne pas enregistrer',style:'destructive',onPress:onClose}]);else onClose();};
 const hasWord=selection.wordId!==undefined||selection.wordIndex!==undefined;
 const choose=(name:string,selected:boolean,press:()=>void)=><Pressable key={name} accessibilityRole="button" accessibilityState={{selected}} onPress={press} style={{minHeight:44,justifyContent:'center',padding:12,borderRadius:12,borderWidth:1,borderColor:selected?colors.green:colors.line,backgroundColor:selected?colors.soft:colors.paper}}><Label style={{fontSize:13,fontWeight:'600'}}>{name}</Label></Pressable>;
 const save=()=>{
  const anchor=reanchor?selectionForScope(selection,scope):existing?.anchor;
  const now=annotationTime(existing?.updatedAt);
  onSave({...existing,id:existing?.id??`note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,source:existing?.source??source,page:existing?.page??page,tool,color,points:existing?.points??[],anchor,text:text.trim().slice(0,4000),handwriting:strokes,updatedAt:now});
 };
 return <Modal visible transparent animationType="slide" onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end',alignItems:'center',backgroundColor:'rgba(24,20,30,0.35)'}}><View style={{width:'100%',maxWidth:660,maxHeight:'90%',borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:colors.paper,padding:18}}><Label style={{fontWeight:'800',fontSize:21}}>{existing?'Ma note':'Annoter ce passage'}</Label><Label style={{fontSize:12,color:colors.muted,marginTop:5}}>{reference({start:selection.verseId,end:selection.verseId})}</Label>{scope==='word'&&selection.wordText&&<Label style={{fontSize:24,textAlign:'right',marginTop:5}}>{selection.wordText}</Label>}<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingVertical:12}}>
  {hasWord&&<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{choose('Ce mot',scope==='word',()=>{setScope('word');setReanchor(true);})}{choose('Tout le verset',scope==='verse',()=>{setScope('verse');setReanchor(true);})}</View>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{choose('Surligner',tool==='highlight',()=>{setTool('highlight');setReanchor(true);})}{choose('Entourer',tool==='circle',()=>{setTool('circle');setReanchor(true);})}</View>
  <View style={{flexDirection:'row',gap:10}}>{palette.map((value,i)=><Pressable key={value} accessibilityRole="button" accessibilityLabel={['Or','Vert','Rose','Bleu'][i]} accessibilityState={{selected:color===value}} onPress={()=>setColor(value)} style={{width:44,height:44,borderRadius:22,backgroundColor:value,borderWidth:color===value?3:0,borderColor:colors.text}}/>)}</View>
  <Label style={{fontWeight:'700'}}>Mon commentaire</Label><View style={{flexDirection:'row',gap:8}}>{choose('Clavier',input==='keyboard',()=>setInput('keyboard'))}{choose('Stylet',input==='pen',()=>setInput('pen'))}</View>
  {input==='keyboard'?<TextInput accessibilityLabel="Commentaire de la note" multiline maxLength={4000} value={text} onChangeText={setText} placeholder="Écris ton commentaire…" placeholderTextColor={colors.muted} style={{minHeight:130,maxHeight:260,textAlignVertical:'top',borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,color:colors.text,backgroundColor:colors.soft,fontSize:16}}/>:<><NoteHandwriting strokes={strokes} color={color} onChange={setStrokes}/><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{choose('Annuler le dernier trait',false,()=>setStrokes(value=>value.slice(0,-1)))}{choose('Effacer l’écriture',false,()=>setStrokes([]))}</View></>}
  <Label style={{fontSize:12,color:colors.muted}}>Le repère restera sur la page. Touche-le pour retrouver cette note.</Label>
  {existing&&<Button secondary onPress={()=>onDelete(existing)}>Supprimer la note et le repère</Button>}
 </ScrollView><View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Button secondary onPress={close}>{existing?'Fermer':'Annuler'}</Button></View><View style={{flex:1}}><Button onPress={save}>Enregistrer</Button></View></View></View></KeyboardAvoidingView></Modal>;
}
