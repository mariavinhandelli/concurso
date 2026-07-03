-- Merge atômico de chaves no JSONB profiles.settings.
-- Evita TOCTOU de read-modify-write em multi-aba: cada chamada só sobrescreve
-- as chaves do patch, preservando todas as outras chaves existentes.
create or replace function merge_profile_settings(
  p_user_id uuid,
  p_patch    jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set settings = coalesce(settings, '{}'::jsonb) || p_patch
  where id = p_user_id
    and id = auth.uid();   -- garante que só o próprio usuário pode alterar
$$;

grant execute on function merge_profile_settings(uuid, jsonb) to authenticated;
