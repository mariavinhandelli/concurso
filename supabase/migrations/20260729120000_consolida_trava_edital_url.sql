-- Duas sessões paralelas criaram travas concorrentes para edital_url no mesmo
-- dia: o trigger trg_edital_url_oficial (20260728120000) e o CHECK
-- editais_catalog_edital_url_official_ck (20260729014225). Conviver com as
-- duas não é redundância inofensiva — a allowlist do trigger é MAIS ESTREITA,
-- então ela vence e rejeita domínios de banca que o CHECK aceita. Verificado:
-- um update para https://aocp.com.br/... (banca real de PC-GO e PM-GO) era
-- barrado pelo trigger.
-- Fica o CHECK: allowlist mais completa, declarativo, validado no ALTER TABLE.
drop trigger if exists trg_edital_url_oficial on public.editais_catalog;
drop function if exists public.check_edital_url_oficial();
