# Focali Coins — economia de recompensas

Desenho de 12/07/2026, ideia da fundadora. Complementa
`estrutura-assinaturas.md` — revisado contra a **v5.3** (escada de conteúdo,
juris exclusiva do Total, VM em 5 camadas, free bem básico). **Depende do
paywall existir primeiro** (resgate de dias de plano e créditos de IA usa a
camada de entitlements).

> Nome alternativo a considerar: **"Focos"** ("você ganhou 15 Focos") —
> conversa com a marca. No doc, "coins".

---

## 1. Papel do sistema (e o que ele NÃO é)

- **É**: motor de retenção (dar propósito ao hábito diário), vitrine
  recorrente dos planos pagos (resgates pequenos de dias de
  Essencial/Pro/Total e de créditos de IA) e motor de aquisição (indicação
  premiada). Com o free bem básico da v5, os coins são a válvula que
  mantém o usuário grátis engajado sem afrouxar nenhum teto permanente.
- **NÃO é**: caminho permanente para ter plano pago de graça, nem moeda
  comprável com dinheiro, nem porta dos fundos para conteúdo premium
  (juris, mapa fino, Lei Viva — ver travas no §3).

### As 3 regras invioláveis da economia

1. **Coins nunca são vendidas por dinheiro.** Earn-only. Evita enquadramento
   jurídico complicado (moeda virtual/consumidor), evita dinâmica de cassino
   e mantém o Mercado Pago como único fluxo de receita. Sem valor monetário,
   sem reembolso, cláusula nos ToS.
2. **Resgate de benefício com custo real tem teto mensal.** Dias de plano e
   créditos de IA custam dinheiro de verdade — o teto garante que coins são
   degustação recorrente (~10% do mês em Pro, no máximo), nunca substituto
   da assinatura.
3. **Toda concessão e resgate passa pelo servidor** (ledger append-only +
   regras na camada de serviço). Cliente nunca credita coin.

---

## 2. Como ganhar (fontes)

Princípio psicológico: premiar **marcos e conclusões**, não a ação crua —
o streak em si já é recompensa intrínseca; coin em cima de cada minuto
estudado mataria a motivação intrínseca (overjustification). Por isso os
ganhos diários são poucos e fixos, e os números grandes ficam nos marcos.

| Ação | Coins | Limite |
|---|---|---|
| Primeira sessão de estudo do dia | +10 | 1x/dia |
| Concluir a fila de revisões do dia | +15 | 1x/dia |
| Completar o Plano de Hoje inteiro | +15 | 1x/dia |
| Sessão de questões C/E concluída (fonte Pro+) | +10 | 1x/dia |
| Meta semanal batida | +50 | 1x/semana |
| Pacto de estudo cumprido na semana | +30 | 1x/semana |
| Marco de streak — 7 dias | +50 | por marco |
| Marco de streak — 30 dias | +200 | |
| Marco de streak — 100 dias | +750 | |
| Marco de streak — 365 dias | +3.000 | |
| Simulado completo (fonte Total, roadmap) | +40 | 2x/semana |
| **Indicação ativada** | **+300** | máx 5/mês |

As fontes disponíveis variam por plano (questões são Pro+, simulados são
Total) — é proposital: quem paga mais engaja mais e ganha mais, e o free
ganha o suficiente para os resgates de degustação, não mais que isso.

- **Teto diário de rotina: 50 coins/dia** (marcos e indicações fora do teto).
- Usuário diligente: ~1.200–1.500 coins/mês. Esse número calibra a loja (§3).
- **Indicação "ativada"** = o amigo criou conta com o link E registrou estudo
  em **3 dias distintos** (via `study_logs`). Cadastro puro não paga nada —
  é a defesa principal contra farm de contas. O amigo indicado ganha +100 de
  boas-vindas ao ativar (incentivo dos dois lados).

## 3. Como gastar (loja)

Ordenada do melhor para o negócio (margem infinita) para o mais caro:

| Item | Custo | Limite | Nota |
|---|---|---|---|
| Ícones/flairs de perfil | 200 | — | cosmético, custo zero |
| Avatares exclusivos | 300–500 | — | cosmético |
| Molduras de perfil | 500–1.000 | — | cosmético; aparecem nas turmas → inveja produtiva |
| Temas exclusivos do app | 800 | — | cosmético (dentro do design system; nada de fundo decorado — fundo segue sólido) |
| Proteção extra de streak | 200 | máx 2 estocadas | o sink comprovado do gênero (Duolingo) |
| Pack de flashcards curado (tema quente de banca) | 600 | só Essencial+ | conteúdo estático, custo zero; free tem teto de 20 cards e não resgata |
| Ingresso p/ desafio especial sazonal | 100 | por evento | desafio devolve coins/cosmético raro a quem completa |
| **Pack de 10 créditos de IA** | **400** | Essencial: 1/mês · Pro/Total: 3/mês | free NÃO resgata IA (preserva a fronteira "free sem IA") |
| **7 dias de Essencial** | **1.000** | 1x/mês, só p/ Grátis | degustação de organização completa |
| **3 dias de Pro** | **1.200** | 1x/mês, só p/ não-Pro | degustação recorrente de treino+IA |
| **2 dias de Total** | **1.500** | 1x/mês, só p/ não-Total | degustação de juris completa + sem limites (v5) |

### A matemática da não-canibalização

