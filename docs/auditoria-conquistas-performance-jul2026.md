# Auditoria — Conquistas e Performance

**Data:** 25/07/2026 · **Escopo:** `/conquistas`, `/performance` e todo o tecido de progresso que os alimenta.

**Método:** engenharia reversa do código (páginas, componentes, hooks, 14 services), inspeção do banco
de produção (schema, RPCs, volumetria real, tabela `events`), build de produção para medir chunks.

> **STATUS — 25/07/2026, atualizado após a verificação ao vivo:** a Fase 1 (Quick Wins) foi
> **implementada e verificada**. Ver §12 no fim do documento para o registro do que mudou e como foi
> conferido. As Fases 2 e 3 seguem como proposta — mexem em modelo de dados e arquitetura, e aguardam
> decisão.

**Verificação ao vivo:** feita com sessão autenticada (conta de teste, 14 sessões / 191 questões /
8,0h). Os achados abaixo foram confirmados na tela e no banco, salvo onde indicado.

---

## 1. Sumário executivo

O módulo está **bem construído e mal posicionado**. O código é limpo, comentado com intenção, com
decisões de produto explícitas (limiares de amostra, perdão de streak, ETA honesto, recusa deliberada
de IA no coach). Não é um módulo descuidado — é um módulo que resolve o problema errado.

**O diagnóstico em uma frase:** Conquistas e Performance medem *um* dos seis jeitos de estudar na
Focali, não celebram nada no instante em que acontece, e vivem em dois endereços que o usuário só
visita quando lembra que existem.

Três problemas estruturais explicam quase todos os sintomas:

**1. O motor é cego.** `study_logs` — a única fonte de Conquistas e Performance — é escrito por
exatamente três lugares: o timer, o registro manual e o quick-log. Vade Mecum, simulados de
jurisprudência, flashcards e a fila de revisões **não geram nenhum registro**. Um usuário que passou o
mês no Vade Mecum e nos flashcards tem 0% em todas as 14 conquistas e uma página de Performance vazia.
O produto diz "Volume — questões resolvidas ao longo da jornada" e conta apenas as questões que a
pessoa *digitou num formulário*.

**2. Não existe o momento da conquista.** Não há tabela de badges. Nada é persistido, nada tem data,
nada notifica. O badge é recalculado do zero a cada visita, e o "novo" é um `localStorage` por
dispositivo. Somado a isso, `refreshHomeAfterSession` não invalida a query `badge-state`: a sessão que
desbloqueia a conquista deixa a página servindo cache velho por até 5 minutos. O único instante em que
uma conquista poderia significar algo — o segundo seguinte ao esforço — é o único em que ela não
aparece.

**3. "Progresso" está espalhado em quatro endereços.** Home (zona Panorama), `/performance`,
`/conquistas` e `/historico` respondem à mesma pergunta com métricas repetidas e às vezes
divergentes. Enquanto isso, os dois melhores artefatos do produto inteiro — o **heatmap anual** e o
**Coach semanal** — estão fora de ambas as páginas de progresso.

**Nota do módulo: 5,8/10.** Engenharia 7,5 · Dados 4,0 · UX 6,0 · Gamificação 4,5 · Integração 3,5.

O caminho para "referência de mercado" não passa por adicionar gráficos. Passa por **fazer o motor
enxergar tudo**, **devolver a conquista ao instante em que ela acontece** e **unificar os quatro
endereços em um**. Isso é a Fase 1 abaixo e vale mais que todas as features novas somadas.

---

## 2. O que existe hoje

### 2.1 `/conquistas` — 571 linhas, 1 query, 14 badges derivados ao vivo

| | |
|---|---|
| **Objetivo** | Coleção de marcos acumulados ("estoque") — reconhecer esforço de longo prazo |
| **Fluxo** | `useQuery(['badge-state'])` → `getBadgeState()` → pagina `study_logs` inteiro + `getStreak()` → deriva 14 badges em memória → agrupa em 4 famílias |
| **Famílias** | Volume (100/500/2k/6k questões) · Tempo (50/200/500/1000h) · Maestria (bronze/prata/ouro) · Consistência (7/30/100 dias) |
| **Vale manter?** | Sim — o conceito está certo e as metas são bem calibradas para concurso |
| **Vale melhorar?** | Sim, profundamente: persistência, celebração, escopo do motor |
| **Duplicado?** | Parcialmente — Consistência duplica o StreakBar da Home |
| **Absorvível?** | Sim — deve virar uma aba de um destino único de Progresso |

**Pontos fortes reais:** metas ancoradas em referências do mercado (6k questões = federal, 100 dias =
Duolingo), ETA calculado a partir do ritmo real dos últimos 30 dias, uma única passagem paginada
calculando estatística e ritmo juntos (comentário `QW6`), animações em `scaleX` na GPU,
`prefers-reduced-motion` respeitado globalmente, escala tipográfica de 6 degraus documentada no topo
do arquivo.

