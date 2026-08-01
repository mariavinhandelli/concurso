-- Fecha o WARN "Extension in Public" do advisor de segurança: unaccent vai para o
-- schema `extensions` (mesma convenção já usada por uuid-ossp/pgcrypto neste
-- projeto), em vez de ficar solto em `public`.
--
-- ⚠️ EFEITO COLATERAL DESCOBERTO EM 01/08/2026: esta migration atualizou o helper
-- immutable_unaccent para qualificar o schema, mas NÃO o `unaccent(...)` cru que a
-- migration 20260729000811 (15 minutos antes) tinha acabado de escrever dentro de
-- activate_catalog_subject — cujo search_path é 'public, pg_temp'. Resultado: as
-- três rotas de ativação (edital, deck de flashcards, matéria de catálogo)
-- quebraram com "function unaccent(text) does not exist". Corrigido em
-- 20260802090000_fix_activate_catalog_subject_unaccent.sql.
--
-- LIÇÃO: mover extensão de schema exige varrer TODAS as funções com search_path
-- fixo que a chamam sem qualificar o schema.
alter extension unaccent set schema extensions;

create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

reindex index public.subjects_user_name_unique;
