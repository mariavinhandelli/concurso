-- CRÍTICO (auditoria Jurisprudências 23/07/2026):
-- juris_interacoes.jurisprudencia_id tinha FK para jurisprudencias(id), mas os
-- 154 julgados do banco oficial vivem no BUNDLE (data/jurisprudencias.ts) e não
-- na tabela — toda interação com o banco oficial (favorito, anotação, tags,
-- revisão espaçada, avaliação SRS) falhava com 23503 e o erro era engolido.
-- A FK só é satisfeita pelos julgados criados por usuários (11 hoje).
--
-- Remoção deliberada: o id pode referenciar o bundle OU a tabela. A exclusão de
-- julgado próprio é soft-delete (deleted_at), então o ON DELETE CASCADE desta FK
-- praticamente nunca agia. Interações órfãs de um hard-delete manual são
-- inofensivas (escopadas por user_id via RLS).
alter table juris_interacoes drop constraint juris_interacoes_jurisprudencia_id_fkey;

-- Privacidade: a UI trata julgados criados como PRIVADOS do criador (a lista
-- filtra por created_by), mas a policy de SELECT era "true" para qualquer
-- autenticado — um usuário conseguia ler julgado alheio por id direto.
drop policy "juris_read_all" on jurisprudencias;
create policy "juris_read_own" on jurisprudencias
  for select to authenticated
  using ((select auth.uid()) = created_by);
