# Progresso — 2ª análise de UI/UX e visão competitiva

**Data:** 26/07/2026 · Sequência da auditoria de 25/07 (`auditoria-conquistas-performance-jul2026.md`),
escrita **depois** da entrega das Fases 1 e 2 — ou seja, sobre o produto como ele está agora.

---

## 1. O que mudou a régua (Fases 1 + 2, entregues e verificadas)

| Antes | Agora |
|---|---|
| Motor cego: só timer/manual/quick-log contavam | **Toda superfície conta**: fila unificada, flashcards, lei seca, simulados de VM e juris gravam sessão agregada (`passiveSession.service`, 1 linha por sessão concluída, dedupe, teto de 3h, piso de 30s) |
| Conquista sem data, sem momento | **`user_badges` persistida** (RLS, insert-only), data no card ("Conquistada em 26 de jul. de 2026"), backfill silencioso, e a **celebração pós-sessão anuncia o desbloqueio no instante** |
| Maestria incompletável, consistência mentindo | Faixas cumulativas + progresso honesto |
| `/performance` com 5 `useEffect` crus | **React Query nos 5 cards** — cache, dedupe, sem race, invalidação via `HOME_KEYS` |
| recharts no payload inicial | Lazy (−400 KB); `/jurisprudencias/simulados` corrigido em sessão paralela |

Verificação E2E real: simulado de CF/88 no browser → `study_logs` ganhou
`passive-questoes` (104s, 2/2) → `/performance` mostrou "15 sessões" na visita seguinte, sem refresh
manual. O ciclo estudar → medir → celebrar fecha pela primeira vez.

**Nota do módulo: 5,8 → ~7,5.** O que falta para 9+ não é correção — é posicionamento (§3).

---

## 2. Nova análise de UI/UX — o que a tela mostra hoje

Medido ao vivo (desktop 1440 e mobile 375, conta de teste):

### 2.1 `/performance` — funcional, mas ainda é uma pilha, não uma leitura

- **Duas gramáticas de cabeçalho na mesma página.** "Ritmo de estudo" e "Energia × desempenho"
  usam `h2` 16px; "ACERTOS POR MATÉRIA" e "EVOLUÇÃO NAS QUESTÕES" usam eyebrow uppercase 11px.
  Medido: são os dois padrões lado a lado na grade. Unificar na gramática do `h2` (o eyebrow
  uppercase é o clichê que a página de Conquistas já removeu no P0 anterior).
- **Sem período global.** Cada card tem sua janela fixa (30d, 14d, 12 sem). O usuário não pode
  perguntar "e no mês passado?" — a pergunta mais natural de quem acompanha evolução.
- **Sem síntese.** A página não tem uma frase de abertura que diga "o que estes 5 cards significam
  juntos". O Coach semanal — que faz exatamente isso — mora na Home.
- **Gráfico de evolução com poucos dados parece quebrado.** Com 2 pontos reais em 12 semanas
  (honesto, pós-fix do 0%), a área fica ~vazia. Falta um estado "amostra pequena" — uma linha de
  texto ("2 semanas com questões até agora — o gráfico engorda com o tempo") transformaria
  vazio-suspeito em expectativa.
- **Seletor de matérias expõe a bagunça da taxonomia.** Agora só lista matérias com questões (fix
  H9), mas o banco da conta tem "Direito Administrativo" 2× e "Raciocínio Lógico Matemático" vs
  "Raciocínio Lógico-Matemático". Não é bug deste módulo — é dívida do módulo Matérias (merge de
  duplicatas), mas é AQUI que ela fica visível.

### 2.2 `/conquistas` — coleção viva, mas ainda solitária

- A data de desbloqueio dá história ao colecionável. O próximo degrau visual é **raridade** (Steam:
  "12% dos usuários têm esta") — barata de calcular com `user_badges` agregada, e transforma cada
  card em conversa.
- **Compartilhar não existe aqui.** O `ShareProgressCard` (imagem 1080×1350 pronta) segue
  inalcançável da página de Conquistas — o lugar onde o usuário está mais orgulhoso.
- A celebração no instante existe; **push quando fora do app ainda não** (infra LIVE, não usada
  para badges).
- 375px: sem overflow, grade 2×N correta, tabs com `aria-pressed`.

### 2.3 Arquitetura de navegação — a dívida que sobrou

Sidebar "Progresso" ainda tem 4 entradas (Performance, Conquistas, Amigos, Histórico) + a zona
Panorama da Home. A unificação em `/progresso` com 3 abas (proposta §7 da auditoria) continua sendo
a maior alavanca de simplicidade disponível. Agora que os 5 cards compartilham React Query, o custo
de fazê-la caiu — as abas reaproveitam o mesmo cache.