### 2.2 `/performance` — 51 linhas, 5 cards independentes

| Card | Serviço | Pergunta que responde |
|---|---|---|
| ConstanciaResumo | `getConstanciaResumo(30)` | Quanto estudei em 30 dias e no total? |
| StudyTimeChart | `getTimeSeries(g)` | Minha curva de tempo vs. minha meta |
| AccuracyChart | `getAccuracyBySubject()` | Qual matéria vai mal? |
| AccuracyEvolutionChart | `getAccuracyEvolution(subj)` | Meu acerto está subindo? |
| EnergiaDesempenho | `getEnergiaDesempenho()` | Rendo mais com energia alta? |

**Ponto forte:** `PerfInsight` — o rodapé que transforma gráfico em frase acionável com CTA. É o
padrão certo, e só 2 dos 5 cards o usam.

**Ponto fraco estrutural:** a página é uma grade de cinco componentes que não conversam. Não há
seletor de período no nível da página, não há comparação temporal, não há síntese. É um dashboard de
ferramenta, não a leitura de um treinador.

### 2.3 O que alimenta os dois

```
study_logs  ←── FloatingTimer · ManualLogModal · QuickLogModal   (só estes 3)
    │
    ├─ get_study_day_totals (RPC agregada)  → streak · goals · YearHeatmap
    ├─ badges.service        (pagina tudo)  → /conquistas
    ├─ performance.service   (pagina tudo)  → ConstanciaResumo · EnergiaDesempenho
    ├─ timeReports · accuracyReports · accuracyEvolution → os 3 gráficos
    ├─ journey · coverage · raiox · coach   → Home
    └─ missoes.service       (fluxo semanal) → SemanaPanel
```

**Não escrevem em `study_logs`:** revisões (`/revisar`), flashcards, Vade Mecum
(`lei_questao_respostas`), simulados de lei, simulados e interações de jurisprudência.

---

## 3. Achados

Severidade: 🔴 crítico · 🟠 alto · 🟡 médio · 🟢 baixo

### 🔴 C1 — O motor de progresso é cego a 4 das 6 superfícies de estudo

`saveStudyLog` tem três call-sites (`FloatingTimer.tsx:76`, `ManualLogModal.tsx:139`,
`QuickLogModal.tsx:141`). Nenhum outro módulo grava sessão. O enum `log_mode` no banco tem
`leitura_lei`, `jurisprudencia` e `flashcards` — modos que **só existem se o usuário lembrar de
cronometrar manualmente**.

Consequência: a plataforma tem quatro bancos de questões e nenhum deles conta para as conquistas.
Um heavy user de Vade Mecum vê "0 / 14 conquistadas · Comece sua coleção".

**Impacto:** máximo. É a diferença entre um sistema de progresso e um cronômetro com medalhas.

### 🔴 C2 — Maestria é matematicamente incompletável pelo melhor aluno

`badges.service.ts:137-142`:

```ts
if (pct >= 90)      questoesOuro   += q;
else if (pct >= 80) questoesPrata  += q;
else if (pct >= 70) questoesBronze += q;
```

As faixas são **mutuamente exclusivas por sessão**. Quem acerta consistentemente 90%+ acumula
*apenas* `questoesOuro`. Bronze (300 questões) e Prata (200) ficam travadas para sempre.

Dois efeitos perversos:
- "Coleção completa. Conquista máxima." é **inalcançável exatamente para quem estuda melhor**.
- O painel "Próximas conquistas" ordena por progresso e vai empurrar esse aluno para Bronze e Prata —
  metas que ele só atinge **piorando o desempenho**.

**Impacto:** máximo. Um sistema de maestria que pune a maestria.

### 🔴 C3 — Nenhuma conquista é persistida

Não existe tabela de badges no banco (confirmado: 53 tabelas, nenhuma de achievements). Tudo é
derivado a cada carga. Isso elimina, de uma vez:

- data de desbloqueio ("conquistada em 14/07") — o item colecionável não tem história;
- notificação de desbloqueio (o web push já existe e está LIVE, e não é usado aqui);
- qualquer prova social (amigos/turmas não veem badges);
- estabilidade — mudar uma meta em `VOLUME_TARGETS` **revoga silenciosamente** conquistas já exibidas.

O "novo" é `localStorage['conquistas:seen_ids']` (`page.tsx:82-91`): limpar o cache marca tudo como
novo de novo; desbloquear no celular e abrir no desktop nunca sinaliza nada.

### 🔴 C4 — O momento da conquista é engolido pelo cache

`lib/home-refresh.ts` invalida 19 query keys após salvar uma sessão. `['badge-state']` não está entre
elas — nem `['study-day-totals-heatmap']`.

