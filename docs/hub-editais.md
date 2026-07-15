# Hub de Editais — arquitetura e decisões

Entregue em 14/07/2026 (Fases 1+2+3). O catálogo de editais deixa de ser uma
lista atrás de um modal e vira a entidade inteligente central do estudo por
concurso, sem substituir nada do que já existia.

## Princípio

A Focali já tinha dois mundos que continuam valendo:

1. **Catálogo global** (`editais_catalog` + `catalog_areas` + `subjects_catalog`
   / `topics_catalog` + `edital_catalog_subjects` / `edital_catalog_topics` +
   `edital_updates`) — curado server-side, read-only para usuárias.
2. **Concurso pessoal** (`target_exams` + `topic_target_exams` +
   `exam_blueprints`) — a instância de estudo, criada pela RPC
   `activate_catalog_edital` ou por importação (texto/PDF).

O Hub de Editais **estende o mundo 1** e melhora a ponte para o mundo 2.
Regra de dados inegociável: onde não há dado real curado, a UI não mostra
nada (nunca inventa nota de corte, incidência ou estatística).

## Novas entidades (migração `20260714150000_hub_editais.sql`)

| Objeto | O que é |
|---|---|
| `editais_catalog.uf` | UF do órgão (null = nacional). Alimenta o filtro "Estado". |
| `editais_catalog.concurso_key` | Agrupa edições do mesmo concurso (default = slug). Base de edições anteriores, histórico e provas. |
| `edital_updates.changes` (jsonb) | Diff curado de retificação: `{campos: [{campo, antes, depois}], conteudo: [{disciplina, adicionados[], removidos[]}]}`. Renderiza o antes/depois visual na linha do tempo. |
| `edital_catalog_topics.incidencia` | Nº de cobranças do tópico em provas reais (curado). Copiado para `topic_target_exams.incidencia` na ativação. |
| `edital_concurso_stats` | Por `concurso_key` + ano: inscritos, vagas, nota de corte, nomeados, fonte. RLS: SELECT p/ authenticated. |
| `edital_past_papers` | Provas anteriores por `concurso_key`: links oficiais de prova/gabarito. RLS: SELECT p/ authenticated. |
| `activate_catalog_edital` v3 | Mesmo contrato; agora também copia a incidência curada para o vínculo da usuária. |

Decisões:
- **Edições = linhas do catálogo** agrupadas por `concurso_key` (sem tabela de
  versão). Edições antigas podem viver com `is_active = false`: somem da lista
  principal, continuam no histórico e no comparador.
- **Retificação com diff curado** em vez de versionamento completo do edital:
  o custo de curadoria é uma linha JSON e cobre 100% do valor visível
  ("o que mudou?"), sem duplicar o conteúdo programático inteiro.
- **Comparador calcula no cliente** (`compareEditais` em
  `services/editaisCatalog.service.ts`) a partir do conteúdo programático dos
  dois editais — catálogo pequeno, zero infra nova.

## Organização por órgão (14/07/2026)

A hierarquia do catálogo é **órgão → cargos (editais) → especificações**:

- **`orgaos_catalog`** (migração `20260714180000_orgaos_catalog.sql`): slug,
  sigla, nome, uf, esfera (estadual/federal/municipal), poder
  (executivo/judiciario/legislativo/controle), site_url, descricao. RLS
  SELECT p/ authenticated. `editais_catalog.orgao_id` é a FK (o campo `orgao`
  texto continua para exibição).
- **`/editais/orgao/[slug]`** — página do órgão: ficha institucional + lista
  de editais por cargo (`EditalCard` compartilhado, com `hideOrgao`).
- **Banco de editais** agrupado por órgão: header do grupo (sigla + nome +
  contagem de cargos) navega para a página do órgão; busca/filtros cortam os
  grupos transversalmente.
- **`/editais/[slug]`** ganhou chip do órgão no header e seção "Outros cargos
  deste órgão".

Órgãos e editais curados em 14/07/2026 (fontes: Gran Cursos, Estratégia,
FGV Conhecimento, TJGO — fatos com data verificada em ≥2 fontes):

- **PM-GO**: Soldado e Oficial/CFO (última edição 2022, Instituto AOCP;
  novo edital em discussão p/ 2026; ASSOF pediu 180 vagas de Oficial em
  20/03/2025; remunerações atuais jun/2025).
