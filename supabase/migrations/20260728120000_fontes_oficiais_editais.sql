-- Fontes oficiais no módulo Concursos (2ª auditoria, 28/07/2026).
-- Problema: "Baixar edital" do TCE-GO abria blog do Gran Cursos; PM-GO apontava
-- para CDN de blog de cursinho (mirror não-oficial); notícias e estatísticas
-- citavam Gran/Estratégia/Direção com title "Abrir fonte oficial" na UI.
-- Política: link de edital SÓ para órgão ou banca (allowlist com trigger);
-- notícia/estatística sem fonte primária conhecida fica SEM link — a linha
-- da timeline renderiza sem <a> e a tabela sem o ícone de fonte.

-- ── 1. edital_url → fontes oficiais ─────────────────────────────────────────
-- TCE-GO: o edital de Técnico ainda não foi publicado (FCC contratada em
-- 09/06/2026, Contrato nº 14/2026) — não existe PDF para apontar. A página
-- oficial de concursos do órgão é o único destino honesto até o edital sair.
update public.editais_catalog
   set edital_url = 'https://portal.tce.go.gov.br/concursos',
       verificado_em = '2026-07-28'
 where slug = 'tce-go-tecnico-controle-externo';

-- PM-GO 2022: páginas oficiais da SEAD (mesmo padrão goias.gov.br da PC-GO),
-- no lugar do CDN cloudfront de blog de cursinho.
update public.editais_catalog
   set edital_url = 'https://goias.gov.br/administracao/edital-002-2022-concurso-pm-go-soldado/',
       verificado_em = '2026-07-28'
 where slug = 'pm-go-soldado';

update public.editais_catalog
   set edital_url = 'https://goias.gov.br/administracao/edital-003-2022-concurso-pm-go-cadete-e-2o-tenente/',
       verificado_em = '2026-07-28'
 where slug = 'pm-go-oficial';

-- ── 2. Notícias e estatísticas: remove URLs de cursinho ─────────────────────
-- A notícia continua na timeline (o fato foi verificado na curadoria), mas sem
-- link — nunca mandar o usuário para o funil de um concorrente.
update public.edital_updates
   set url = null
 where url ~* '(grancursosonline|estrategiaconcursos|direcaoconcursos)';

update public.edital_concurso_stats
   set fonte_url = null
 where fonte_url ~* '(grancursosonline|estrategiaconcursos|direcaoconcursos)';

-- ── 3. Trava: edital_url só aceita domínio oficial ──────────────────────────
-- Allowlist de sufixos institucionais + domínios de bancas. Evita que uma
-- curadoria futura regrida para link de cursinho sem ninguém notar.
create or replace function public.check_edital_url_oficial()
returns trigger
language plpgsql
as $$
declare
  v_host text;
begin
  if new.edital_url is null then
    return new;
  end if;
  v_host := lower(substring(new.edital_url from '^https?://([^/]+)'));
  if v_host is null then
    raise exception 'edital_url inválida (esperado http/https): %', new.edital_url;
  end if;
  if v_host like '%.gov.br' or v_host like '%.jus.br' or v_host like '%.leg.br'
     or v_host like '%.tc.br' or v_host like '%.fgv.br'
     or v_host in (
       'concursosfcc.com.br', 'www.concursosfcc.com.br',
       'institutoaocp.org.br', 'www.institutoaocp.org.br',
       'cebraspe.org.br', 'www.cebraspe.org.br',
       'vunesp.com.br', 'www.vunesp.com.br',
       'ibfc.org.br', 'www.ibfc.org.br',
       'institutoconsulplan.org.br', 'www.institutoconsulplan.org.br',
       'idecan.org.br', 'www.idecan.org.br'
     ) then
    return new;
  end if;
  raise exception 'edital_url deve ser fonte oficial (órgão ou banca) — domínio rejeitado: %', v_host;
end;
$$;

drop trigger if exists trg_edital_url_oficial on public.editais_catalog;
create trigger trg_edital_url_oficial
  before insert or update of edital_url on public.editais_catalog
  for each row execute function public.check_edital_url_oficial();