Resultado: a sessão que desbloqueia a conquista deixa `/conquistas` servindo dado velho por até 5
minutos (`staleTime: 5 * 60_000`), e o heatmap sem acender o quadradinho de hoje. O único instante em
que a recompensa importa é o único em que ela não aparece.

Agrava: `SessionCelebration` já existe e roda no momento certo — e não menciona conquistas.

### 🔴 C5 — O progresso de Consistência mente para o usuário

`badges.service.ts:238-253` usa `longest` (recorde histórico) como base do progresso das conquistas
ainda trancadas.

Cenário real: usuário teve 25 dias seguidos em janeiro, hoje está com streak 0. O card "30 dias
seguidos" mostra **83% · faltam 5 dias**. A verdade é que ele precisa de 30 dias consecutivos a
partir de hoje. É uma promessa que o produto não pode cumprir, no lugar mais sensível possível.

### 🟠 H1 — Zero instrumentação: o módulo que mede progresso não se mede

`lib/analytics.ts` define 20 eventos. Nenhum é de conquista ou de performance. Confirmado no banco: a
tabela `events` tem 1.162 linhas e **zero** relacionadas a estes módulos.

Efeito prático: a pergunta "nível de utilização" desta auditoria **não tem resposta**, e não terá até
que se instrumente. Nenhuma decisão de cortar ou investir aqui pode ser tomada com dado.

### 🟠 H2 — Duas definições de "questão" convivem no produto

- `badges.service.ts:132-136` soma `questions_total` de **todos** os modos.
- `accuracyReports.service.ts:26` e `accuracyEvolution.service.ts:56` filtram `mode = 'questoes'`.

Uma sessão de teoria com 20 questões registradas conta para a conquista de Volume e **não** conta no
gráfico de acerto. Conquistas e Performance mostram números diferentes para a mesma coisa.

### 🟠 H3 — O gráfico de evolução desenha 0% em semanas sem questões

`accuracyEvolution.service.ts:88`: `pct: total === 0 ? 0 : ...`. O comentário admite a escolha
("mantemos o ponto com pct 0 para a linha do tempo ser contínua"), mas com `<Area>` preenchida abaixo
da linha, três semanas de teoria pura viram um **mergulho visual de 78% para 0%**.

O usuário lê "meu desempenho desabou". O correto para série temporal com lacuna é `null` + `connectNulls`.

### 🟠 H4 — "Reforçar X" pode ser disparado por uma única questão errada

`getAccuracyBySubject` não tem amostra mínima. Uma matéria com 1 questão e 0 acertos vai para o topo
da lista (ordenada por pct asc) e vira o insight principal: *"**X** é sua menor taxa (0%). Reforçar
aqui rende mais que praticar o que você já domina."*

O padrão certo já existe no repo — `metrics.service.ts:9` define `MIN_QUESTOES_CONFIAVEL = 30` com o
comentário "<30 questões → margem de erro estatística alta (±16%)". Não foi aplicado aqui.

### 🟠 H5 — `/performance` carrega recharts estaticamente; a Home não

O chunk com recharts mede **285 KB** não comprimido no build de produção. `/performance` importa três
componentes que o importam de forma estática. `TimePieCard.tsx:14` faz o oposto, com o comentário:
*"Recharts (~200 KB) carregado sob demanda — fora do bundle inicial da Home."*

A otimização foi feita na Home e não replicada na página que mais depende da biblioteca.

### 🟠 H6 — Nenhum card de `/performance` usa React Query

Os cinco usam `useEffect` + `useState` cru. Consequências:

- **Sem cache:** sair e voltar refaz as cinco cargas inteiras.
- **Sem dedupe** com as queries que a Home já fez.
- **Sem invalidação:** `refreshHomeAfterSession` não os alcança.
- **Race condition real:** em `StudyTimeChart` (troca de granularidade) e `AccuracyEvolutionChart`
  (troca de matéria), não há flag de cancelamento — uma resposta lenta anterior sobrescreve a mais
  recente. Trocar rápido entre Dia/Semana/Mês pode deixar o gráfico com dados do filtro errado. 🔬

### 🟠 H7 — Uma carga de `/performance` faz 5 leituras de `study_logs` e 5 `getUser()` de rede

`performance.service` (×2), `timeReports`, `accuracyReports`, `accuracyEvolution` chamam
`supabase.auth.getUser()` direto — que bate na rede e é serializado por `navigator.locks`. O
`lib/supabase/authCache.ts` existe exatamente para isso e não é usado por nenhum deles.

Pior: `getConstanciaResumo` **pagina o histórico inteiro** de `study_logs` só para somar horas e
sessões, enquanto a RPC `get_study_day_totals` já devolve `seconds`, `questions` e `correct` por dia,
agregados no servidor. O mesmo vale para as famílias Volume/Tempo/Consistência das conquistas.

