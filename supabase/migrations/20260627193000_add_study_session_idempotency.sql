-- Identificador gerado no cliente para que reenvios da mesma sessão sejam seguros.
alter table public.study_logs
  add column if not exists client_session_id text;

alter table public.cycle_completions
  add column if not exists client_session_id text;

alter table public.study_blocks
  add column if not exists completed_by_session_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_logs_user_client_session_key'
      and conrelid = 'public.study_logs'::regclass
  ) then
    alter table public.study_logs
      add constraint study_logs_user_client_session_key
      unique (user_id, client_session_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_completions_user_client_session_key'
      and conrelid = 'public.cycle_completions'::regclass
  ) then
    alter table public.cycle_completions
      add constraint cycle_completions_user_client_session_key
      unique (user_id, client_session_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'study_blocks_user_completed_session_key'
      and conrelid = 'public.study_blocks'::regclass
  ) then
    alter table public.study_blocks
      add constraint study_blocks_user_completed_session_key
      unique (user_id, completed_by_session_id);
  end if;
end
$$;
