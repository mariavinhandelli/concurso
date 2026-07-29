-- Mesma corrida de migrations do reparo anterior: fontes_oficiais_editais
-- (outra sessão) já tinha trocado edital_url do cloudfront pela página da
-- SEAD antes de editais_official_sources_only rodar, então a condição
-- "and edital_url = '...cloudfront...'" não bateu e o PDF direto (o que o
-- item 2 da tarefa pediu) nunca foi gravado. Corrige por slug.
update public.editais_catalog
set edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/04/171122-EdPM002Retificado-61c.pdf'
where slug = 'pm-go-soldado';

update public.editais_catalog
set edital_url = 'https://goias.gov.br/administracao/wp-content/uploads/sites/27/2022/04/171122-EdPM003Retificado-ade.pdf'
where slug = 'pm-go-oficial';