### 🟠 H8 — "Próximas conquistas" mostra as três metas erradas para quem mais precisa

`page.tsx:116-121` ordena os trancados por `progress` desc e corta em 3. Usuário novo tem tudo em 0 —
o sort é estável e devolve a ordem do array: **100 questões, 500 questões, 2.000 questões**. Três
metas da mesma família, todas em zero, a última exigindo meses.

A vitória real da primeira semana — "7 dias seguidos" — não aparece. Falta desempate e falta
diversidade de família.

### 🟠 H9 — `listSubjectsWithQuestions()` não faz o que o nome diz

`accuracyEvolution.service.ts:29-37` seleciona **todas** as matérias, sem filtro de usuário (depende
de RLS) e sem filtro de "tem questões". O seletor oferece matérias que garantidamente levam a "Sem
questões registradas ainda neste recorte" — becos sem saída no filtro.

### 🟠 H10 — Cores de tier falham contraste AA no tema claro

`page.tsx:29-33` — hex cravados, fora do sistema de tokens:

| Tier | Hex | Contraste sobre card branco | AA (4,5:1) |
|---|---|---|---|
| Ouro | `#C9A227` | ~2,4:1 | ❌ |
| Prata | `#8C97A1` | ~2,9:1 | ❌ |
| Bronze | `#A9744F` | ~3,4:1 | ❌ |

São usados em texto de 13px (o pill "Conquistada") e no ícone. Por serem hex fixos, também não se
adaptam ao dark mode nem às paletas alternativas (rose/menta/grafite) que já foram corrigidas nos
tokens em 21/07. 🔬

### 🟡 Médios

| # | Achado |
|---|---|
| M1 | **Quatro endereços para "meu progresso"**: Home/Panorama, `/performance`, `/conquistas`, `/historico`. Horas totais aparecem em JourneyStats *e* em ConstanciaResumo; streak aparece em StreakBar, ConstanciaResumo e na família Consistência. |
| M2 | **YearHeatmap está em `/historico`.** É o melhor artefato de identidade do produto (o retrato de quem a pessoa está se tornando) e não está em nenhuma das duas páginas de progresso. |
| M3 | **Coach semanal fora de Performance.** `coach.service` sintetiza energia, causa de erro, tópicos negligenciados e foco do Raio-X — a leitura mais rica que existe — e mora na Home. |
| M4 | **Raio-X da Prontidão fora de Performance.** A métrica mais próxima de "se a prova fosse hoje?" está num card colapsado da Home. |
| M5 | **ShareProgressCard inalcançável de `/conquistas`.** O gerador de imagem 1080×1350 só abre a partir de CoberturaEdital e MarcoEditalCelebracao — e compartilha cobertura/streak/horas, nunca uma conquista. |
| M6 | **Badges não existem socialmente.** `get_turma_ranking` devolve streak, minutos e cobertura. Amigos e turmas não veem conquista nenhuma. |
| M7 | **Acessibilidade:** filtros são `<button>` sem `role`/`aria-pressed` (leitor de tela não sabe qual está ativo); barras de progresso sem `role="progressbar"`/`aria-valuenow` (o progresso é invisível para leitor de tela); grade de badges sem semântica de lista. |
| M8 | **"recorde anual" é falso.** `ConstanciaResumo.tsx:61` diz "recorde anual", mas `getStreak` calcula sobre janela de ~3 anos (1.100 dias). |
| M9 | **Código morto:** `services/flashcard-streak.service.ts` e `lib/streak-calculator.ts` (nenhum import em lugar nenhum) · `getBadgeStats()` exportado e nunca usado · prop `rhythm` propagada de `FamilySection` até `BadgeCard`, que nem a destrutura. |
| M10 | **Sem período nem comparação em `/performance`.** Tudo é janela fixa (30 dias, 14 baldes, 12 semanas). Não dá para comparar este mês com o anterior — a pergunta mais natural de quem acompanha evolução. |
| M11 | **Anti-gaming ausente na Maestria.** Uma sessão de 1 questão com 1 acerto conta como "ouro". 100 sessões dessas desbloqueiam Maestria Ouro. O streak tem piso de 30 min; a maestria não tem piso nenhum. |
| M12 | **Skeleton duplica o container.** `SkeletonPage` recria `maxWidth: 1080` e o padding em vez de usar `<PageContainer>` — dois lugares para manter em sincronia. |
| M13 | **`activeDaysLast30` é calculado e nunca exibido.** O dado mais honesto sobre ritmo (dias ativos, não média diluída em 30) fica só na memória. |
| M14 | **"média por dia" dilui em 30 dias corridos**, inclusive os não estudados. Quem estuda 3×/semana lê um número que não reconhece. |

