-- Curadoria: a linha do tempo do PM-GO Oficial exibia DUAS notícias da ASSOF em
-- 20/03/2025 — "ASSOF solicita novo edital com 180 vagas para Oficial" (seed
-- 20260705185248) e "ASSOF solicita, em caráter de urgência, 180 vagas para
-- Oficial em novo edital" (lote comum de 20260705185843). edital_updates não tem
-- constraint de unicidade, então os dois "on conflict do nothing" nunca colidiram.
-- Mantém o título mais específico; achado na passada ao vivo de 02/08/2026.
-- (Idempotente: apaga por título+data, não por id.)
delete from public.edital_updates
where titulo = 'ASSOF solicita novo edital com 180 vagas para Oficial'
  and published_at = '2025-03-20';
