-- Preserva a única linha legada de exam_targets ("CFO PMGO", 2027-06-10) como um
-- target_exam separado antes de remover a tabela antiga. Banca desconhecida (board_id null).
insert into target_exams (user_id, board_id, orgao, cargo, ano_alvo, exam_date, phase, is_primary, slug)
select
  et.user_id,
  null,
  'PMGO',
  'CFO',
  extract(year from et.exam_date)::int,
  et.exam_date,
  'pre',
  false,
  'pmgo-cfo'
from exam_targets et
where not exists (
  select 1 from target_exams te where te.user_id = et.user_id and te.slug = 'pmgo-cfo'
);

drop table if exists exam_targets;