- **PC-GO**: Agente (450), Escrivão (310), Papiloscopista (60) e Delegado
  (44) — última edição 2022 (Instituto AOCP, 864 vagas, 799 nomeados em
  2024, registrados em `edital_concurso_stats`); delegado-geral indicou novos
  trâmites só em 2027/2028.
- **TJ-GO**: Juiz Substituto (59º concurso, VIGENTE: Edital 01/2025 FGV, 51
  vagas, subsídio R$ 34.083,41, prova objetiva 29/03/2026, retificação
  12/01/2026 — na linha do tempo com PDF oficial) e Analista Judiciário
  (autorizado 18/06/2025, banca a definir).
- **TCE-GO**: Técnico de Controle Externo (FCC contratada 09/06/2026,
  Contrato 14/2026, 16 vagas nível médio — Administrativo 6 + TI 10).

Todos os 6 editais novos entram **sem conteúdo programático** (cards mostram
"grade em preparação"; ativação desabilitada até a curadoria da grade —
mesma regra honesta de sempre).

## Grades curadas + Seguir concurso (15/07/2026)

**Grades da PC-GO** (migração `20260715090000_pc_go_grades.sql`): os 4 cargos
ganharam conteúdo programático com a distribuição REAL de questões da prova
AOCP 2022 (Agente/Escrivão 80q idênticas, Papiloscopista 80q própria,
Delegado 100q — fontes: Nova Concursos, Estratégia, Gran; somas conferem).
Reusa as matérias existentes do catálogo; 7 disciplinas novas criadas
(Legislação Estadual—GO com 3 tópicos; Papiloscopia, Arquivologia,
Química/Física/Biologia, Eleitoral, Ambiental, Empresarial sem tópicos — a
usuária completa no Montar Edital). Tópicos: vinculados todos os da matéria
(granularidade da biblioteca Focali; refinável ao ativar). No Delegado,
Criminologia+Med.Legal e Civil+Empresarial dividem 5 questões cada no edital
→ entram sem nº fixo (`num_questions_expected null`). Editais oficiais
(SEAD-GO 006/2022 e 008/2022) em `edital_url`; provas/gabaritos AOCP em
`edital_past_papers` (Qconcursos). Com isso os 4 cargos ficaram ATIVÁVEIS.

**Selo de verificação**: `editais_catalog.verificado_em` (date) — a ficha
mostra "Informações verificadas em DD/MM/AAAA". Atualizar a cada rodada de
curadoria.

**Seguir concurso + push** (migração `20260715100000_edital_follows.sql` +
Edge Function `notify-edital-updates`, cron horário `15 * * * *`):
- `edital_follows` (user × edital, RLS own) = seguidor explícito; quem ativou
  o concurso é seguidor implícito (união feita na function).
- `edital_updates.notified_at` controla envio único; updates pré-existentes
  nasceram "notificados" (sem spam retroativo). Curadoria nova → push
  automático na próxima hora com deep-link para `/editais/[slug]`.
- Botão "Acompanhar novidades" na página do edital (some quando o concurso já
  foi ativado — vira o hint "Acompanhando"). Eventos: `edital_followed` /
  `edital_unfollowed`.
- Smoke test em produção: 200 OK `{"notified":0,"sent":0,"cleaned":0}`.

## Hub público + SEO (15/07/2026)

`/editais/**` é PÚBLICO (canal de aquisição do plano de 90 dias):

- **proxy.ts**: `/editais`, `/editais/[slug]` e `/editais/orgao/[slug]` entram
  em `isPublicPage`; `sitemap.xml`/`robots.txt` saíram do matcher.
- **RLS** (migração `20260715110000_editais_public_read.sql`): SELECT para
  `anon` nas 10 tabelas de catálogo (políticas aditivas — as de
  `authenticated` seguem intactas). Só informação pública curada; ações
  (ativar, seguir, importar) gateiam por sessão dentro das páginas com
  redirect `login?returnTo=`.
- **/editais** deixou de ser redirect: é uma página real que reusa o
  `BancoEditaisTab` (mesma UI da aba em /targets).
- **SEO**: layouts server-side com `generateMetadata` por edital ("Concurso
  PC-GO — Agente de Polícia | Focali") e por órgão; `app/sitemap.ts` (revalida
  1×/dia, lista editais+órgãos do catálogo via anon key) e `app/robots.ts`
  (allow só páginas públicas). `metadataBase` já existia no root layout
  (www.focali.com.br).
