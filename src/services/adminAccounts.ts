import {AppState} from '../core/program';
import {supabase} from './sync';

export type LearningAccount={user_id:string;email:string|null;first_name:string;created_at:string;synced_at:string|null;knowledge:AppState['knowledge']|null;goal:AppState['goal']|null;pace:string|null;total_accounts:number;last_usage?:{started_at:string;seconds:number;ended:boolean;updated_at:string}};
export async function listLearningAccounts(offset=0,search=''):Promise<LearningAccount[]>{
  if(!supabase)throw new Error('Connexion requise.');
  const {data,error}=await supabase.rpc('admin_learning_accounts',{p_offset:offset,p_search:search.trim()});
  if(error)throw error;
  const rows:LearningAccount[]=data??[];if(!rows.length)return rows;const usage=await supabase.rpc('admin_last_app_usage',{p_users:rows.map(r=>r.user_id)});if(usage.error)return rows;return rows.map(row=>({...row,last_usage:usage.data?.find((u:{user_id:string})=>u.user_id===row.user_id)}));
}
