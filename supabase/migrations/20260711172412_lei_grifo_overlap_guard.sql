create or replace function public.append_lei_grifo(p_artigo_key text, p_grifo jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_bloco text := p_grifo->>'bloco';
  v_start int := (p_grifo->>'start')::int;
  v_end int := (p_grifo->>'end')::int;
  v_existing jsonb;
  v_result jsonb;
begin
  -- Trava a linha (se já existir) para serializar contra outra aba/gravação
  -- concorrente do mesmo usuário no mesmo artigo, antes de checar overlap.
  select grifos into v_existing
  from public.lei_interacoes
  where user_id = auth.uid() and artigo_key = p_artigo_key
  for update;

  if v_existing is not null and exists (
    select 1 from jsonb_array_elements(v_existing) g
    where g->>'bloco' = v_bloco
      and v_start < (g->>'end')::int
      and v_end > (g->>'start')::int
  ) then
    raise exception 'Esse trecho já cruza uma marcação existente neste artigo.';
  end if;

  insert into public.lei_interacoes (user_id, artigo_key, grifos, updated_at)
  values (auth.uid(), p_artigo_key, jsonb_build_array(p_grifo), now())
  on conflict (user_id, artigo_key)
  do update set grifos = public.lei_interacoes.grifos || excluded.grifos, updated_at = now()
  returning grifos into v_result;

  return v_result;
end;
$function$;
