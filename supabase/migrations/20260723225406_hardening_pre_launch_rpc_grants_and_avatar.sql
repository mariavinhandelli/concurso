-- Hardening pré-lançamento (23/07/2026), a partir dos advisors do Supabase.

-- 1) Bucket público `avatar`: o SELECT era bucket-inteiro, permitindo listar
--    arquivos de todos. URL pública não passa por RLS, e o upload (upsert)
--    só precisa enxergar o próprio objeto — escopo estreitado à pasta do dono.
drop policy "avatar_select_authenticated" on storage.objects;
create policy "avatar_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2) Funções SECURITY DEFINER não devem ser executáveis por anon (todas já
--    checam auth.uid() e abortam, mas fechar a superfície é grátis).
--    Revoga do PUBLIC/anon e devolve explicitamente a authenticated+service_role.
--    NOTA (01/08/2026): este é o padrão CORRETO — `revoke ... from public, anon`.
--    As migrations 20260704120021 e 20260726145129 revogaram só de anon/authenticated
--    e por isso não protegeram nada (o grant a PUBLIC continuava valendo).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'activate_catalog_edital(uuid)',
    'activate_catalog_flashcard_deck(uuid)',
    'activate_catalog_subject(uuid)',
    'append_juris_destaque(uuid, jsonb)',
    'create_study_block(date, uuid, uuid, integer)',
    'edit_recurrence_rule_versioned(uuid, text, date, integer, integer[], integer, jsonb, date)',
    'merge_profile_settings(uuid, jsonb)',
    'remove_juris_destaque(uuid, text)',
    'set_primary_target_exam(uuid)',
    'undo_last_cycle_completion(uuid, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

-- 3) handle_new_user é função de TRIGGER (auth.users) — nenhum cliente deveria
--    chamá-la via REST. Fica só com o role que dispara o trigger de signup.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;
