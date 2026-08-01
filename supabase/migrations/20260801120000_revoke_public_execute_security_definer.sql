-- Fecha o buraco das RPCs SECURITY DEFINER abertas ao público.
--
-- CAUSA RAIZ: no Postgres, toda função nasce com EXECUTE concedido a PUBLIC.
-- As migrations anteriores tentaram fechar isso com
--   revoke execute on function ... from anon, authenticated;
-- (ver 20260727100000_progress_snapshots.sql e 20260726120000_badge_rarity_rpc.sql),
-- mas isso só remove as concessões NOMINAIS: o grant a PUBLIC continua de pé e
-- anon/authenticated seguem executando por herança. Confirmado no banco:
--   take_progress_snapshots  → proacl "=X/postgres"  → has_function_privilege('anon', …) = true
--   get_badge_rarity         → idem, mesmo com o revoke de anon já aplicado
-- Ou seja: a proteção existia no papel e nunca valeu na prática.
--
-- IMPACTO REAL (antes desta migration): qualquer pessoa com a anon key — que é
-- pública por definição, vai no bundle do cliente — podia chamar
-- /rest/v1/rpc/take_progress_snapshots e disparar um INSERT…SELECT sobre a base
-- INTEIRA (todos os usuários), quantas vezes quisesse. É trabalho de cron, não
-- de API. As demais expunham agregados (nº de perfis, quem estuda cada edital)
-- para quem não está logado.
--
-- REGRA DAQUI PRA FRENTE: em função nova, sempre
--   revoke execute on function ... from public;   -- primeiro isto
--   grant  execute on function ... to <papel>;    -- e só então o papel certo
-- Revogar de anon/authenticated sem revogar de public não protege nada.

-- ── 1. Só o cron/service_role executa ────────────────────────────────────────
-- Job diário (pg_cron roda como postgres) — nunca chamada pela aplicação.
revoke execute on function public.take_progress_snapshots() from public, anon, authenticated;

-- Função de TRIGGER: não deve ser chamável como RPC por ninguém.
revoke execute on function public.follow_on_request_atendido() from public, anon, authenticated;

-- ── 2. Só usuário autenticado ───────────────────────────────────────────────
-- Todas as rotas que usam estas RPCs vivem sob /(app), com sessão exigida no
-- middleware (proxy.ts). anon não tem uso legítimo para nenhuma delas.
revoke execute on function public.get_badge_rarity() from public, anon;
grant  execute on function public.get_badge_rarity() to authenticated;

revoke execute on function public.edital_studying_counts() from public, anon;
grant  execute on function public.edital_studying_counts() to authenticated;

revoke execute on function public.activate_catalog_flashcard_deck(uuid) from public, anon;
grant  execute on function public.activate_catalog_flashcard_deck(uuid) to authenticated;
