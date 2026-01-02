-- Create a public bucket for generated article images (avoid storing base64 in DB)
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = true;

-- Public read access for article images
create policy "Public can read article images"
on storage.objects
for select
using (bucket_id = 'article-images');

-- Allow authenticated uploads (optional; edge functions using service role can upload regardless)
create policy "Authenticated can upload article images"
on storage.objects
for insert
with check (bucket_id = 'article-images' and auth.role() = 'authenticated');

create policy "Authenticated can update article images"
on storage.objects
for update
using (bucket_id = 'article-images' and auth.role() = 'authenticated');

create policy "Authenticated can delete article images"
on storage.objects
for delete
using (bucket_id = 'article-images' and auth.role() = 'authenticated');
