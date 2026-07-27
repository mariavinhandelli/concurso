# Conquistas — análise de expansão e integração da gamificação

**Data:** 27/07/2026 · **Natureza:** análise e proposta — nada aqui foi implementado.
**Base:** o sistema entregue em 25-27/07 (motor universal via `passiveSession`, `user_badges`
persistida, celebração no instante, raridade, share, família de edital, narrativa mensal).

---

## 1. Princípios que já valem e que esta proposta respeita

Antes de propor, o que o produto já decidiu — e que nenhum badge novo pode violar:

1. **Badges são ESTOQUE, missões são FLUXO** (`missoes.service.ts`). Badge acumula e nunca
   reseta; missão renova toda semana. Propor badge que "reseta" é quebrar o contrato.
2. **Sem overjustification** (`docs/focali-coins.md`): premiar marcos e conclusões, nunca a
   ação crua. Coin/badge em cima de cada minuto mata a motivação intrínseca.
3. **Honestidade**: nunca fabricar (regra do Raio-X/ETA/retenção). Um badge não pode prometer
   o que o dado não sustenta.
4. **Anti-gaming com piso**: streak exige 30 min/dia; maestria exige 10 questões/sessão.
   Todo badge novo precisa declarar seu piso.
5. **Privacidade opt-in**: nada social sem `social_profiles.enabled`.

---

## 2. Revisão dos badges atuais

### 2.1 Degraus com buracos desmotivadores

O problema clássico de escada: o degrau seguinte fica tão longe que deixa de puxar.

| Família | Hoje | Buraco | Proposta |
|---|---|---|---|
| Volume | 100 → 500 → 2.000 → 6.000 | 500→2.000 é ~3 meses sem nada | **100 → 250 → 500 → 1.000 → 2.500 → 6.000 → 10.000** |
| Tempo | 50 → 200 → 500 → 1.000h | 50→200 é ~2 meses sem nada | **25 → 50 → 100 → 250 → 500 → 1.000h** |
| Consistência | 7 → 30 → 100 | 30→100: quem quebra no dia 60 "perdeu tudo" | **7 → 14 → 30 → 60 → 100 → 365** |

- O **365 dias** é o badge de marca: chama-se **"Constância que aprova"** (o slogan). Um por
  plataforma inteira com esse nome — é o Everest da coleção.
- O **25h de Tempo** dá a primeira vitória de tempo na primeira/segunda semana (hoje a
  família Tempo é a única sem vitória rápida).
- Compatibilidade: ids novos (`volume-250` etc.) não colidem com os persistidos; ninguém
  perde nada, todo mundo ganha degraus intermediários — vários usuários desbloqueiam
  retroativamente na primeira visita (bom momento, não ruim).

### 2.2 Maestria — está certa, não mexer

Cumulativa + piso de 10q resolveu os dois defeitos. Adicionar tiers (diamante etc.) agora
seria inflação. Único ajuste futuro: quando houver dados de **retenção** maduros (M3 com
semanas de curva), um badge "Retenção Ouro — saúde média ≥70 por 30 dias" fecha o ciclo
estudar→aprender. **Esperar a curva existir.**

### 2.3 Edital — a família certa, com 2 lacunas

- **"Sem lacunas"**: todas as matérias do blueprint com score ≥ 50 no Raio-X. O "Prioridade
  em dia" olha só a matéria de maior peso; este olha o conjunto — é o badge anti-"só estudo
  o que gosto" (o erro nº 1 do concurseiro).
- **"Checklist de véspera"**: `prep_checklist` do modo Reta Final 100% completo. O dado já
  existe em `target_exams.prep_checklist`; o momento (T-30 até a prova) é o de maior
  ansiedade e o que mais merece reconhecimento.

---

## 3. Badges novos — onde a plataforma estuda e a coleção não vê

A ironia atual: o motor passou a enxergar todas as superfícies (Fase 2.3), mas a coleção
só fala de questões, horas e dias. As superfícies que NÃO têm nenhum badge:

### 3.1 Família **Revisão** (SRS) — a alma da plataforma sem nenhum badge

A tese do produto é revisão inteligente; zero conquistas falam disso.

