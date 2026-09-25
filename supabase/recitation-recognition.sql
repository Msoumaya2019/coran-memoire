-- Additive migration for on-device recitation analysis. Audio remains in the private bucket.
alter table public.recitations add column if not exists recognition_summary jsonb;
update storage.buckets
set allowed_mime_types=array['audio/mp4','audio/3gpp','audio/m4a','audio/wav']
where id='recitations';