### 🟢 Baixos

`etaDaysCalc` usa média sobre 30 dias corridos — para quem estuda em rajadas, o ETA é otimista ·
`bucketKey` de semana usa aproximação ISO própria em vez de reusar `mondayOf` (`lib/schedule-utils`) ·
badge de Tempo mistura `Math.floor(horas)` no display com valor fracionário no cálculo do restante ·
`best = Math.max(current, longest)` é sempre `longest` (redundância inofensiva) · `TIER_COLORS`
tipado como `Record<string, string>` em vez do union de tiers.

---

## 4. Benchmark — o que o mercado faz que a Focali não faz

| Referência | Mecânica | Estado na Focali |
|---|---|---|
| **GitHub Contributions** | Heatmap como identidade pública | ✅ Existe (YearHeatmap) — ❌ escondido em `/historico` |
| **Duolingo** | Streak + escudo + notificação no momento | ✅ Streak com perdão (melhor que a média) · ❌ sem notificação de marco |
| **Steam / PlayStation** | Toast no instante do desbloqueio + data + raridade | ❌ nenhum dos três |
| **Strava** | "Recorde pessoal" celebrado na hora, comparação com você mesmo | ⚠️ `novoRecorde` existe no StreakBar; nada em Performance |
| **LeetCode** | Progresso por *categoria de conteúdo*, não por volume bruto | ❌ badges são todas genéricas — nenhuma é por matéria ou edital |
| **Anki** | Curva de retenção real como métrica central | ❌ o SRS existe (`ease_factor`, `topic_metrics`) e nunca vira gráfico |
| **Apple Fitness** | Três anéis fecháveis por dia — meta diária visível e completável | ⚠️ meta diária existe, mas não tem representação de "fechar o dia" |
| **Todoist Karma** | Nível contínuo, não só marcos discretos | ❌ nada entre uma conquista e a próxima |

**A lacuna competitiva mais cara não é falta de mecânica — é ausência do instante.** Steam, Duolingo e
Strava têm o mesmo insight banal: a conquista precisa aparecer *no segundo em que acontece*. A Focali
tem toda a infraestrutura para isso (celebração pós-sessão, push LIVE, toast) e não a usa aqui.

---

## 5. Análise de gamificação

| Efeito | Estado | Observação |
|---|---|---|
| Coleção | 🟡 parcial | 14 badges em 4 famílias — mas Maestria é incompletável (C2) |
| Progresso | 🟢 bom | barras + % + ETA no ritmo real é acima da média do mercado |
| Streak | 🟢 forte | perdão semanal, piso de 30 min, recorde — o melhor componente do módulo |
| Recompensa | 🔴 ausente | nada acontece no desbloqueio |
| Surpresa | 🔴 ausente | tudo é previsível e listado de antemão |
| Conquista | 🟡 parcial | existe visualmente, não existe temporalmente (sem data, sem momento) |
| Maestria | 🔴 quebrado | ver C2 |
| Comunidade | 🔴 ausente | badges invisíveis para amigos e turmas |
| Competição | 🟡 parcial | ranking de turma existe e ignora conquistas |
| Personalização | 🔴 ausente | as 14 metas são idênticas para todo mundo, independentemente do edital |
| Motivação intrínseca | 🟢 preservada | o produto acertou em não gamificar cada minuto — coerente com `docs/focali-coins.md` |

**Nota importante de coerência:** `docs/focali-coins.md` já desenha uma economia de coins com marcos
de streak em 7/30/100/365 dias — que **colidem** com a família Consistência (7/30/100). Qualquer
evolução aqui precisa tratar badges como a camada *não-monetária* de marcos, com os coins escutando os
mesmos eventos, e não como dois sistemas premiando o mesmo fato duas vezes.

---

## 6. Análise dos dados: o que fica, o que sai, o que falta

**Métricas que geram ação (manter e destacar):** acerto por matéria (com amostra mínima) · cobertura
do edital · streak atual e recorde · dias ativos no período · foco principal do Raio-X · causa
predominante de erro.

**Métricas decorativas (rebaixar):** sessões totais all-time (não muda decisão nenhuma) · "sessões por
semana" com uma casa decimal (`3.5 sessões/semana` é precisão falsa) · média de horas/dia diluída em
30 dias corridos.

**Métricas redundantes (unificar):** horas totais aparece em JourneyStats e ConstanciaResumo · streak
aparece em três lugares com três formatações.

**Métricas que faltam e o produto já tem dados para calcular:**

1. **Retenção real** — `topic_metrics.saude_atual` e `ease_factor` já existem. Nenhum gráfico mostra
   se o que foi estudado está sendo *retido*. É a métrica que diferencia estudar de aprender.