| Badge | Regra | Fonte (já existe) |
|---|---|---|
| Primeira fila zerada | zerar a fila unificada 1x (com ≥5 itens na fila) | `study_logs mode=revisao` + contadores de fila |
| 100 revisões | 100 itens revisados (tópicos+cards+lei+juris) | `study_logs` modos revisao/flashcards + interações |
| 500 revisões | idem, 500 | idem |
| 12 semanas de missões | completar as 3 missões da semana 12 vezes (não consecutivas) | requer persistir conclusão semanal (ver §5.3) |

Piso anti-gaming: item revisado só conta dentro de sessão registrada (o passiveSession já
garante isso — rating sem sessão não existe mais).

### 3.2 Família **Exploração** — gamificação a serviço da ativação

O `activation.service` já detecta módulo nunca usado para o nudge de descoberta. A mesma
informação vira coleção:

- **"Explorador"**: usou pela 1ª vez cada um: Vade Mecum, Jurisprudências, Flashcards,
  Caderno de erros (4 sub-checks num badge só, com progresso 0-4).
- **"Primeiro simulado"**: 1º simulado concluído (lei OU juris) — `*_simulado_sessions`.
- **"10 simulados"**: o degrau seguinte.

É o alinhamento mais barato entre gamificação e negócio: cada check do Explorador é um
módulo dormante ativado — exatamente a métrica que o CoachSlot persegue.

### 3.3 Família **Recomeço** — o badge que nenhum concorrente tem coragem de dar

- **"Recomeço"**: voltar a estudar (≥30 min) após 7+ dias parado. Uma única vez (não é
  prêmio por pausar; é remoção de vergonha na volta). O modo retorno da Home já detecta o
  hiato (`retomada.service`) — o badge é o mesmo sinal persistido.
- **"Escudo bem usado"**: primeira folga perdoada que NÃO virou quebra (estudou no dia
  seguinte ao escudo). Ensina a mecânica do perdão mostrando que ela funcionou.

Duolingo pune a quebra com culpa; a Focali já decidiu o contrário (perdão, modo retorno,
push honesto). Esses dois badges tornam essa filosofia **visível e colecionável** — é
diferenciação de marca, não feature.

### 3.4 Família **Do erro ao acerto** — caderno de erros

- **"25 erros anotados"**: 25 notas no caderno de erros (`error_notebooks`). Elaborar o
  erro é a técnica com maior respaldo em ciência da aprendizagem presente no app.
- **"Erro superado"**: 10 flashcards nascidos de erros (gerados pela IA noturna) avaliados
  como "fácil" — o ciclo completo errou→anotou→virou card→dominou. Dado:
  `flashcards.catalog_card_id null + origem` (a `flashcard_generation_log` liga nota→card).

### 3.5 **Pós-prova** — o marco que ninguém celebra

- **"Dia de prova"**: `target_exams.phase` virou `pos`. Independe de resultado — celebra
  ter chegado lá, que é o que 80% dos inscritos não fazem. Emocional, único, custo ~zero.

### 3.6 O que **deliberadamente NÃO** propor

| Ideia comum | Por que não |
|---|---|
| Badge de login diário | Oco — premia abrir o app, não estudar. O streak já cobre presença com piso honesto |
| Badges de madrugada/fim de semana ("coruja") | Incentiva hábito ruim de sono; conflita com Energia×Desempenho que o próprio app mostra |
| XP/nível contínuo global | Colide com a economia de coins planejada e com o Raio-X (que já é o "nível" honesto); duplicar sistemas de número é a receita da confusão |
| Leaderboard global de badges | Comparação não consentida; social é opt-in por desenho. Turmas já têm ranking |
| Badge comprável/resgatável | Viola "earn-only" da economia de coins |

---

## 4. Efeito surpresa — 2 conquistas secretas (e só 2)

Steam/PlayStation provam o valor do inesperado; o excesso vira ruído. Proposta mínima:

- Slots visíveis como **"??? · conquista secreta"** (honestidade: a pessoa sabe que existem,
  não sabe o quê — igual Steam).
- **Secreta 1 — "Gabarito"**: 100% de acerto num simulado com ≥20 questões.
- **Secreta 2 — "Primeira hora do dia"**: bater a meta diária antes das 9h (1x). Única
  exceção ao veto de horário — manhã é o hábito que a literatura endossa, não pune.

