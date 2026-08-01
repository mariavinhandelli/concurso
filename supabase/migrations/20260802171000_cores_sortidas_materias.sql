-- Cores sortidas para matérias criadas automaticamente.
--
-- O problema: activate_catalog_subject (a porta de entrada de TODA ativação
-- automática — gerar cronograma do edital, ativar edital do Banco, ativar deck
-- do Banco de Flashcards) insere em `subjects` sem informar `color`. Cai no
-- default da coluna, '#C9D8C5'. Resultado: 70 matérias com a MESMA cor pálida —
-- gráfico de pizza, ciclo e blocos da agenda ficam todos iguais e ilegíveis.
--
-- A correção tem duas partes: escolher uma cor da paleta na criação, e
-- redistribuir as que já nasceram cinzas.

-- ── 1. Sorteador de cor ──────────────────────────────────────────────────────
-- Espelha lib/subject-colors.ts (SUBJECT_COLORS). Se a paleta mudar lá, mude
-- aqui também — não há como compartilhar a constante através da fronteira.
-- Escolhe a cor MENOS usada pelo usuário (empate: ordem da paleta), então as
-- primeiras N matérias saem todas diferentes e só repete depois de esgotar.
create or replace function public.pick_subject_color(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with paleta(cor, ord) as (
    values
      ('#75f9a5', 1),  ('#3892f8', 2),  ('#ff90b3', 3),  ('#ffad6b', 4),
      ('#ae67ff', 5),  ('#0bd8b6', 6),  ('#fe2273', 7),  ('#f5f84e', 8),
      ('#5f91bf', 9),  ('#9c3a9f', 10), ('#f85838', 11), ('#86d39b', 12),
      ('#da457c', 13), ('#38134d', 14), ('#771b09', 15), ('#fff9a0', 16)
  ),
  usos as (
    select p.cor, p.ord, count(s.id) as n
    from paleta p
    left join public.subjects s
      on s.user_id = p_user_id and lower(s.color) = p.cor
    group by p.cor, p.ord
  )
  select cor from usos order by n asc, ord asc limit 1;
$$;

comment on function public.pick_subject_color(uuid) is
  'Cor da paleta menos usada pelo usuário — para matérias criadas automaticamente não nascerem todas iguais.';

-- ── 2. activate_catalog_subject passa a informar a cor ───────────────────────
-- Idêntica à versão de 20260802090000_fix_activate_catalog_subject_unaccent,
-- exceto pelo `color` no INSERT.
create or replace function public.activate_catalog_subject(p_catalog_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id    uuid := auth.uid();
  v_subject_id uuid;
  v_pos        integer;
  v_catalog_name text;
  r_parent     record;
  v_new_parent uuid;
  v_existing_child uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select id into v_subject_id
  from subjects
  where user_id = v_user_id and catalog_id = p_catalog_id
  limit 1;

  if v_subject_id is not null then
    update subjects set status = 'ativo'
    where id = v_subject_id and status = 'arquivado';
    return v_subject_id;
  end if;

  select sc.name into v_catalog_name from subjects_catalog sc where sc.id = p_catalog_id;
  if v_catalog_name is null then
    raise exception 'Matéria de catálogo não encontrada: %', p_catalog_id;
  end if;

  select id into v_subject_id
  from subjects
  where user_id = v_user_id
    and catalog_id is null
    and lower(trim(public.immutable_unaccent(name))) = lower(trim(public.immutable_unaccent(v_catalog_name)))
  order by created_at
  limit 1;

  if v_subject_id is not null then
    update subjects set catalog_id = p_catalog_id, status = 'ativo'
    where id = v_subject_id;
  else
    select coalesce(max(position), 0) + 1 into v_pos
    from subjects where user_id = v_user_id;

    -- A única mudança desta migration: cor sorteada em vez do default da coluna.
    insert into subjects (user_id, name, position, catalog_id, status, color)
    values (v_user_id, v_catalog_name, v_pos, p_catalog_id, 'ativo',
            public.pick_subject_color(v_user_id))
    returning id into v_subject_id;
  end if;

  create temp table if not exists _map (catalog_topic_id uuid, new_topic_id uuid) on commit drop;
  truncate _map;

  for r_parent in
    select id, name, position
    from topics_catalog
    where subject_catalog_id = p_catalog_id and parent_id is null
    order by position
  loop
    select t.id into v_existing_child
    from topics t
    where t.subject_id = v_subject_id and t.parent_id is null
      and lower(trim(public.immutable_unaccent(t.name))) = lower(trim(public.immutable_unaccent(r_parent.name)))
    limit 1;

    if v_existing_child is not null then
      update topics set catalog_id = r_parent.id where id = v_existing_child and catalog_id is null;
      v_new_parent := v_existing_child;
    else
      insert into topics (user_id, subject_id, name, position, catalog_id, parent_id)
      values (v_user_id, v_subject_id, r_parent.name, r_parent.position, r_parent.id, null)
      returning id into v_new_parent;
    end if;

    insert into _map values (r_parent.id, v_new_parent);
  end loop;

  insert into topics (user_id, subject_id, name, position, catalog_id, parent_id)
  select v_user_id, v_subject_id, tc.name, tc.position, tc.id, m.new_topic_id
  from topics_catalog tc
  join _map m on m.catalog_topic_id = tc.parent_id
  where tc.subject_catalog_id = p_catalog_id and tc.parent_id is not null
    and not exists (
      select 1 from topics t2
      where t2.subject_id = v_subject_id and t2.parent_id = m.new_topic_id
        and lower(trim(public.immutable_unaccent(t2.name))) = lower(trim(public.immutable_unaccent(tc.name)))
    );

  update topics t3 set catalog_id = tc.id
  from topics_catalog tc
  join _map m on m.catalog_topic_id = tc.parent_id
  where tc.subject_catalog_id = p_catalog_id and tc.parent_id is not null
    and t3.subject_id = v_subject_id and t3.parent_id = m.new_topic_id
    and t3.catalog_id is null
    and lower(trim(public.immutable_unaccent(t3.name))) = lower(trim(public.immutable_unaccent(tc.name)));

  return v_subject_id;
end;
$function$;

-- Regra da auditoria de ago/2026: revogar de PUBLIC, não de anon.
revoke execute on function public.pick_subject_color(uuid) from public;
grant execute on function public.pick_subject_color(uuid) to authenticated;

-- ── 3. Backfill das matérias que já nasceram cinzas ──────────────────────────
-- Distribui a paleta em rodízio por usuário, na ordem em que as matérias
-- aparecem na tela (position, depois criação). Só toca no default '#C9D8C5' —
-- quem escolheu cor à mão fica como está.
with paleta as (
  select cor, ord from (values
    ('#75f9a5', 1),  ('#3892f8', 2),  ('#ff90b3', 3),  ('#ffad6b', 4),
    ('#ae67ff', 5),  ('#0bd8b6', 6),  ('#fe2273', 7),  ('#f5f84e', 8),
    ('#5f91bf', 9),  ('#9c3a9f', 10), ('#f85838', 11), ('#86d39b', 12),
    ('#da457c', 13), ('#38134d', 14), ('#771b09', 15), ('#fff9a0', 16)
  ) as p(cor, ord)
),
alvos as (
  select id,
         row_number() over (partition by user_id order by position, created_at) - 1 as rn
  from public.subjects
  where color is null or lower(color) = '#c9d8c5'
)
update public.subjects s
set color = p.cor
from alvos a
join paleta p on p.ord = (a.rn % 16) + 1
where s.id = a.id;