---

## 3. Como ser o melhor e mais interessante do mercado

**A tese:** os concorrentes diretos (QConcursos, TecConcursos, Estudei, Gran) medem *questões
resolvidas na plataforma deles*. A Focali agora mede **o estudo inteiro** — teoria cronometrada,
revisão espaçada, lei seca, jurisprudência, flashcards, simulados — num motor só. Nenhum deles tem
isso, e nenhum consegue copiar rápido porque exige o que a Focali já construiu: SRS próprio, Vade
Mecum próprio, banco de juris próprio e um `study_logs` unificado.

O posicionamento não é "gamificação" (Duolingo genérico envelhece mal em concurso). É:

> **"A Focali sabe se você está pronto."**

Progresso que entende de concurso: peso de edital, banca, retenção real — não pontinhos.

### Os 6 movimentos, em ordem

**M1 — Destino único `/progresso` (Evolução · Conquistas · Histórico).** ✅ **ENTREGUE 26/07** e
verificado ao vivo (desktop + mobile, redirects testados). Detalhes no §5. *Era a base de tudo
abaixo — os próximos movimentos constroem sobre ele.*

**M2 — Conquistas de edital.** ✅ **ENTREGUE 26/07** e verificado ao vivo. Família "Seu edital"
abre a página de Conquistas com até 5 marcos ancorados no alvo primário: *Um quarto do edital* /
*Metade do edital* / *Edital coberto* (cobertura), *Metade dominada* (saúde ≥70 em metade dos
tópicos) e *Prioridade em dia* (matéria de maior peso a 70 de prontidão — só existe quando há
blueprint com pesos). IDs embutem o `targetId`: trocar de concurso começa coleção nova; as antigas
ficam persistidas mas saem da tela. Falha em coverage/raiox não derruba as famílias globais.
Bônus da verificação: ETA acima de 1 ano agora é suprimido (ritmo quase nulo gerava
"~34338 meses no seu ritmo"). **Segue sendo a feature que nenhum concorrente tem.**

**M3 — Curva de retenção.** ✅ **ENTREGUE 27/07** e verificado ao vivo. Infra: tabela
`progress_snapshots` (PK user+date, RLS select-own, escrita SÓ pela função SECURITY DEFINER — nem
authenticated executa) + `take_progress_snapshots()` idempotente + **pg_cron diário 06:10 UTC**
(~03:10 SP) + semente imediata (5 usuários fotografados no primeiro run). Snapshot = saúde média,
tópicos com métrica, dominados (≥70) e cobertura do alvo primário. UI: `RetencaoChart` na Evolução
(lazy, React Query, staleTime 1h) com 2 linhas — saúde média (teal) e cobertura (índigo tracejada)
— e honestidade em camadas: vazio explica como nasce o primeiro ponto; <3 pontos diz "a curva
começou em DD/MM". Nunca fabrica passado. Ponto real verificado no SVG (cy ≈ saúde 23). Anki mostra
retenção por card; **ninguém mostra para um edital inteiro** — agora a Focali mostra.

**M4 — Raridade + share de conquista.** ✅ **ENTREGUE 26/07** e verificado ao vivo. RPC
`get_badge_rarity` (SECURITY DEFINER, só agregados anônimos; badges de edital ficam de fora — o id
é por usuário) → card desbloqueado mostra "em 26 de jul. de 2026 · 14% têm" + botão de share.
`ShareProgressCard` ganhou a variante de conquista (eyebrow "CONQUISTA DESBLOQUEADA", nome do badge
em gradiente com auto-ajuste de corpo, descrição, data, colunas sequência/conquistas/horas). Canvas
verificado pixel a pixel no browser. O card compartilhado é o anúncio orgânico da Focali no grupo de
WhatsApp do concurseiro.