---

## 5. Integração com o resto da plataforma

### 5.1 O que já está ligado (não retrabalhar)

Celebração no instante ✅ · raridade ✅ · share ✅ · narrativa mensal menciona badges do mês ✅ ·
analytics `badge_unlocked` ✅ · invalidação pós-sessão ✅.

### 5.2 Ligações novas de alto valor

1. **Teaser na celebração**: quando a sessão deixa uma conquista a ≥90%, o card de
   celebração mostra "faltam 12 questões para *500 questões*". O dado já está no
   `getBadgeState` que a celebração consulta — é só exibir o quase. **Melhor custo-benefício
   de toda esta análise**: transforma o fim da sessão de hoje no motivo da sessão de amanhã.
2. **Badges no ranking da turma**: coluna de conquistas no `get_turma_ranking` (a RPC já
   agrega streak/minutos/cobertura). Competição saudável sobre coleção, opt-in por natureza.
3. **Perfil do amigo**: as 3 conquistas mais raras visíveis para amigos (só com social
   ativo). Raridade já existe; vira conversa.
4. **Reta Final**: card T-30 lista as conquistas de edital abertas ("você está a 4 tópicos
   de *Edital coberto* antes da prova") — urgência natural, sem inventar prazo.

### 5.3 Uma dívida técnica que esta expansão cobra

"12 semanas de missões" exige saber quantas semanas a pessoa completou — hoje missões são
100% derivadas e a conclusão da semana **não é persistida**. Proposta: tabela
`mission_weeks` (user_id, week 'YYYY-MM-DD', completed_count), gravada pelo mesmo fluxo que
já calcula missões. É a mesma jornada que `user_badges` fez (derivado → persistido) e
destrava também o histórico de missões na narrativa mensal.

### 5.4 Ponte com a economia de coins (futura, não agora)

`docs/focali-coins.md` premia marcos de streak 7/30/100/365. Com a escada de Consistência
proposta (§2.1) os dois sistemas ficam **1:1 alinhados**: o coin escuta o MESMO evento
`badge_unlocked` (já instrumentado) — nada de duas fontes de verdade para "o que é um marco".

---

## 6. Priorização

### Onda A — barata e de efeito imediato (1-2 dias)
| Item | Esforço | Valor |
|---|---|---|
| Novos degraus (Volume/Tempo/Consistência + 365 "Constância que aprova") | P | alto — mata os buracos |
| "Dia de prova" (phase=pos) | P | alto emocional |
| "Sem lacunas" + "Checklist de véspera" (edital) | P | alto — completa a família única do mercado |
| Teaser "faltam X" na celebração | P | **o maior ROI da lista** |

### Onda B — novas famílias (3-5 dias)
Revisão (fila zerada, 100/500 revisões) · Exploração (Explorador, simulados) · Recomeço
(Recomeço, Escudo bem usado) · Do erro ao acerto (25 erros, Erro superado) · 2 secretas.

### Onda C — social e infra (depende de decisão)
Badges no ranking de turma · perfil do amigo com raras · `mission_weeks` + "12 semanas" ·
Reta Final listando conquistas abertas.

**Contagem final da coleção**: hoje 14 globais + até 5 de edital. Com tudo: **~34 globais +
7 de edital** — na faixa saudável (Duolingo ~40; acima de 60 vira papel de parede).

---

## 7. Riscos e salvaguardas

- **Inflação de celebração**: com degraus retroativos, a 1ª visita pós-deploy pode
  desbloquear 4-5 de uma vez. A celebração deve agrupar ("4 novas conquistas") em vez de
  empilhar 5 cards. O backfill do `localStorage` (primeira visita não dispara analytics) já
  existe — estender a lógica à celebração.
- **Raridade com denominador pequeno**: com 7 usuários, "14% têm" é curiosidade; com os
  degraus novos, várias ficarão em "100% têm" no início. Aceitável — o número corrige a si
  mesmo com o crescimento; não maquiar.
- **Secretas e juiz da comunidade**: quando houver mais usuários, secretas viram wiki. É
  esperado e saudável (Steam vive disso) — não é vazamento, é engajamento.
