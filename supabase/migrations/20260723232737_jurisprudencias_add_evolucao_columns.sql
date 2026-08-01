-- Auditoria Jurisprudências 23/07/2026: o form (e o tipo TS JurisprudenciaInput)
-- enviam supera_entendimento_anterior e observacao_evolucao, mas as colunas
-- nunca existiram na tabela — TODO create/update de julgado próprio falhava
-- com "Could not find the observacao_evolucao column" (PostgREST).
alter table jurisprudencias
  add column if not exists supera_entendimento_anterior boolean not null default false,
  add column if not exists observacao_evolucao text;