2. **Comparação com você mesmo** — "este mês vs. o anterior" em horas, acerto e cobertura.
3. **Dias ativos** em vez de médias diluídas (`activeDaysLast30` já é calculado e descartado).
4. **Progresso por matéria do edital** — a única unidade que o concurseiro realmente acompanha.
5. **Distribuição de esforço vs. peso do edital** — "você gastou 40% do tempo em uma matéria que vale
   10% da prova". Todos os dados existem (`exam_blueprints` + `timeByCategory`).

---

## 7. Proposta de arquitetura: de quatro destinos para um

Hoje a sidebar tem um grupo "Progresso" com quatro entradas. Proposta:

```
Progresso  (/progresso)
├── Evolução     ← Performance de hoje + Coach semanal + Raio-X + comparação temporal
├── Conquistas   ← badges (com data, com celebração, com share)
└── Histórico    ← YearHeatmap + lista de sessões
Amigos
```

- **Home** mantém apenas os 4 chips de JourneyStats com "ver progresso →". A zona Panorama deixa de
  ser um quinto dashboard.
- **YearHeatmap sobe** para o topo da aba Evolução (é o retrato, não um detalhe do histórico).
- **Coach semanal e Raio-X** passam a ser conteúdo de Evolução, mantendo espelho na Home.
- Sidebar do grupo Progresso: de 4 itens para 2.

Ganho: um único lugar para responder "como estou indo", menos código duplicado, e as três abas
compartilham cache (React Query) em vez de refazer as mesmas leituras de `study_logs`.

---

## 8. Onde IA faz sentido (e onde não faz)

O produto tem uma posição explícita e correta em `coach.service.ts`: *"SEM chamada de IA/LLM — é
geração determinística a partir de dados reais... Nunca inventa."* **Manter essa regra.** Determinismo
é mais barato, mais rápido e mais confiável para tudo que é aritmética.

**IA só onde o determinismo não alcança:**

1. **Narrativa do mês** — transformar os números determinísticos já calculados em 3 frases em segunda
   pessoa. A IA redige; ela não calcula.
2. **Diagnóstico de causa** — cruzar causa de erro + energia + horário + matéria e propor uma hipótese
   ("seus erros de interpretação se concentram em sessões após 21h"). Só com amostra suficiente.
3. **Meta de conquista personalizada** — gerar marcos ancorados no edital do usuário em vez das 14
   metas genéricas.

**Onde IA não deve entrar:** previsão de aprovação (o próprio `raiox.service` já documenta a recusa
de ETA fabricado — a mesma honestidade vale aqui), cálculo de qualquer métrica, e reorganização
automática do plano sem confirmação.

---

## 9. Roadmap priorizado

### Fase 1 — Quick Wins (correções; ~3–4 dias)

| # | Item | Esforço | Risco | ROI usuário | ROI produto |
|---|---|---|---|---|---|
| 1.1 | **C2** — Maestria cumulativa (`pct>=70` conta bronze *e* prata *e* ouro conforme a faixa) + piso de 10 questões/sessão | 2h | baixo | alto | alto |
| 1.2 | **C4** — adicionar `badge-state` e `study-day-totals-heatmap` a `HOME_KEYS` | 15min | nulo | alto | alto |
| 1.3 | **C5** — progresso de Consistência trancada usa `current`; `longest` só como referência ("seu recorde: 25") | 1h | baixo | alto | médio |
| 1.4 | **H3** — `pct: null` em semanas sem questões + `connectNulls` | 30min | nulo | alto | médio |
| 1.5 | **H4** — amostra mínima de 30 questões no insight de AccuracyChart (reusar `MIN_QUESTOES_CONFIAVEL`) | 1h | baixo | alto | médio |
| 1.6 | **H8** — desempate do NextUp: 1 badge por família, mais próximo primeiro | 1h | nulo | alto | médio |
| 1.7 | **H10** — tiers viram tokens (`--tier-ouro` etc.) com contraste AA em light e dark | 2h | baixo | médio | médio |
| 1.8 | **H9** — filtrar de fato as matérias com questões | 30min | nulo | médio | baixo |
| 1.9 | **H5** — `next/dynamic` nos 3 charts de `/performance` (−285 KB no bundle inicial) | 1h | baixo | alto | alto |
| 1.10 | **H1** — eventos `badge_unlocked`, `achievements_viewed`, `performance_viewed` | 1h | nulo | — | máximo |
| 1.11 | **M7** — `aria-pressed` nos filtros, `role="progressbar"` nas barras | 1h | nulo | médio | baixo |
| 1.12 | **M8/M9/M12** — corrigir "recorde anual", apagar código morto, skeleton via `PageContainer` | 1h | nulo | baixo | médio |

**1.10 primeiro.** Sem instrumentação, nenhuma fase seguinte poderá ser avaliada.

