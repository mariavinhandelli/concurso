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
