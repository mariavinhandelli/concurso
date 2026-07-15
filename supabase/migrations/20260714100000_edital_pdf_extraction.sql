-- IA ativa · upload de edital em PDF.
-- Diferente das Fases 1-3 (IA invisível, roda de madrugada via pg_cron sem
-- nenhuma ação da usuária), esta é a primeira feature de IA disparada por
-- ação explícita: a usuária sobe o PDF do edital e a extração acontece na
-- hora, dentro do caminho da própria requisição.

-- Bucket privado do PDF. file_size_limit e allowed_mime_types são defesa
-- nativa do bucket — nem `avatar` nem `notebook-images` usam isso hoje (a
-- validação deles é só client-side), mas aqui é a primeira vez que aceitamos
-- upload de um arquivo arbitrário da usuária, então vale a camada extra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('edital-uploads', 'edital-uploads', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Mesmo padrão owner-only de notebook-images (20260712090000): a 1ª pasta do
-- objeto precisa ser o auth.uid() de quem chama.
create policy edital_uploads_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'edital-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy edital_uploads_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'edital-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy edital_uploads_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'edital-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'edital-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy edital_uploads_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'edital-uploads' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Log leve da extração (rate limit + auditoria), mesmo espírito de
-- flashcard_generation_log — mas SEM guardar o payload extraído (não há
-- necessidade de reter o conteúdo do edital além da própria extração).
--
-- Diferença importante em relação ao padrão-fonte: a Edge Function
-- extract-edital-pdf roda com o JWT da própria usuária (não service role,
-- ver comentário na function), porque aqui RLS já resolve "isso é meu?"
-- sozinho tanto no storage quanto nesta tabela. Por isso, diferente de
-- flashcard_generation_log (onde a escrita é exclusiva do service role),
-- esta tabela PRECISA de policy de INSERT para authenticated.
create table public.edital_pdf_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('success', 'rejected', 'error')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.edital_pdf_extractions enable row level security;

create policy "edital_pdf_extractions_select_own" on public.edital_pdf_extractions
  for select using ((select auth.uid()) = user_id);

create policy "edital_pdf_extractions_insert_own" on public.edital_pdf_extractions
  for insert with check ((select auth.uid()) = user_id);

-- Backstop de limpeza do bucket. O try/finally da Edge Function já apaga o
-- PDF ao final de cada extração (sucesso, rejeição do juiz ou erro), mas isso
-- não cobre a function crashando antes do finally nem a usuária subir um
-- arquivo e nunca confirmar. Roda a cada hora, apaga só o que sobrou de fato
-- órfão (mais de 1h de idade).
create or replace function public.cleanup_stale_edital_uploads()
returns void
language sql
security definer
set search_path = storage
as $fn$
  delete from storage.objects
  where bucket_id = 'edital-uploads'
    and created_at < now() - interval '1 hour';
$fn$;

revoke execute on function public.cleanup_stale_edital_uploads() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-stale-edital-uploads') then
    perform cron.unschedule('cleanup-stale-edital-uploads');
  end if;
  perform cron.schedule(
    'cleanup-stale-edital-uploads',
    '0 * * * *',
    'select public.cleanup_stale_edital_uploads();'
  );
end $$;
