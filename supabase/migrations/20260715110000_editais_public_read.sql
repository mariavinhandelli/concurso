-- Hub de Editais — leitura PÚBLICA do catálogo (SEO / aquisição).
-- As páginas /editais/** passam a ser acessíveis sem login (proxy.ts), então
-- o papel `anon` ganha SELECT nas tabelas de catálogo — todas contêm apenas
-- informação pública curada de concursos (nada de dado de usuária).
-- Políticas ADITIVAS: as de `authenticated` existentes ficam intactas.
-- Ações (ativar, seguir, importar) continuam exigindo sessão.

do $$
declare
  t text;
begin
  foreach t in array array[
    'editais_catalog',
    'orgaos_catalog',
    'catalog_areas',
    'subjects_catalog',
    'topics_catalog',
    'edital_catalog_subjects',
    'edital_catalog_topics',
    'edital_updates',
    'edital_concurso_stats',
    'edital_past_papers'
  ] loop
    execute format('drop policy if exists "read %I anon" on public.%I', t, t);
    execute format('create policy "read %I anon" on public.%I for select to anon using (true)', t, t);
  end loop;
end $$;
