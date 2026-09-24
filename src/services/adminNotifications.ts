import {supabase} from './sync';

export type AdminNotificationRecipient={user_id:string;display_name:string;device_count:number};
export type AdminNotificationHistory={id:string;target_user_id:string|null;title:string;body:string;recipient_count:number;device_count:number;created_at:string};

function client(){if(!supabase)throw new Error('Connexion Supabase requise.');return supabase;}

export async function listAdminNotificationRecipients():Promise<AdminNotificationRecipient[]>{
  const {data,error}=await client().rpc('admin_notification_recipients');
  if(error)throw error;
  return data as AdminNotificationRecipient[];
}

export async function listAdminNotificationHistory():Promise<AdminNotificationHistory[]>{
  const {data,error}=await client().from('admin_notifications').select('id,target_user_id,title,body,recipient_count,device_count,created_at').order('created_at',{ascending:false}).limit(20);
  if(error)throw error;
  return data as AdminNotificationHistory[];
}

export async function sendAdminNotification(target:string|null,title:string,body:string,requestId:string):Promise<{recipient_count:number;device_count:number}>{
  const {data,error}=await client().rpc('send_admin_notification',{p_target:target,p_title:title,p_body:body,p_request_id:requestId});
  if(error)throw error;
  const result=(data as {recipient_count:number;device_count:number}[])?.[0];
  if(!result)throw new Error('Aucun accusé de réception Supabase.');
  return result;
}
