import React,{useEffect,useState} from 'react';
import {ScrollView} from 'react-native';
import {Button,Card,Label,colors} from './theme';
import {Heading} from './DesignSystem';
import {quizRpc} from '../services/quiz';
import {QuizQuestion} from '../core/quiz';
type Response={user_id:string;user_name:string;quiz_id:string;mode:string;question_id:string;answer_id:string;is_correct:boolean;answered_at:string;question:QuizQuestion};
export function AdminQuizResponses({questionId,onClose}:{questionId?:string;onClose:()=>void}){
 const [rows,setRows]=useState<Response[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
 const load=async(offset=0)=>{setBusy(true);setError('');try{const result:Response[]=await quizRpc('quiz_admin_responses',{p_question:questionId??null,p_offset:offset});setRows(old=>offset?[...old,...result]:result);setMore(result.length===50);}catch(e){setError(e instanceof Error?e.message:'Chargement impossible.');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[questionId]);
 return <ScrollView contentContainerStyle={{padding:18,paddingBottom:40}}><Button secondary disabled={busy} onPress={onClose}>← Gestion des quiz</Button><Heading size={24}>Réponses des utilisateurs</Heading><Label style={{color:colors.muted}}>Question du jour, solo et défis. Les questions sont celles présentées au moment de la réponse.</Label><Button secondary disabled={busy} onPress={()=>void load()}>Actualiser</Button>{!!error&&<Card><Label>{error}</Label></Card>}{rows.map(r=><Card key={`${r.mode}:${r.quiz_id}:${r.user_id}:${r.question_id}`}><Heading size={18}>{r.user_name}</Heading><Label style={{fontSize:12,color:colors.muted}}>{r.mode} · {new Date(r.answered_at).toLocaleString('fr-FR')}</Label><Label style={{fontSize:11,color:colors.muted}}>Compte : {r.user_id} · Quiz : {r.quiz_id}</Label><Label style={{fontWeight:'700',marginTop:10}}>{r.question.question}</Label><Label>Réponse : {r.question.answers.find(a=>a.id===r.answer_id)?.text??r.answer_id}</Label><Label style={{color:r.is_correct?colors.review:colors.red}}>{r.is_correct?'✓ Bonne réponse':'✕ Mauvaise réponse'}</Label>{!r.is_correct&&<Label>Correction : {r.question.answers.find(a=>a.id===r.question.correctAnswerId)?.text??'Indisponible'}</Label>}</Card>)}{!busy&&!error&&!rows.length&&<Label>Aucune réponse enregistrée.</Label>}{busy?<Label>Chargement…</Label>:more&&<Button onPress={()=>void load(rows.length)}>Afficher les réponses suivantes</Button>}</ScrollView>;
}
