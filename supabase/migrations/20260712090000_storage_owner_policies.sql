-- Segurança multiusuário (auditoria jul/2026, críticos 1 e 2 de storage):
-- 1) notebook-images vira PRIVADO — anotações de estudo são conteúdo pessoal.
--    A exibição passa a usar signed URLs (lib/notebook-images.ts).
-- 2) Escrita nos dois buckets passa a exigir que a 1ª pasta do objeto seja o
--    auth.uid() do chamador (convenção de upload já usada pelo app).
--    Antes: qualquer autenticado apagava/sobrescrevia objetos alheios, e
--    INSERT/UPDATE de avatar valia até para anon.
-- 3) avatar ganha policy de DELETE (não existia — "remover foto" nunca apagava).
--    Leitura de avatar segue pública: amigos/turmas exibem a foto pela URL
--    salva no perfil.

update storage.buckets set public = false where id = 'notebook-images';

drop policy if exists "Usuários podem apagar imagens do caderno" on storage.objects;
drop policy if exists "Usuários podem gerenciar imagens do caderno" on storage.objects;
drop policy if exists "Usuários podem subir imagens do caderno" on storage.objects;
drop policy if exists "avatar_authenticated_read" on storage.objects;
drop policy if exists "avatar_user_insert 1bs1gex_0" on storage.objects;
drop policy if exists "avatar_user_update 1bs1gex_0" on storage.objects;
drop policy if exists "notebook_images_authenticated_read" on storage.objects;

-- notebook-images: tudo (inclusive leitura/signed URL) restrito ao dono
create policy notebook_images_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'notebook-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy notebook_images_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notebook-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy notebook_images_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'notebook-images' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'notebook-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy notebook_images_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'notebook-images' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- avatar: leitura para autenticados via API; escrita/remoção só do dono
create policy avatar_select_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'avatar');

create policy avatar_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy avatar_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy avatar_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid()::text));
