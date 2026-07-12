-- IA invisível · Fase 2 — cache global de conteúdo gerado (LLM em lote).
-- ai_artifacts: NÃO é por usuário. Uma lei ou um julgado é igual para todo
-- mundo, então cada artefato é gerado 1x e servido pra toda a base — custo
-- O(conteúdo-fonte), não O(usuárias). Dedup/idempotência via source_hash
-- (hash do texto-fonte): se o artigo da lei mudar, o hash muda e o pipeline
-- gera de novo; enquanto o texto for o mesmo, reprocessar é no-op.
--
-- Regra de arquitetura (lição da tabela de incidência fabricada no Vade Mecum,
-- ver memória project_vademecum): nada gerado chega à usuária sem validação
-- programática. status começa 'pending' e só vira 'published' depois de passar
-- pela validação (ex.: gabarito C/E checado contra o texto literal do artigo).
-- 'rejected' fica registrado — nunca é silenciosamente descartado, dá pra
-- auditar taxa de rejeição por prompt/modelo.

create table public.ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_type text not null,        -- 'questao_ce_lei' | 'resumo_como_cai_juris'
  source_key text not null,           -- 'cf-88:37' (artigo_key) | jurisprudencia.id
  source_hash text not null,          -- sha256 do texto-fonte usado no prompt
  payload jsonb not null,             -- conteúdo gerado (formato depende do artifact_type)
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  validation_notes text,
  model text,                         -- modelo usado na geração, p/ auditoria
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  unique (artifact_type, source_key, source_hash)
);

create index ai_artifacts_lookup_idx on public.ai_artifacts (artifact_type, source_key, status);

alter table public.ai_artifacts enable row level security;

-- Conteúdo publicado é público para qualquer usuária autenticada (não é dado
-- pessoal — é conteúdo de estudo compartilhado). Pending/rejected não vazam
-- (evita expor rascunho não validado ou lixo rejeitado na UI).
create policy "ai_artifacts_select_published" on public.ai_artifacts
  for select using (status = 'published' and (select auth.uid()) is not null);

-- Escrita exclusiva do service role (Edge Function de geração) — nunca do cliente.
