-- Remove as políticas SELECT abertas (sem auth) de ambos os buckets
DROP POLICY IF EXISTS "avatar_public_read 1bs1gex_0" ON storage.objects;
DROP POLICY IF EXISTS "Leitura pública das imagens do caderno" ON storage.objects;

-- Cria políticas SELECT que exigem autenticação para listar/ler via API
-- (URLs públicas do bucket — getPublicUrl — continuam funcionando pois bypassa RLS)
CREATE POLICY "avatar_authenticated_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatar' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "notebook_images_authenticated_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'notebook-images' AND auth.uid() IS NOT NULL
  );