**M5 — Comparação você vs. você.** ✅ **ENTREGUE 26/07** e verificado ao vivo com dados reais nas
duas direções. Deltas no card "Ritmo de estudo" (não um card novo — a página já foi criticada por
pilha): **últimos 30 dias vs. os 30 anteriores** (janelas móveis comparáveis, nunca "26/07 vs.
junho inteiro"), computados dos MESMOS dayTotals já buscados — zero rede extra. Tempo (▼ 8,0h),
dias estudados (▼ 4 dias) e acerto (▲ 33 pp) na conta de teste. Subir é verde; descer é cinza
neutro — informar sem punir. Sem delta quando a janela anterior é vazia ("+2h vs. nada" é ruído).
"Acerto em questões" entrou no lugar de "média por dia estudado" (derivada decorativa).
Cobertura/retenção mês-a-mês ficam para quando houver snapshot histórico (M3) — sem inventar.

**M6 — Narrativa do mês (IA sobre números determinísticos).** 3 frases em segunda pessoa geradas
sobre os agregados que já existem — a IA redige, nunca calcula (mantém a regra do coach). Vira
também o e-mail/push mensal de retenção. *Esforço M, depende de M5.*

### O que NÃO fazer

- **Pontos/XP por minuto estudado** — mata motivação intrínseca (overjustification); a economia de
  recompensas já está desenhada em `focali-coins.md` e é earn-por-marco, pós-paywall. Badges são a
  camada não-monetária; coins escutam os mesmos eventos — nunca premiar o mesmo fato duas vezes.
- **Previsão de aprovação** — o raiox já recusa ETA fabricado; a honestidade é parte da marca.
- **Ranking global público** — turmas/amigos opt-in já cobrem competição saudável sem o efeito
  desmotivador de ver o 1º lugar a 400h de distância.

### Sequência recomendada

M1 → M2 → M4 → M5 → M3 → M6. (M2 antes de M4 porque raridade fica mais interessante quando existem
badges difíceis de verdade; M3 depois de M5 porque a aba Evolução precisa existir estável antes de
ganhar seu gráfico mais ambicioso.)

---

## 4. Correções menores que sobraram desta análise

| # | Item | Esforço |
|---|---|---|
| a | Unificar gramática de cabeçalho dos 5 cards de Evolução (h2 16px) | 30min |
| b | Estado "amostra pequena" no gráfico de evolução (N semanas com dados < 3) | 30min |
| c | Push de conquista desbloqueada quando fora do app (infra LIVE) | 2-3h |
| d | Merge de matérias duplicadas — **módulo Matérias**, mas visível aqui | fora de escopo |
| e | Período global na aba Evolução (30/90/tudo) | 2-3h |

---

## 5. Registro do M1 — entregue em 26/07/2026

**Estrutura.** `app/(app)/progresso/` com `layout.tsx` (PageHeader "Progresso" + SegmentedControl —
padrão de abas reusado de Flashcards/Caderno) e três páginas:

- **Evolução** (`/progresso`): YearHeatmap no topo (saiu de /historico — é o retrato do hábito),
  Ritmo, Raio-X + Cobertura lado a lado, os 4 gráficos (recharts lazy, mesmo padrão anterior),
  TimePie. Instrumenta `performance_viewed`.
- **Conquistas** (`/progresso/conquistas`): página movida na íntegra (git mv preserva histórico),
  sem header próprio — o layout fornece.
- **Histórico** (`/progresso/historico`): lista de sessões com largura de leitura preservada
  (maxWidth 720 dentro do container wide); heatmap saiu daqui.

**Rotas antigas viram redirects** (`/performance` → `/progresso`, `/conquistas` e `/historico` →
abas). Bookmarks, pushes e links externos continuam valendo — testado navegando nas 3.

**Navegação.** Sidebar: grupo Progresso caiu de 4 itens para 2 (Progresso, Amigos), com active
state por prefixo (aba interna mantém o item aceso). CommandPalette atualizado (3 entradas, rotas
novas). Home: prefetch de `/progresso`; links de CoachSemanal e JourneyStats apontam para lá.

**Home/Panorama enxuto.** Cobertura, Raio-X e TimePie moraram para a aba Evolução (os botões
"ver análise completa", que apontariam para a própria página, saíram dos três). O Panorama da Home
ficou com UltimaNota (ação de retomada) + os 4 chips de JourneyStats com "ver progresso completo →".

**Correção de coerência achada na verificação:** `timeByCategory` descartava sessões sem matéria —
na mesma página, o Ritmo contava a sessão passiva e o TimePie dizia "nenhum estudo". Sessões sem
matéria agora formam a fatia "Revisões e treinos" (cinza neutro).

**Verificação:** tsc limpo · 175/175 testes · build de produção com as 3 rotas · desktop e mobile
(375px sem overflow) · redirects reais no browser · sidebar/palette/Home conferidos ao vivo · a
sessão passiva do E2E da Fase 2 aparece no Histórico como "Sessão avulsa · 2 min · 2/2 (100%)".
Nota: em dev o Next mantém uma cópia `display:none` do segmento inativo (cache de rota) — fora da
árvore de acessibilidade, sem efeito para o usuário.
