-- "Baixar edital" deve apontar para o documento oficial (PDF de abertura),
-- não apenas para a página-portal que lista retificações.
update public.editais_catalog
set edital_url = 'https://dhg1h5j42swfq.cloudfront.net/2022/04/08090621/edital_abertura_policia_militar_do_estado_de_goias.pdf'
where id = 'e0000000-0000-4000-8000-000000000002';
