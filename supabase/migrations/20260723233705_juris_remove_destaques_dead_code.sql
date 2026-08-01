-- Backlog da auditoria de Jurisprudências (23/07/2026):
-- O recurso de destaques nunca ganhou UI — funções e coluna órfãs.
-- Verificado antes de remover: 0 linhas com destaques preenchidos.
-- (As RPCs eram SECURITY DEFINER expostas via REST sem uso — menos superfície.)
drop function if exists public.append_juris_destaque(uuid, jsonb);
drop function if exists public.remove_juris_destaque(uuid, text);
alter table juris_interacoes drop column if exists destaques;
