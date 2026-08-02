-- Auditoria de performance (02/08) — coverage.service.ts e raiox.service.ts
-- faziam, cada um, a MESMA query (study_logs.topic_id do usuário, sem
-- .limit()) para montar o conjunto de tópicos estudados: 2 leituras
-- idênticas por carga de tela, e ambas sem limite (arriscam truncar o
-- resultado no max_rows do PostgREST em contas com histórico muito grande).
-- RPC devolve só os topic_id DISTINTOS (conjunto pequeno mesmo com milhares
-- de sessões — um usuário tem no máximo algumas centenas de tópicos na
-- biblioteca), e roda fora do REST auto-gerado, então não está sujeito ao
-- max_rows das tabelas. Consumida via cache compartilhado (mesmo padrão de
-- getPrimaryTargetExam), então também elimina a duplicação de query.
create or replace function public.get_studied_topic_ids()
returns table (topic_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct l.topic_id
  from public.study_logs l
  where l.user_id = auth.uid()
    and l.topic_id is not null;
$$;

revoke all on function public.get_studied_topic_ids() from public, anon;
grant execute on function public.get_studied_topic_ids() to authenticated;
