-- Corrige 20260803240000 de verdade: a 1ª tentativa (revertida, a transação
-- inteira falhou no assert) tinha um bug a mais — inseria TUDO que faltava
-- na matéria inteira, o que teria religado de volta os 3 tópicos que a
-- própria curadoria tinha acabado de excluir de Técnicas de Identificação.
-- Desta vez, só os tópicos NOVOS por nome.
insert into public.edital_catalog_topics (edital_catalog_id, topic_catalog_id)
select e.id, tc.id
from public.editais_catalog e, public.topics_catalog tc
join public.subjects_catalog s on s.id = tc.subject_catalog_id
where e.slug = 'pc-go-papiloscopista'
  and (
    s.name = 'Química, Física e Biologia (Noções)'
    or (s.name = 'Técnicas de Identificação (Papiloscopia)' and tc.name in (
      'Identificação criminal do civilmente identificado (Lei 12.037/09)',
      'Número único de registro de identidade civil (Lei 9.454/97)',
      'Expedição e validade nacional da carteira de identidade (Lei 7.116/83)'
    ))
  )
  and not exists (
    select 1 from public.edital_catalog_topics x
    where x.edital_catalog_id = e.id and x.topic_catalog_id = tc.id
  );

do $$
declare v int;
begin
  select count(*) into v
  from public.edital_catalog_topics t
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'pc-go-papiloscopista'
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Química, Física e Biologia (Noções)';
  if v <> 13 then raise exception 'Química/Física/Biologia: esperado 13 vinculados, achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'pc-go-papiloscopista'
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  join public.subjects_catalog s on s.id = tc.subject_catalog_id and s.name = 'Técnicas de Identificação (Papiloscopia)';
  if v <> 8 then raise exception 'Técnicas de Identificação: esperado 8 vinculados (5 curados + 3 leis novas), achei %', v; end if;

  select count(*) into v
  from public.edital_catalog_topics t
  join public.editais_catalog e on e.id = t.edital_catalog_id and e.slug = 'pc-go-papiloscopista'
  join public.topics_catalog tc on tc.id = t.topic_catalog_id
  where tc.name in ('Levantamento, revelação e transporte de impressões papilares','Confronto papiloscópico e laudos','Necropapiloscopia');
  if v > 0 then raise exception 'os 3 tópicos excluídos pela curadoria não podiam voltar, achei %', v; end if;
end $$;
