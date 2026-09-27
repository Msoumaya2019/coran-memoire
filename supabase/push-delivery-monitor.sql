-- Track the existing Expo sending flow without storing complete tokens or message bodies.
begin;
create extension if not exists pg_cron;
create table if not exists private.push_delivery_log (
 request_id bigint primary key,user_id uuid,platform text,token_fingerprint text,
 ticket_id text,status text not null default 'queued',error_code text,
 receipt_request_id bigint,receipt_attempts integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table private.push_delivery_log enable row level security;
revoke all on private.push_delivery_log from public,anon,authenticated;
create index if not exists push_delivery_pending on private.push_delivery_log(status,created_at);
create or replace function private.send_expo_push(url text,body jsonb,headers jsonb,timeout_milliseconds integer default 5000)
returns bigint language plpgsql security definer set search_path='' as $$
declare req bigint; device record;
begin
 if url<>'https://exp.host/--/api/v2/push/send' then raise exception 'Unexpected push URL'; end if;
 select user_id,platform into device from public.push_devices where expo_push_token=body->>'to';
 req:=net.http_post(url:=url,body:=body,headers:=headers,timeout_milliseconds:=timeout_milliseconds);
 insert into private.push_delivery_log(request_id,user_id,platform,token_fingerprint)
 values(req,device.user_id,device.platform,md5(body->>'to'));
 raise log '[Push][Server] queued request %, platform %',req,device.platform;
 return req;
end $$;
revoke all on function private.send_expo_push(text,jsonb,jsonb,integer) from public,anon,authenticated;
-- Preserve each existing payload and recipient filter; only wrap its Expo request.
do $$ declare item record; definition text; begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname,p.proname) in (('private','notify_private_message'),('public','send_admin_notification'))
 and p.prokind='f' and p.prosrc like '%net.http_post%' and p.prosrc like '%https://exp.host/--/api/v2/push/send%'
 loop definition:=replace(pg_get_functiondef(item.oid),'net.http_post','private.send_expo_push');execute definition;end loop;
end $$;
create or replace function private.collect_push_receipts() returns void language plpgsql security definer set search_path='' as $$
declare item record; result jsonb; payload jsonb; req bigint;
begin
 for item in select l.*,r.status_code,r.error_msg,r.timed_out,r.content from private.push_delivery_log l
 join net._http_response r on r.id=l.request_id where l.status='queued' limit 200
 loop
  begin result:=item.content::jsonb->'data';exception when others then result:=null;end;
  if item.status_code<>200 or item.timed_out or item.error_msg is not null then
   update private.push_delivery_log set status='transport_error',error_code=coalesce(item.error_msg,'HTTP_'||coalesce(item.status_code::text,'unknown')),updated_at=now() where request_id=item.request_id;
  elsif result->>'status'='ok' and result->>'id' is not null then
   update private.push_delivery_log set status='ticket_ok',ticket_id=result->>'id',updated_at=now() where request_id=item.request_id;
  else
   update private.push_delivery_log set status='ticket_error',error_code=coalesce(result->'details'->>'error','InvalidProviderResponse'),updated_at=now() where request_id=item.request_id;
   raise warning '[Push][Ticket] request %, platform %, error %',item.request_id,item.platform,result->'details'->>'error';
  end if;
 end loop;
 for item in select l.*,r.content from private.push_delivery_log l join net._http_response r on r.id=l.receipt_request_id where l.status='receipt_pending' limit 200
 loop
  begin result:=item.content::jsonb->'data'->item.ticket_id;exception when others then result:=null;end;
  if result->>'status' in ('ok','error') then
   update private.push_delivery_log set status=case when result->>'status'='ok' then 'receipt_ok' else 'receipt_error' end,error_code=result->'details'->>'error',updated_at=now() where request_id=item.request_id;
   if result->>'status'='error' then raise warning '[Push][Receipt] request %, platform %, error %',item.request_id,item.platform,result->'details'->>'error';end if;
  else
   update private.push_delivery_log set status=case when receipt_attempts>=8 then 'receipt_unavailable' else 'ticket_ok' end,receipt_request_id=null,updated_at=now() where request_id=item.request_id;
  end if;
 end loop;
 select jsonb_build_object('ids',jsonb_agg(ticket_id)) into payload from
 (select ticket_id from private.push_delivery_log where status='ticket_ok' and updated_at<now()-interval '2 minutes' order by created_at limit 100) pending;
 if payload->'ids' is not null then
  req:=net.http_post(url:='https://exp.host/--/api/v2/push/getReceipts',body:=payload,headers:='{"Content-Type":"application/json"}'::jsonb);
  update private.push_delivery_log set status='receipt_pending',receipt_request_id=req,receipt_attempts=receipt_attempts+1,updated_at=now() where status='ticket_ok' and ticket_id in (select jsonb_array_elements_text(payload->'ids'));
 end if;
 update private.push_delivery_log set status='transport_timeout',error_code='ResponseExpired',updated_at=now() where status='queued' and created_at<now()-interval '15 minutes';
end $$;
revoke all on function private.collect_push_receipts() from public,anon,authenticated;
select cron.schedule('coran-push-receipts','* * * * *','select private.collect_push_receipts()');
create or replace function public.my_push_delivery_status()
returns table(platform text,status text,error_code text,created_at timestamptz)
language sql security definer set search_path='' as $$
 select l.platform,l.status,l.error_code,l.created_at from private.push_delivery_log l
 where l.user_id=auth.uid() order by l.created_at desc limit 10;
$$;
revoke all on function public.my_push_delivery_status() from public,anon;
grant execute on function public.my_push_delivery_status() to authenticated;
commit;
