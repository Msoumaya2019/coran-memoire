import React,{useEffect,useRef,useState} from 'react';
import {FlatList,View} from 'react-native';
import {Button,Card,colors,Field,Label,Title} from './ui/theme';
import {defaultState,memorizedIds,paceLabels,progress} from './core/program';
import {LearningAccount,listLearningAccounts} from './services/adminAccounts';

export function AdminAccounts({onClose}:{onClose:()=>void}){
  const [items,setItems]=useState<LearningAccount[]>([]),[search,setSearch]=useState(''),[query,setQuery]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[total,setTotal]=useState(0);
  const request=useRef(0),loading=useRef(false);
  const load=async(offset:number)=>{
    if(loading.current)return;
    const id=++request.current;loading.current=true;setBusy(true);setError('');
    try{const rows=await listLearningAccounts(offset,query);if(id!==request.current)return;
      setItems(old=>offset?[...old,...rows.filter(row=>!old.some(item=>item.user_id===row.user_id))]:rows);
      setTotal(Number(rows[0]?.total_accounts??(offset?total:0)));
    }catch(e){if(id===request.current)setError(e instanceof Error?e.message:String(e));}
    finally{if(id===request.current){loading.current=false;setBusy(false);}}
  };
  useEffect(()=>{request.current++;loading.current=false;setItems([]);setTotal(0);void load(0);return()=>{request.current++;loading.current=false;};},[query]);
  return <FlatList data={items} keyExtractor={item=>item.user_id} contentContainerStyle={{padding:18,paddingBottom:40}}
    ListHeaderComponent={<View><Button secondary onPress={onClose}>← Administration</Button><Title>Comptes et progression</Title>
      <Label>{total} compte{total===1?'':'s'} inscrit{total===1?'':'s'}</Label>
      <Field value={search} onChangeText={setSearch} placeholder="Prénom ou adresse e-mail" />
      <Button secondary disabled={busy} onPress={()=>search.trim()===query?void load(0):setQuery(search.trim())}>Rechercher / actualiser</Button>
      <Label style={{fontSize:12,color:colors.muted}}>Données d’apprentissage synchronisées. Les versets simplement consultés ne sont pas comptés.</Label>
      {!!error&&<Card><Label>{error}</Label></Card>}</View>}
    renderItem={({item})=>{
      const state={...defaultState(),knowledge:item.knowledge??{},...(item.goal?{goal:item.goal}:{})};
      const p=progress(state),known=memorizedIds(state).length;
      return <Card><Label style={{fontWeight:'700'}}>{item.first_name}</Label><Label>{item.email??'Adresse non renseignée'}</Label>
        <Label style={{fontSize:12,color:colors.muted}}>Inscrit le {new Date(item.created_at).toLocaleDateString('fr-FR')}</Label>
        {item.synced_at?<><Label>{known} verset{known===1?'':'s'} mémorisé{known===1?'':'s'} · {(p.quran*100).toFixed(1)} % du Coran</Label>
          {item.goal&&<><Label>Objectif : {item.goal.label} · {(p.goal*100).toFixed(1)} %</Label><View accessibilityLabel={`Progression de l’objectif ${(p.goal*100).toFixed(1)} pour cent`} style={{height:6,backgroundColor:colors.line,borderRadius:3,marginVertical:8}}><View style={{height:6,width:`${Math.min(100,p.goal*100)}%`,backgroundColor:colors.green,borderRadius:3}} /></View></>}
          <Label>Rythme : {paceLabels[item.pace as keyof typeof paceLabels]??'Non renseigné'}</Label>
          <Label style={{fontSize:12,color:colors.muted}}>Dernière synchronisation : {new Date(item.synced_at).toLocaleString('fr-FR')}</Label></>:<Label>Apprentissage pas encore synchronisé.</Label>}
      </Card>;
    }}
    ListEmptyComponent={!busy&&!error?<Label>Aucun compte correspondant.</Label>:null}
    ListFooterComponent={busy?<Label>Chargement des comptes…</Label>:items.length<total?<Button secondary onPress={()=>void load(items.length)}>Afficher les comptes suivants</Button>:null}
  />;
}
