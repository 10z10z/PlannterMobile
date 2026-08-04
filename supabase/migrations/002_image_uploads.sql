-- Run this in the Supabase SQL editor after schema.sql.
-- Adds a public-read storage bucket for photos (plants now; seed packs,
-- fertilizers, containers later) and an image_url column on plants.

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Uploaded paths are namespaced as "<user_id>/<entity>/<filename>", e.g.
-- "3fa8.../plants/photo-1699999999.jpg". Anyone can read (bucket is public),
-- but a user can only write/modify/delete files under their own folder.

create policy "Users upload to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update their own files"
  on storage.objects for update
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own files"
  on storage.objects for delete
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

alter table plants add column image_url text;
