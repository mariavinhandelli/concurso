-- Corrige regressão da migration 20260803193000: os 24 tópicos novos criados
-- para a cobertura da PM-GO foram vinculados só aos editais da PM-GO — mas
-- as matérias afetadas (Direito Penal, Direito Constitucional, Direito
-- Administrativo, Direito Processual Penal, Direito Penal Militar, Direito
-- Processual Penal Militar, Legislação Penal Especial, Conhecimentos
-- Regionais) são COMPARTILHADAS por 12 outros editais não curados — cuja
-- regra (desde a migration 20260731100000) é "vincula TODOS os tópicos da
-- matéria". Resultado: pc-go-*, tj-go-*, tce-go e inss-tecnico ficaram com a
-- grade defasada em relação ao próprio catálogo, exatamente o defeito que a
-- migration de 31/07 já tinha corrigido uma vez (2ª recorrência).
--
-- Mesma operação da 20260731100000, sem escopo de slug: religa qualquer
-- (edital não curado, matéria) cujo catálogo cresceu.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id, incidencia)
select e.id, tc.id, null
from public.editais_catalog e
join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id and ecs.topicos_curados = false
join public.topics_catalog tc on tc.subject_catalog_id = ecs.subject_catalog_id
where not exists (
  select 1 from public.edital_catalog_topics x
  where x.edital_catalog_id = e.id and x.topic_catalog_id = tc.id
);

-- Backfill dos 2 alvos ativos atingidos (TCE-GO e TJ-GO Juiz Substituto) —
-- mesma semântica do backfill de PM-GO: adoção por nome, filho só se o pai já
-- existe no acervo, religamento idempotente das folhas.
create temp table _alvos2 on commit drop as
select distinct te.id as target_id, te.user_id, e.id as edital_id
from public.target_exams te
join public.editais_catalog e on e.id = te.catalog_edital_id or e.slug = te.slug
where e.slug in ('tce-go-tecnico-controle-externo', 'tj-go-juiz-substituto')
  and te.archived_at is null;

update public.topics t
set catalog_id = tc.id
from (
  select distinct a.user_id, ect.topic_catalog_id
  from _alvos2 a join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
) alvo
join public.topics_catalog tc on tc.id = alvo.topic_catalog_id
join public.subjects su on su.user_id = alvo.user_id and su.catalog_id = tc.subject_catalog_id
where t.user_id = alvo.user_id and t.subject_id = su.id and t.catalog_id is null
  and lower(trim(public.immutable_unaccent(t.name))) = lower(trim(public.immutable_unaccent(tc.name)));

insert into public.topics (user_id, subject_id, name, position, catalog_id, parent_id)
select alvo.user_id, su.id, tc.name, tc.position, tc.id, tp.id
from (
  select distinct a.user_id, ect.topic_catalog_id
  from _alvos2 a join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
) alvo
join public.topics_catalog tc on tc.id = alvo.topic_catalog_id
join public.subjects su on su.user_id = alvo.user_id and su.catalog_id = tc.subject_catalog_id
left join public.topics tp on tc.parent_id is not null
  and tp.user_id = alvo.user_id and tp.catalog_id = tc.parent_id
where (tc.parent_id is null or tp.id is not null)
  and not exists (
    select 1 from public.topics t2
    where t2.user_id = alvo.user_id and t2.subject_id = su.id and t2.catalog_id = tc.id
  )
  and not exists (
    select 1 from public.topics t3
    where t3.user_id = alvo.user_id and t3.subject_id = su.id
      and lower(trim(public.immutable_unaccent(t3.name))) = lower(trim(public.immutable_unaccent(tc.name)))
  );

insert into public.topic_target_exams (topic_id, target_exam_id)
select t.id, a.target_id
from _alvos2 a
join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
join public.topics t on t.catalog_id = ect.topic_catalog_id and t.user_id = a.user_id
where not exists (select 1 from public.topics c where c.parent_id = t.id)
on conflict do nothing;

-- Verificação dura: nenhum edital não curado pode ter catálogo > vínculo, e os
-- 2 alvos ativos não podem ter folha do edital sem vínculo.
do $$
declare v int;
begin
  select count(*) into v
  from public.editais_catalog e
  join public.edital_catalog_subjects ecs on ecs.edital_catalog_id = e.id and ecs.topicos_curados = false
  where (select count(*) from public.topics_catalog tc where tc.subject_catalog_id = ecs.subject_catalog_id)
      > (select count(*) from public.edital_catalog_topics x
         join public.topics_catalog tc on tc.id = x.topic_catalog_id
         where x.edital_catalog_id = e.id and tc.subject_catalog_id = ecs.subject_catalog_id);
  if v > 0 then raise exception 'ainda há % (edital,matéria) não curados com catálogo maior que o vínculo', v; end if;

  select count(*) into v
  from _alvos2 a
  join public.edital_catalog_topics ect on ect.edital_catalog_id = a.edital_id
  join public.topics_catalog tc on tc.id = ect.topic_catalog_id
  join public.subjects su on su.user_id = a.user_id and su.catalog_id = tc.subject_catalog_id
  join public.topics t on t.catalog_id = tc.id and t.user_id = a.user_id
  where not exists (select 1 from public.topics c where c.parent_id = t.id)
    and not exists (select 1 from public.topic_target_exams y where y.topic_id = t.id and y.target_exam_id = a.target_id);
  if v > 0 then raise exception 'vínculos faltando após backfill: %', v; end if;
end $$;
