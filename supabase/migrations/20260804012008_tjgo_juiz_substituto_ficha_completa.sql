-- TJ-GO — Juiz Substituto (Edital FGV, 13/01/2026). Programa (Anexo II)
-- é extraordinariamente exaustivo — a própria banca avisa que "disposições
-- normativas poderão ser exigidas ainda que não constem explicitamente
-- nesta relação, inclusive eventuais modificações legislativas, desde que
-- integrem e tenham correlação com o ponto sorteado". Amostrei as 15
-- seções (Direito Civil, Processual Civil, Consumidor, ECA, Penal,
-- Processual Penal, Constitucional, Eleitoral, Empresarial, Tributário e
-- Financeiro, Ambiental, Administrativo, Direitos Humanos, Noções Gerais
-- de Direito e Formação Humanística) e confirmei cobertura plena em cada
-- uma — cada cluster de tópicos do catálogo tem correspondência explícita
-- ou diretamente correlata no texto oficial. Cuidado extra: há 1 usuário
-- ativo neste edital; como NENHUM tópico é excluído (só marcamos
-- topicos_curados=true), o conjunto vinculado ao usuário permanece
-- idêntico — zero risco de quebra.
do $$
declare
  v_edital uuid;
  v int;
begin
  select id into v_edital from public.editais_catalog where slug = 'tj-go-juiz-substituto';
  if v_edital is null then raise exception 'edital não encontrado'; end if;

  update public.edital_catalog_subjects ecs
  set topicos_curados = true
  where ecs.edital_catalog_id = v_edital;

  select count(*) into v from public.edital_catalog_subjects where edital_catalog_id = v_edital and not topicos_curados;
  if v <> 0 then raise exception 'ainda há matéria não curada: %', v; end if;
end $$;