Usuário free diligente ganha ~1.100–1.300/mês (menos que antes: as fontes
de questões/simulados não existem no free) → dá para resgatar **3 dias de
Pro OU 2 dias de Total por mês, e mais nada**, ou poupar para um cosmético.
~10% do mês com gostinho de plano pago — é um trial recorrente disfarçado,
não um substituto. Para ter "Pro de graça" o mês inteiro, precisaria de
~12.000 coins/mês — impossível por desenho. Assinantes Pro/Total não
resgatam dias (não faz sentido); gastam em cosméticos, freeze e packs
extras de IA.

### Fronteiras com os planos (coerência com a v2)

- Free continua **sem IA por coins** — a única IA do free segue sendo o trial
  de 7 dias (do Total, na v5). Coins de IA começam no Essencial (1 pack/mês),
  que vira também um empurrão de upgrade ("gostou dos 10? no Pro são 300").
- **Conteúdo premium NUNCA é resgatável em definitivo**: nenhum item da loja
  dá acesso permanente a julgados, mapa por artigo, Lei Viva ou questões
  além do teto do plano. A única janela para isso são os **2 dias de Total**
  (temporários, 1x/mês) — que existem exatamente para dar o gostinho do
  premium e vender o upgrade, não para substituí-lo.
- Dias de plano resgatados = entitlement temporário, **não** criam assinatura
  no gateway (sem cobrança, sem renovação; expira sozinho).

## 4. Anti-abuso

- **Ledger append-only** (`coin_ledger`): cada linha tem user_id, regra,
  referência (sessão/meta/indicação), valor, timestamp. Saldo = soma. Nunca
  UPDATE — auditável e reversível (estorno é linha negativa).
- Constraint de unicidade por (user_id, regra, dia/semana/marco) impede
  crédito duplo (ex.: duplo clique que já duplicou bloco no passado).
- Indicação: valida 3 dias distintos de `study_logs` do indicado + 1 indicação
  por dispositivo/IP razoável + máx 5/mês. Indicado que virar pagante pode
  render bônus retroativo (+500) — aí sim vale muito.
- Sessões que valem coin passam pelo mesmo crivo anti-gaming do streak
  (duração mínima da sessão; quick-log de 1 min não pode farmar +10/dia... o
  crédito da "primeira sessão" exige sessão ≥ 25 min OU soma diária ≥ 25 min).
- Expiração: coins expiram só após **12 meses sem login** (pressão zero em
  quem usa; limpa passivo de contas mortas).

## 5. Implementação (ordem)

**Pré-requisito: paywall + entitlements em produção** (fases 1–4 do
`estrutura-assinaturas.md` §7). Sem isso não existem "dias de Pro" nem
"créditos de IA" para resgatar.

1. **Fase C1 — motor + 3 sinks úteis** (sem cosméticos, que exigem infra
   própria de temas/avatares):
   - Tabelas: `coin_ledger`, `coin_rules` (catálogo de fontes em dados),
     `shop_items` + `redemptions`.
   - Concessão na camada de serviço junto do `track()` existente (os eventos
     de sessão/revisão/meta já são instrumentados — a regra de coin escuta os
     mesmos pontos).
   - Loja mínima: freeze de streak, pack de IA, dias de plano (7 de
     Essencial / 3 de Pro / 2 de Total).
   - Saldo + extrato na UI (extrato = confiança; sistema de pontos opaco gera
     ticket de suporte).
2. **Fase C2 — indicação premiada** (pode até vir junto da C1: é a parte de
   AQUISIÇÃO, a única que conversa com a regra dos 90 dias "só entra o que
   traz estranho"): link de indicação, página de aterrissagem, validação de
   ativação, painel "seus indicados".
3. **Fase C3 — cosméticos e desafios**: exige sistema de temas/avatares/
   molduras (hoje não existe) e motor de desafios sazonais. Só depois de
   C1/C2 provarem engajamento.

## 6. Métricas de sucesso (60 dias após C1/C2)

- % de usuários ativos que ganharam coin na semana (meta: >60% — se baixo, as
  fontes estão escondidas).
- % de resgatadores de dias de plano (Pro/Total) que assinam em até 30 dias
  — ESTA é a métrica que justifica o sistema (o resgate é um trial
  recorrente). Acompanhar separado por plano: resgate de Total que converte
  em Total é o melhor sinal do funil de juris.
- K-factor da indicação (indicações ativadas / usuário ativo).
- Custo real: créditos de IA e dias de Pro concedidos por coins, em R$/mês.

## 7. Riscos

- **Escopo**: é um sistema com economia, loja e anti-fraude — não é um
  card de UI. Não entra antes do paywall nem compete com os 100 primeiros
  usuários. Exceção: a indicação (C2) serve diretamente à aquisição.
- **Inflação**: revisar preços da loja a cada trimestre olhando o saldo médio
  estocado; se todo mundo acumula >5.000 sem gastar, faltam sinks bons.
- **Dias de plano**: se a conversão pós-resgate for ~zero em 90 dias, cortar
  o item (vira só custo) e reforçar cosméticos.
- **Free ganha menos por desenho** (~1.100/mês sem fontes de treino). Se o
  free médio não conseguir nem 1 resgate de degustação a cada 2 meses, os
  coins perdem função de válvula — ajustar valores das FONTES diárias antes
  de mexer nos preços da loja.
- **Cosmético fora do design system**: temas exclusivos respeitam tokens e a
  regra do fundo sólido — cosmético não é licença para quebrar identidade.
