-- friendships_block_guard é função de TRIGGER: só o Postgres deve invocá-la.
-- A migration anterior revogou de public/anon, mas o Supabase concede EXECUTE a
-- `authenticated` por padrão, então ela ficou exposta como /rest/v1/rpc/...
-- Chamá-la fora de um trigger falha (não há NEW), então não era explorável —
-- mas função de trigger não tem por que aparecer na superfície da API.
revoke all on function public.friendships_block_guard() from authenticated;