- Verificado como anônimo no browser: listagem, página de edital (grade,
  histórico, provas, selo de verificação) e página de órgão renderizam; título
  SEO confirmado no HTML servido; sitemap com 16 URLs; robots ok. Bug achado e
  corrigido no processo: o proxy redirecionava sitemap.xml/robots.txt p/ login.

## Ativação parcial + vínculo de importações (15/07/2026)

- **Ativar sem grade**: editais com `subjectCount === 0` (TJ-GO Juiz/Analista,
  TCE-GO) deixaram de ser beco sem saída — o botão "Ativar edital" funciona e
  cria o concurso só com a ficha (a RPC já suportava zero matérias). A página
  avisa que a grade está em curadoria e orienta: montar no "Montar edital" ou
  importar o PDF. Toast pós-ativação orienta o próximo passo.
- **Importação vinculada ao catálogo**: `createTargetExam`/`importEditalAsTarget`
  aceitam `catalog_edital_id`. Nos modais de importação, qualquer match com o
  banco vincula o concurso importado ao catálogo (ficha + linha do tempo +
  push de novidades) SEM perder a grade importada. Match sem grade mostra o
  banner informativo (vínculo automático); match com grade mantém o CTA de
  ativação 1-clique. `matchCatalogEdital` não exclui mais editais sem grade.

## Grade TJ-GO Juiz + acordeão persistente (15/07/2026)

- **TJ-GO Juiz Substituto** (migração `20260715130000_tj_go_juiz_grade.sql`):
  15 disciplinas na ordem dos blocos da Res. CNJ 75 (Bloco I 40q: Civil,
  Proc. Civil, Consumidor, ECA; Bloco II 30q: Penal, Proc. Penal,
  Constitucional, Eleitoral; Bloco III 30q: Empresarial, Tributário,
  Financeiro, Ambiental, Administrativo, Formação Humanística, D. Humanos).
  O edital NÃO fixa questões por disciplina → `num_questions_expected null`
  ("sem questões fixas" na UI) e pesos 1–5 curados por bloco; o aviso explica.
  3 disciplinas novas no catálogo (Consumidor, ECA, Formação Humanística, sem
  tópicos); 261 tópicos vinculados das disciplinas já curadas.
  TJ-GO Analista segue sem grade (banca a definir — nada a curar ainda).
- **Acordeão persistente**: o estado aberto/fechado dos grupos de órgão do
  Banco persiste em localStorage (`editais_grupos_abertos`, CSV via
  `usePersistedState`). Busca/filtros continuam forçando tudo aberto.

## Curadoria refinada (15/07/2026 — migração `20260715140000`)

- **76 tópicos novos** ("linha mestra" real de cada disciplina, mesma
  granularidade do resto do topics_catalog): Consumidor (12), ECA (11),
  Eleitoral (12), Ambiental (10), Empresarial (10), Formação Humanística (5 —
  eixos exatos da Res. CNJ 75), Técnicas de Identificação (8), Arquivologia
  (8). Religados aos editais: TJ-GO Juiz 261→321 tópicos, Papiloscopista
  268→284. Química/Física/Biologia segue sem tópicos (escopo depende do texto
  do edital — não inventamos).
- **Histórico enriquecido**: inscritos REAIS de 2022 por cargo da PC-GO
  (Agente 55.029, Escrivão 38.584, Papiloscopista 11.980, Delegado 17.294 —
  fonte MaxiEduca/AOCP) e notas de corte REAIS de 2016 (Agente 47,3 e
  Escrivão 48,27 de 90 pts — fonte Direção Concursos). Nota de corte de 2022
  não foi publicada pelos portais → permanece vazia.

## Auditoria de dados + health check de URLs (15/07/2026)

Migrações `20260715160000` e `20260715170000`. Preenchido com fonte verificada:
inscritos 2022 da PM-GO (Soldado 52.746, Cadete 9.935 — Direção) e do TJ-GO
Juiz (5.111 — Magistrar/TJGO); provas anteriores da PM-GO (Soldado e
Aspirante/CFO, prova+gabarito) e do TJ-GO Juiz 2026; gabaritos do Agente e
Papiloscopista; resultado definitivo da objetiva do Juiz na linha do tempo
(PDF FGV, 11/05/2026); aviso do TCE-GO atualizado ao Contrato 14/2026 (a
remuneração diverge entre fontes — R$ 5,1 mil base vs R$ 11,4–12,4 mil com
gratificações — então vive no aviso, nunca no campo numérico).

