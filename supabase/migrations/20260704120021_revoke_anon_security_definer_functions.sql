-- ⚠️ ATENÇÃO (documentado em 01/08/2026): revogar de `anon` NÃO fecha o acesso.
-- Toda função nasce com EXECUTE para PUBLIC; anon herda por PUBLIC e continua
-- executando. Ver 20260801120000_revoke_public_execute_security_definer.sql —
-- a revogação que vale é `... FROM public`.
REVOKE EXECUTE ON FUNCTION public.activate_catalog_subject FROM anon;
REVOKE EXECUTE ON FUNCTION public.append_juris_destaque FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_study_block FROM anon;
REVOKE EXECUTE ON FUNCTION public.edit_recurrence_rule_versioned FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_profile_settings FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_juris_destaque FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_primary_target_exam FROM anon;
REVOKE EXECUTE ON FUNCTION public.undo_last_cycle_completion FROM anon;