### Fase 2 — O instante e o motor (~1,5–2 semanas)

| # | Item | Por quê |
|---|---|---|
| 2.1 | **Tabela `user_badges`** (`user_id, badge_id, unlocked_at`, RLS `auth.uid()`), gravada no servidor quando o cálculo detecta desbloqueio | Resolve C3: data, estabilidade, história, base para tudo abaixo |
| 2.2 | **Celebração no instante** — `SessionCelebration` passa a mostrar "🏆 Você desbloqueou *500 questões*" + push quando fora do app | Resolve o problema #2 do sumário; usa infra que já existe |
| 2.3 | **C1 — motor enxerga tudo**: revisões, flashcards, Vade Mecum e simulados passam a registrar `study_logs` com o `log_mode` correto (o enum já suporta) | O item de maior impacto do roadmap inteiro |
| 2.4 | **H6/H7 — Performance no React Query** + services migrados para `authCache` e `get_study_day_totals` | −4 round-trips de auth, −1 varredura completa da tabela, cache entre navegações, fim das races |
| 2.5 | **H2 — definição única de "questão"** num helper compartilhado | Fim da divergência entre as duas páginas |
| 2.6 | **Share da conquista** — `ShareProgressCard` ganha variante de badge, alcançável de `/conquistas` | Viralização com o gerador que já existe |

### Fase 3 — Unificação e diferenciação (~3–4 semanas)

| # | Item |
|---|---|
| 3.1 | **Destino único `/progresso`** com 3 abas (§7); Home reduzida aos 4 chips |
| 3.2 | **YearHeatmap e Coach semanal** promovidos para a aba Evolução |
| 3.3 | **Comparação temporal** — "este mês vs. anterior" em horas, acerto e cobertura |
| 3.4 | **Conquistas por edital** — marcos ancorados no alvo primário ("50% de Direito Constitucional coberto"), usando `exam_blueprints` + `topic_target_exams`. É a diferenciação real contra Duolingo genérico: ninguém no mercado de concursos tem badge de *edital* |
| 3.5 | **Gráfico de retenção** a partir de `topic_metrics.saude_atual` — a métrica que separa estudar de aprender |
| 3.6 | **Esforço vs. peso do edital** — "40% do tempo numa matéria que vale 10% da prova" |
| 3.7 | **Badges no ranking de turmas** (`get_turma_ranking` + coluna de conquistas) |
| 3.8 | **Narrativa do mês por IA** sobre números determinísticos |

### Ordem recomendada

**1.10 → 1.2 → 1.1 → resto da Fase 1 → 2.3 → 2.1 → 2.2 → 2.4 → Fase 3.**

Justificativa: instrumentar antes de decidir; consertar as mentiras antes de construir em cima delas;
fazer o motor enxergar tudo antes de persistir conquistas (senão persiste-se um número errado); e só
então unificar e diferenciar.

---

## 10. Recomendações de remoção

| Remover | Por quê |
|---|---|
| `services/flashcard-streak.service.ts` + `lib/streak-calculator.ts` | Código morto verificado |
| `getBadgeStats()` | Exportado, nunca chamado |
| Prop `rhythm` em `FamilySection`/`BadgeCard` | Propagada e nunca usada |
| "sessões totais" em ConstanciaResumo | Não muda decisão nenhuma |
| Casa decimal em "sessões/semana" | Precisão falsa |
| Zona Panorama da Home (após Fase 3) | Absorvida por `/progresso` |

---

## 11. Verificação ao vivo — o que se confirmou

Com sessão autenticada (14 sessões, 191 questões, 8,0h):

| Achado | Resultado |
|---|---|
| **C2 Maestria** | ✅ Confirmado numericamente. Sessões: 10q@80%, 20q@75%, 11q@45,5%, 150q@66,7%. A UI mostrava "faltam 280 / 190 / 100" = bronze 20, prata 10, ouro 0. Das 191 questões, **161 (84%) não contavam para nenhum tier**, e a sessão de 80% dava prata mas não bronze. |
| **H9 seletor** | ✅ Confirmado. O dropdown listava **16 matérias** (com duplicatas visíveis: "Direito Administrativo" 2×, "Língua Portuguesa" 2×, "Raciocínio Lógico Matemático" e "Raciocínio Lógico-Matemático"), sendo que só 1 tinha questões. |
| **H3 gráfico** | ✅ Confirmado: 12 semanas plotadas, 10 delas em 0% por não haver questões. |
| **M7 a11y** | ✅ Confirmado: `aria-pressed` e `role` nulos nos três filtros. |
| **M8 "recorde anual"** | ✅ Confirmado na tela, junto de um erro de concordância não catalogado antes: **"recorde anual de 1 dias"**. |
| **NOVO — decimal com ponto** | ❌ Não estava na auditoria: "sessões / semana" usava `toFixed(1)` e renderizava **"0.0"** com ponto, não vírgula. A Home já tinha corrigido isso (H16); a Performance não. |
| **Grade mobile 375px** | ✅ Sem overflow (`scrollWidth === innerWidth`, zero elementos vazando). A preocupação com "Maestria Bronze" quebrando não se confirmou. |
| **Alvo de toque dos filtros** | ⚠️ Falso positivo: 36,6px medidos no pane, mas a regra `@media (pointer: coarse)` que aplica 44px não vale no emulador. Em telefone real está correto. |