Double-check executado: **27 URLs do catálogo testadas via HTTP — todas as
finais retornam 200** (páginas HTML do Qconcursos davam 403 anti-bot e foram
trocadas por PDFs diretos de arquivos.qconcursos.com). Falso-alarme
investigado e refutado: a remuneração do Soldado PM-GO (R$ 6.353,13) é
correta — Goiás alinhou os iniciais de PC/PM em 2022 (Direção).

Lacunas HONESTAS que permanecem (dado não publicado de forma verificável):
nota de corte 2022 da PC-GO e 2026 do TJ-GO Juiz; prova do Escrivão PC-GO
(conteúdo era idêntico à de Agente); remuneração numérica do TCE-GO (sai no
edital); ficha do TJ-GO Analista (banca a definir).

## Superfícies

- **`/editais/[slug]`** (`app/(app)/editais/[slug]/page.tsx`) — Dashboard do
  Edital. Substitui o `EditalDetailModal` (deletado): ficha, disciplinas e
  pesos com barra de participação na prova, linha do tempo com diff de
  retificação (`EditalTimeline`), comparador de edições/editais
  (`EditalComparador`), edições anteriores, histórico do concurso e provas
  anteriores (`EditalHistorico`), download do PDF, ativação em 1 clique e o
  progresso da usuária quando o edital já está ativado. Âncoras: `#disciplinas`,
  `#timeline`, `#comparar`, `#historico`, `#provas`.
- **`/editais`** — redireciona para `/targets` (decisão de navegação: o acesso
  principal continua pela aba "Banco de editais").
- **Banco de editais** (`BancoEditaisTab`) — ganhou busca textual
  (órgão/cargo/banca) e filtros avançados no padrão da `JurisFilterBar`
  (banca, UF, escolaridade, situação) além dos chips de área. Cards navegam
  para a página do edital.
- **Hub do concurso** — o checklist pré-edital destravou os itens "em breve"
  (comparar editais, mapa de incidência, estilo da banca) quando o concurso
  tem `catalog_edital_id`; o card "Sobre o concurso" linka para a página do
  edital; o Verticalizado mostra a badge "N× em provas" quando há incidência
  curada.
- **Command Palette** — grupo "Editais" pesquisável; páginas de edital entram
  nos Recentes (`RecentKind 'edital'`).

## Instrumentação

Eventos novos no `EV` (`lib/analytics.ts`): `edital_viewed`,
`edital_activated`, `edital_compared`, `edital_pdf_downloaded`,
`past_paper_opened`.

## Como curar dados novos (admin, via SQL no projeto Supabase)

- Nova edição de um concurso: inserir linha em `editais_catalog` com o mesmo
  `concurso_key` (a antiga pode ficar `is_active = false`).
- Retificação com diff: `update edital_updates set changes = '{"campos": [...]}'::jsonb where id = ...`.
- Nota de corte/nomeações: inserir em `edital_concurso_stats`.
- Prova anterior: inserir em `edital_past_papers` (link oficial).
- Incidência: `update edital_catalog_topics set incidencia = N where ...`
  (só com dado real de banca; usuárias que reativarem/ativarem herdam).

## Fase 3 (entregue)

- **Match de importação ↔ catálogo**: `matchCatalogEdital()` (pura, em
  `editaisCatalog.service.ts`) casa órgão+cargo normalizados — conservadora:
  exige órgão idêntico e cargo compatível, e ignora editais sem conteúdo.
  Os dois modais de importação (`ImportarEditalModal`,
  `ImportarEditalPdfModal`) mostram um banner "Este concurso já está no Banco
  de Editais" com ativação em 1 clique, reativo às edições de órgão/cargo.
  Eventos: `edital_activated` com `via: 'import_pdf_match' | 'import_paste_match'`.
- **Lei seca escopada pelo edital**: `leiDisciplinaForSubject()` em
  `leis.service.ts` mapeia nome de matéria → `LeiMeta.disciplina` (taxonomias
  diferem); o Vade Mecum aceita `?disciplina=` (Suspense + useSearchParams,
  padrão da lista de juris); o hub do concurso ("Vade Mecum" e "Revisar a lei
  seca") navega já filtrado pela disciplina de maior volume do edital — mesmo
  racional do `topDisciplina` das jurisprudências.
- A ligação juris/leis ↔ edital segue por **string de disciplina normalizada**
  (decisão consciente: criar FKs exigiria re-taxonomizar dois módulos estáveis;
  os mapeadores `normalizeDisciplina` e `leiDisciplinaForSubject` isolam essa
  costura em dois pontos únicos).
