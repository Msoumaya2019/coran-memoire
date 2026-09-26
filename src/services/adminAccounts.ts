import {AppState} from '../core/program';
import {supabase} from './sync';

export type LearningAccount={user_id:string;email:string|null;first_name:string;created_at:string;synced_at:string|null;knowledge:AppState['knowledge']|null;goal:AppState['goal']|null;pace:string|null;total_accounts:number};
export async function listLearningAccounts(offset=0,search=''):Promise<LearningAccount[]>{
  if(!supabase)throw new Error('Connexion requise.');
  const {data,error}=await supabase.rpc('admin_learning_accounts',{p_offset:offset,p_search:search.trim()});
  if(error)throw error;
  return data??[];
}