---

## 12. Registro da Fase 1 — implementada em 25/07/2026

**12 arquivos alterados, 2 removidos.** `tsc --noEmit` limpo · 152/152 testes · 0 erros de lint ·
build de produção exit 0.

| Item | O que mudou | Como foi verificado |
|---|---|---|
| **C2** | Faixas de maestria agora **cumulativas** (`>=70` conta bronze, `>=80` também prata, `>=90` também ouro) + piso de 10 questões por sessão | Na tela: "faltam 270 / 190 / 100" (bronze subiu de 20 → 30, absorvendo a sessão de 80%). Rótulos viraram "70% ou mais" |
| **C4** | `badge-state` e `study-day-totals-heatmap` entram em `HOME_KEYS` | Chaves conferem exatamente com as usadas em `/conquistas` e no YearHeatmap |
| **C5** | Progresso de consistência usa a sequência **atual**; o recorde vira contexto | Na tela: "7 dias restantes · recorde 1 · 0%" — antes dizia "6 dias restantes · 14%" com streak zerado |
| **H3** | Semana sem questões vira `null` + `connectNulls` | A linha passou de 12 pontos (10 em 0%) para **2 pontos reais**, começando em x=220 em vez do eixo |
| **H4** | Amostra mínima de 30 questões para recomendar matéria + aviso honesto quando não há amostra | Direito Constitucional (171 questões) segue válida como insight |
| **H5** | Os 3 gráficos de `/performance` via `next/dynamic` | Build: `/performance` saiu de recharts no payload inicial → **1108 KB**, igual a `/historico` (1109 KB). Controle: `/jurisprudencias/simulados`, que ainda importa estático, mostra 4 chunks de recharts e 1511 KB |
| **H6** | Flag de cancelamento nos dois gráficos com filtro | Resposta antiga não sobrescreve mais a atual |
| **H7** | `getConstanciaResumo` deixa de paginar a tabela inteira: horas da RPC `get_study_day_totals` + 2 `COUNT` head-only. `badges` e `accuracyEvolution` passam a usar `authCache` | Números idênticos aos do banco: 8,0h / 14 sessões |
| **H8** | NextUp: uma conquista por família, desempate pela mais alcançável | Na tela: Volume + Tempo + Maestria (antes podia dar 3× Volume para usuário novo) |
| **H9** | `listSubjectsWithQuestions` filtra de verdade | Dropdown caiu de **16 para 2** opções ("Geral" + a única matéria com questões) |
| **H10** | Tiers viram tokens `--tier-bronze/prata/ouro` | Contraste medido no browser — claro: **6,33 / 5,46 / 4,90**; escuro: **7,91 / 10,01 / 10,22**. Todos ≥ 4,5 (AA) |
| **H1** | Eventos `performance_viewed`, `achievements_viewed`, `badge_unlocked` | Confirmados no banco. `badge_unlocked` gravou `{"badgeId":"volume-100"}` num desbloqueio simulado; primeira visita não gera evento falso |
| **M7** | `aria-pressed` nos filtros, `role="progressbar"` + `aria-valuenow` nas 17 barras | Verificado no DOM |
| **M8 + novos** | "recorde de 1 dia" (sem "anual", com concordância). "sessões/semana" com ponto decimal foi **substituída** por "dias estudados" e "média por dia estudado" | Na tela |
| **M9** | Removidos `services/flashcard-streak.service.ts`, `lib/streak-calculator.ts`, `getBadgeStats()` e a prop `rhythm` | Sem imports remanescentes; tsc limpo |
| **M12** | Skeleton usa `PageContainer` em vez de recriar a régua | — |

**Regressão consciente:** o piso de 10 questões por sessão na maestria pode reduzir o progresso de
quem registrava sessões muito curtas. É o mesmo princípio do piso de 30 min do streak, e o efeito
cumulativo mais do que compensa (na conta de teste, bronze subiu 20 → 30).

**Não incluído (aguarda decisão):** Fases 2 e 3 — tabela `user_badges`, celebração no instante,
fazer os outros módulos gravarem `study_logs`, migrar `/performance` para React Query e a unificação
em `/progresso`.
