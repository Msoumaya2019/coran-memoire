-- Editorial media only. User voice recordings remain in their existing private bucket.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('daily-content-media','daily-content-media',false,31457280,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/aac'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy daily_media_admin on storage.objects for all to authenticated
using(bucket_id='daily-content-media' and private.is_app_admin())
with check(bucket_id='daily-content-media' and private.is_app_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy daily_media_active_read on storage.objects for select to anon,authenticated
using(bucket_id='daily-content-media' and exists(
 select 1 from public.daily_contents c join public.content_categories cat on cat.id=c.category_id
 where c.is_active and cat.is_active and
 (right(c.image_url,length(storage.objects.name)+1)='/'||storage.objects.name or right(c.audio_url,length(storage.objects.name)+1)='/'||storage.objects.name)
));
commit;
