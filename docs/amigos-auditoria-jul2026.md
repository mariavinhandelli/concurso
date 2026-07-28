# Auditoria do módulo Amigos & Turmas — 27/jul/2026

Escopo: `app/(app)/amigos`, `app/(app)/amigos/adicionar/[code]`, `app/(app)/turmas/entrar/[code]`,
`services/social.service.ts`, `services/turmas.service.ts`, `components/features/social/*`,
migrations `20260709120000_social_amigos.sql`, `20260709160000_turmas.sql`, `20260715150000_fix_friendships_update_check.sql`.

Método: leitura do código + testes de RLS no banco real (`set local role authenticated` +
`request.jwt.claims`, sempre em transação com `rollback`) + teste ao vivo no dev server 3001
logado como `teste@teste.com`. Todo dado de teste criado foi removido ao final (banco restaurado:
1 amizade, 0 turmas).

---

## 1. Veredito rápido

| | |
|---|---|
| **Nota na auditoria** | **4,5 / 10** |
| Modelo de privacidade no papel | Muito bom (opt-in, só 3 agregados, sem busca por nome/e-mail) |
| Modelo de privacidade na prática | ~~Furado em 3 pontos~~ → **os 3 P0 foram corrigidos em 27/07** (§7) |
| Turmas | ~~Inoperante~~ → **entrar por código funciona** desde a migration `20260727120000` |
| Segurança de autorização (RLS) | Sólida onde é RLS; ~~contornada~~ **agora respeitada** nas RPCs `SECURITY DEFINER` |
| Segurança social (bloqueio/denúncia) | ~~Inexistente~~ → **bloqueio + denúncia entregues** (§8) |
| Ranking | ~~Forjável pelo cliente~~ → **agregados calculados no servidor** (§8) |
| Uso real | 3 perfis ativos, 1 amizade, 0 turmas desde 09/jul |

O desenho está certo. A implementação tinha duas RPCs `SECURITY DEFINER` que desfaziam exatamente
as políticas de RLS escritas para proteger o usuário, e uma função de banco quebrada que matava
metade do módulo. **Os três P0 foram corrigidos e verificados** (§7) e, na sequência, **todo o
backlog P1/P2 e o P3 relevante** (§8).

O veredito de produto da §5 **não muda**: as correções tornam a camada social segura o suficiente
para existir, não a tornam necessária. Continua sendo 1 amizade e 0 turmas em ~3 semanas.

---

## 2. O que foi testado e o resultado

### Amigos

| Fluxo | Resultado |
|---|---|
| Busca de usuário por nome/e-mail | **Não existe** — e isso é uma decisão correta (ver §4) |
| Descoberta por código de convite | OK — `find_social_profile_by_code` só devolve perfil `enabled` |
| Convite por código colado | OK |
| Convite por deep-link `/amigos/adicionar/[code]` | OK (com copy enganosa, §3.11) |
| Adicionar a si mesmo | Bloqueado — "Você não pode adicionar a si mesmo." ✅ |
| Adicionar quem já é amigo | Bloqueado — "Vocês já são amigos." ✅ |
| Código inexistente | "Nenhum perfil encontrado para esse código." ✅ |
| Aceitação | OK — vira `accepted`, entra no ranking na hora ✅ |
| Rejeição | OK (deleta a linha) — mas sem estado terminal, §3.5 |
| Cancelamento de pedido enviado | OK ✅ |
| Remoção de amizade | Funciona, mas **sem confirmação e sem desfazer**, §3.9 |
| Bloqueio | **Não existe** |
| Denúncia | **Não existe** |
| Notificação de pedido recebido | **Não existe** — nem sino, nem badge, nem push, §3.8 |
| Estados pendentes | Corrompem permanentemente em corrida, §3.7 |
| Ranking | Existe, e é **totalmente forjável pelo cliente**, §3.4 |
| Visualização de perfil | Não existe perfil navegável — só a linha do ranking (bom para privacidade) |

### Turmas

| Fluxo | Resultado |
|---|---|
| Criar turma | OK ✅ |
| **Entrar por código (aba Turmas)** | **QUEBRADO** — erro de Postgres cru na tela |
| **Entrar por deep-link `/turmas/entrar/[code]`** | **QUEBRADO** — mesmo erro |
| Preview da turma antes de entrar | OK (nome + nº de membros) |
| Sair da turma / dono remover membro / apagar turma | Código correto (não exercitável sem 2º membro) |
| Ranking da turma | Exige `is_turma_member` ✅, mas ignora o opt-out, §3.2 |

### Tentativas de ataque que **falharam** (proteções funcionando)

| Ataque | Resultado |
|---|---|
| Ler `social_profiles` de quem não é meu amigo | Bloqueado — só 2 linhas visíveis (a minha + a da amiga aceita) ✅ |
| Forjar pedido em nome de outra pessoa | `new row violates row-level security policy` ✅ |
| Aceitar o próprio pedido (requester vira accepted) | 0 linhas afetadas ✅ |
| `INSERT` direto em `turma_members` (furar o código) | Sem policy de insert — negado ✅ |
| Chamar as RPCs como `anon` | Nenhuma RPC social tem grant para `anon` ✅ |
| Ler conteúdo de estudo de um amigo (anotações, erros, matérias) | Não há caminho — só os 3 agregados ✅ |

---

## 3. Achados

### 🔴 P0-1 — Turmas está morto: ninguém consegue entrar em turma nenhuma

`join_turma_by_code` é `plpgsql` e declara `RETURNS TABLE (turma_id uuid, ...)`. O parâmetro OUT
`turma_id` colide com a coluna `turma_id` do `INSERT` no corpo da função:

```
Erro ao entrar na turma: column reference "turma_id" is ambiguous
```

Confirmado **ao vivo nos dois pontos de entrada** (aba Turmas e `/turmas/entrar/[code]`) e no banco.
Vale para todo usuário e todo código, sempre. Turmas é hoje uma funcionalidade *create-only*:
dá para criar um grupo que ninguém jamais entra. Isso explica os `0 turma_members` no banco desde 09/jul.

Correção: qualificar o insert (`insert into public.turma_members as tm (...)`) ou renomear os OUT
params (`out_turma_id`). As outras RPCs de turma são `language sql` e não sofrem do problema —
só esta e `create_turma` são plpgsql, e `create_turma` escapa por acaso.

Agravante: o erro cru do Postgres é exibido ao usuário final (§3.15).

### 🔴 P0-2 — "Desativar perfil social" não desativa nada para quem já é seu amigo

A policy de RLS está **correta**:

```sql
create policy "social_profiles_select_friends" ... using (enabled = true and exists (...))
```

Mas a tela não lê pela RLS — lê por `get_social_connections()`, que é `SECURITY DEFINER` e faz
`left join social_profiles` **sem filtrar `enabled`**. O `getSocialOverview` recebe o campo
`enabled` na resposta e o ignora por completo.

Teste executado (com `rollback`): desativei o perfil de `teste@teste.com` e li a tela da Maria:

```
via                          | name  | streak | week_minutes | coverage_pct | enabled
RPC get_social_connections   | teste |      0 |            2 |            0 | false
```

Nome, sequência, minutos e cobertura continuam entregues depois do opt-out. O mesmo vale para
`get_turma_ranking`, que também ignora `enabled`.

Isso quebra a promessa literal da tela ("Você pode desativar quando quiser") e o item da
Política de Privacidade que lista "desativar o social" como exercício de direito do titular
(revogação de consentimento, art. 8º §5º da LGPD).

### 🔴 P0-3 — Seus números vazam antes de você aceitar o pedido

A RLS exige `f.status = 'accepted'` para um amigo ler seu perfil. A RPC `SECURITY DEFINER` não exige.
Resultado: **basta mandar um pedido de amizade para qualquer código de convite para já ler
sequência, minutos da semana e % do edital do alvo** — sem que ele aceite, sem que ele saiba
(não há notificação, §3.8), e sem forma de impedir.

Teste executado (com `rollback`): QA inseriu um `pending` para a Maria e chamou a RPC:

```
direction | name            | streak | week_minutes | coverage_pct
outgoing  | mariavinhandelli|      0 |            0 |            2
```

A UI descarta esses campos ao montar `PendingRequest`, então a tela parece inocente — mas a
resposta HTTP no DevTools tem tudo. Vale nas duas direções (quem recebe também lê os números de
quem mandou antes de decidir).

### 🟠 P1-4 — O ranking é 100% forjável

`social_profiles_update_own` só valida `auth.uid() = user_id`, sem `WITH CHECK` de coluna. Os
agregados são calculados **no cliente** (`pushMyStats`) e escritos pelo próprio cliente. Teste
executado (com `rollback`), autenticado como `teste@teste.com`:

```
teste                | week_minutes | streak_current | coverage_pct
auto-update de stats |        99999 |            365 |          100
```

Qualquer pessoa com o DevTools aberto lidera o ranking de todas as suas turmas e de todos os
amigos, para sempre. Num módulo cuja única mecânica *é* o ranking, isso não é detalhe.

Correção real: calcular os agregados server-side (trigger/RPC sobre `study_logs`) e revogar o
`UPDATE` do cliente nessas 3 colunas.

### 🟠 P1-5 — Não existe bloqueio, e recusar não impede reenvio

Recusar (`decline`) e remover amizade **deletam a linha**. Não sobra nenhum estado terminal.
Teste executado: 3 ciclos consecutivos de inserir pedido → deletar → inserir de novo, todos
aceitos pela RLS, sem cooldown e sem limite.

Consequência prática: quem quiser importunar alguém consegue reenviar pedido indefinidamente, e
a vítima só tem a opção de recusar de novo — para sempre. Como não há bloqueio nem denúncia, o
único remédio da vítima é desativar o perfil social — que, por causa do P0-2, também não a
protege de quem já é amigo dela.

Falta o mínimo: `status = 'blocked'` (ou tabela `blocks`) que sobreviva à recusa e barre novo
`INSERT` na policy, mais um caminho de denúncia (mesmo que só um e-mail).

### 🟠 P1-6 — Nome e avatar são texto livre, sem validação e sem CSP

`display_name` e `avatar_url` são graváveis pelo próprio usuário sem restrição alguma. Teste
executado (com `rollback`): gravei um `display_name` de **5.009 caracteres** e um
`avatar_url` apontando para um domínio de rastreio arbitrário.

Dois problemas:

1. **Assédio.** O nome de exibição aparece para todos os amigos e todos os membros da turma. Nada
   impede um nome ofensivo, um nome imitando outra pessoa, ou 5 mil caracteres quebrando o layout.
   Sem denúncia e sem bloqueio, não há remédio nenhum.
2. **Beacon de IP.** `SocialUI.tsx:18` renderiza `<img src={url}>` com URL controlada por outro
   usuário, e o projeto **não tem CSP** (`next.config.ts` não define headers). Todo amigo/colega de
   turma que abrir o ranking faz uma requisição ao servidor do atacante, entregando IP e User-Agent.
   O React escapa o texto (sem XSS), mas a imagem não é escapável.

Correção: limitar `display_name` (tamanho + lista de bloqueio básica) e aceitar `avatar_url`
apenas do bucket do Supabase Storage — ou proxiar. Adicionar `img-src` no CSP.

### 🟠 P1-7 — Corrida entre dois convites cria estado fantasma permanente

A `unique` é `(requester_id, addressee_id)` — nada impede A→B e B→A coexistirem. `sendFriendRequest`
tenta evitar com um `SELECT` prévio, mas é *check-then-act*: se as duas pessoas se adicionam no
mesmo instante, as duas linhas entram.

Reproduzido ao vivo. A partir daí, na mesma tela:

- a mesma pessoa aparece **duas vezes na seção Pedidos** — "quer te adicionar" *e* "pedido enviado";
- aceitando uma, a outra fica **pendente para sempre** (a pessoa já é amiga e continua "pedido enviado");
- se as duas forem aceitas, a pessoa **ocupa dois lugares no pódio** (🥉 e 4º, com os mesmos números);
- o console cospe `Encountered two children with the same key` (`key={f.userId}` colide).

Correção: índice único sobre o par ordenado — `unique (least(requester_id,addressee_id), greatest(...))`.

### 🟡 P2-8 — Zero notificação de pedido de amizade

O sino (`NotificationBell.tsx`) lê **só** a tabela `reminders`. Não há badge na sidebar, não há
push (nenhuma Edge Function menciona social), não há e-mail. Um pedido de amizade só é descoberto
se a pessoa, por conta própria, abrir `/amigos`.

Numa camada social cujo primeiro passo é "convide alguém", isso praticamente garante que o convite
morre. É a explicação mais provável para 1 amizade em ~3 semanas.

### 🟡 P2-9 — Remover amigo: um clique, sem confirmação, sem desfazer

O "X" de 13px na linha do ranking (`SocialUI.tsx:52`) deleta a amizade imediatamente. Verificado:
clique único, sem diálogo, sem toast, sem undo — e a linha some do banco. Ainda por cima o alvo
do clique fica a poucos pixels da linha inteira, e o módulo de Matérias já resolveu isso com undo
no arquivar. Aqui não.

### 🟡 P2-10 — Código de convite é permanente e não rotacionável

`enableSocial` reusa o código existente; `disableSocial` não o limpa; não há UI de "gerar novo
código". Um link vazado (grupo de WhatsApp, print, fórum) é permanente: qualquer autenticado que
tenha o código descobre seu nome de exibição e pode te mandar pedido para sempre — e, por P0-3,
já lê seus números no ato.

### 🟡 P2-11 — Copy enganosa no deep-link de convite

`/amigos/adicionar/[code]` diz **"QA Concurseiro quer estudar junto com você no Focali"**. Não é
verdade: a pessoa não convidou *você*, você abriu o link dela. Qualquer um com o código vê a mesma
frase personalizada. É pressão social fabricada sobre um fato que o sistema não sabe.

### 🟡 P2-12 — Desativar o social não te tira de nada

`disableSocial` só marca `enabled = false`. Amizades e associações de turma continuam intactas,
os agregados continuam gravados na tabela, e (por P0-2) continuam sendo servidos. Não há
"apagar meus dados sociais".

### ⚪ P3-13 — `other_id` (UUID de `auth.users`) é entregue ao cliente para pedidos pendentes.
Não é explorável hoje (toda leitura é escopada por `auth.uid()`), mas é identificador interno
saindo sem necessidade.

### ⚪ P3-14 — Analytics só instrumenta o lado feliz.
Há `socialEnabled`, `friendRequested`, `friendAccepted`, `turmaCreated`, `turmaJoined`. Não há
evento de recusa, remoção, desativação ou saída de turma — ou seja, **não dá para medir o atrito
nem o churn da camada social**, que é justamente a pergunta em aberto (§5).

### ⚪ P3-15 — Erro cru de banco na cara do usuário.
`"Erro ao entrar na turma: column reference \"turma_id\" is ambiguous"` foi exibido num toast.
Os services concatenam `error.message` do PostgREST direto na mensagem do usuário.

---

## 4. Análise de privacidade

### Dados públicos (para qualquer autenticado que tenha seu código)
- Nome de exibição e avatar (via `find_social_profile_by_code`).
- **Na prática, por P0-3:** sequência, minutos da semana e % do edital, bastando mandar um pedido.

### Dados que exigem consentimento (e o consentimento funciona)
- Nenhum conteúdo de estudo é exposto em nenhum caminho: anotações, erros, flashcards, matérias,
  jurisprudências, revisões e questões ficam fora do modelo social. Isso está corretíssimo e é o
  ponto mais forte do módulo.

### Dados que exigem consentimento (e o consentimento **não** funciona)
- Os 3 agregados: deveriam depender de `enabled = true` **e** amizade aceita. Na prática dependem
  de nada (P0-3) e sobrevivem à revogação (P0-2).

### Descoberta indevida de usuários
- **Bem resolvido.** Não há busca por nome nem por e-mail, não há sugestão de "pessoas que você
  talvez conheça", não há import de contatos. Descoberta só por código de 8 chars de um alfabeto
  de 32 sem caracteres ambíguos (~1,1 × 10¹² combinações) — enumeração não é viável.
- **Ressalva:** não há rate limit em `find_social_profile_by_code`. Não muda a conclusão pelo
  espaço de busca, mas convém limitar quando houver escala.

### Acesso por ID
- Não há rota `/amigos/[userId]` nem perfil navegável. `sendFriendRequest` recebe um `userId`, mas
  ele só é obtido resolvendo um código válido. Um atacante que já conheça o UUID de alguém consegue
  mandar pedido direto — o que, somado a P0-3, entrega os números do alvo. Vale exigir o código na
  RPC de criação do pedido, não o UUID.

### Comparação negativa
O ranking ordena por **minutos estudados na semana**. É a métrica mais frágil possível:
- premia tempo de cadeira, não retenção — o oposto do que o módulo `/progresso` decidiu
  (deltas "você-vs-você", curva de retenção);
- a coluna "% do edital" compara pessoas que estudam para **concursos diferentes**, onde o número
  não significa a mesma coisa;
- quem estuda 40h/semana aparece permanentemente acima de quem estuda 8h com qualidade, sem contexto.

Para um público com ansiedade de desempenho documentada (concurseiros), um pódio público de horas
é o formato de comparação social mais arriscado que existe — e, por P1-4, ele nem é verdadeiro.

### Conformidade
A Política de Privacidade descreve o modelo correto ("consentimento, ativado somente quando você
opta"), mas o produto não o entrega: P0-2 quebra a revogação e P0-3 quebra o consentimento prévio.
Enquanto isso não for corrigido, o texto legal descreve um sistema que não existe.

---

## 5. A camada social melhora o estudo, ou só adiciona complexidade?

**Hoje: só adiciona complexidade.** A evidência é do próprio banco, num ambiente multiusuário
rodando desde 09/jul:

- 3 perfis sociais ativos, **1 única amizade**, **0 turmas** e **0 membros de turma**;
- metade do módulo (Turmas) nunca funcionou para ninguém — e ninguém reportou, o que é o sinal
  mais claro de que ninguém tentou usar;
- não há notificação, então o loop de convite não fecha nem quando alguém tenta;
- o ranking, que é a única mecânica de valor, é forjável e portanto não é confiável nem como
  motivação;
- em troca, o módulo carrega 2 tabelas, 9 funções `SECURITY DEFINER`, 14 policies, 2 rotas de
  deep-link e a superfície de risco inteira de assédio/spam/exposição — sem bloqueio nem denúncia
  para contê-la.

E a métrica escolhida contradiz a tese pedagógica que a própria plataforma já adotou: `/progresso`
foi deliberadamente construído em cima de "você contra você" e curva de retenção. O ranking de
amigos ordena por volume bruto de horas. As duas coisas não podem estar certas ao mesmo tempo.

**O que a literatura sustenta** (e o que vale reaproveitar): o efeito social real em estudo vem de
*accountability* e compromisso mútuo — "combinei com alguém que estudo hoje" —, não de ranking.
O módulo já tem a peça certa para isso (o pacto de estudo da Onda de Hábito) e usou a errada.

### Recomendação

Duas rotas defensáveis. Não recomendo uma terceira ("deixar como está").

**Rota A — parar por ora (recomendada).** Consertar P0-1, P0-2 e P0-3 (que são passivos de
privacidade, não features), esconder a aba Turmas até funcionar, e não investir mais nada até
existirem estranhos usando a plataforma. É a rota coerente com a regra da due diligence registrada
em `docs/plano-acao-fundadora.md`: só entra feature que traga estranhos usando ou pagando — e esta,
medida pelo próprio banco, não está trazendo nem um nem outro.

**Rota B — refazer a mecânica se for insistir.** Nessa ordem:
1. P0-1, P0-2, P0-3 — obrigatórios, são bugs de privacidade;
2. agregados calculados no servidor + revogar `UPDATE` do cliente (P1-4);
3. bloqueio + denúncia (P1-5, P1-6) — nenhuma camada social deve existir sem os dois;
4. notificação de pedido (P2-8), sem a qual o loop não fecha;
5. **trocar o pódio de horas por consistência** — "3 de 5 dias combinados", metas mantidas,
   pacto cumprido. Mede o que o app ensina, não é forjável de forma interessante e não humilha
   quem tem menos tempo disponível;
6. índice único no par ordenado (P1-7), confirmação/undo na remoção (P2-9), rotação de código (P2-10).

---

## 6. Correções sugeridas em ordem de esforço/retorno

| # | Achado | Esforço | Onde |
|---|---|---|---|
| 1 | P0-1 join de turma quebrado | 10 min | migration nova sobre `join_turma_by_code` |
| 2 | P0-2 opt-out ignorado | 20 min | `get_social_connections` + `get_turma_ranking`: filtrar `sp.enabled` |
| 3 | P0-3 stats antes do aceite | 20 min | `get_social_connections`: zerar agregados quando `status <> 'accepted'` |
| 4 | P3-15 erro cru na tela | 15 min | services de social/turmas: mensagem amigável, `console.error` para o técnico |
| 5 | P2-9 remoção sem confirmação | 30 min | `SocialUI.tsx` + `amigos/page.tsx` |
| 6 | P1-7 corrida de pedidos | 30 min | índice único `least/greatest` |
| 7 | P1-6 nome/avatar livres + CSP | 1–2 h | validação no service + `img-src` em `next.config.ts` |
| 8 | P2-8 notificação de pedido | 2–3 h | `NotificationBell` + badge na sidebar |
| 9 | P1-5 bloqueio e denúncia | 4–6 h | tabela + policies + UI |
| 10 | P1-4 agregados server-side | 4–6 h | trigger/RPC sobre `study_logs`, revogar UPDATE |

Itens 1, 2 e 3 estão **feitos** (§7). Os demais seguem em aberto.

---

## 7. Correções aplicadas em 27/07 — os três P0

Migration [`20260727120000_fix_social_privacy_leaks.sql`](../supabase/migrations/20260727120000_fix_social_privacy_leaks.sql),
mais `services/social.service.ts`, `services/turmas.service.ts`, `app/(app)/amigos/page.tsx` e
`components/features/social/TurmasTab.tsx`.

### P0-1 — entrar em turma

`on conflict (turma_id, user_id)` virou `on conflict on constraint turma_members_turma_id_user_id_key`.
A cláusula de inferência era o único ponto onde plpgsql não conseguia decidir entre o OUT param e
a coluna; apontar direto para a constraint elimina a ambiguidade **sem renomear os OUT params**,
que são as chaves do JSON que o service consome.

Verificado ao vivo: `teste@teste.com` entrou numa turma de outro dono pelo campo de código
("Você entrou na turma 'Turma do QA'!", 2 membros) e também pelo deep-link `/turmas/entrar/[code]`,
que exercita o caminho idempotente do `ON CONFLICT`.

### P0-2 e P0-3 — os agregados

`get_social_connections` e `get_turma_ranking` passaram a seguir uma regra única:

- **nome/avatar** — sempre resolvidos. É o motivo de a RPC ser `SECURITY DEFINER`: sem isso a tela
  de pedidos não teria como mostrar quem está pedindo, e ninguém conseguiria gerenciar/desfazer a
  amizade. Não é exposição nova (quem já é amigo já viu o nome, e `find_social_profile_by_code`
  recusa perfis desativados, então ninguém novo descobre por aí).
- **agregados** — só com `status = 'accepted'` **e** `enabled = true`. Fora disso, zeros.

`get_turma_ranking` passou a devolver `enabled` (mudança de tipo, daí o `DROP` + `CREATE`; os
grants foram reaplicados e conferidos — segue sem `anon`).

**Do lado do cliente**, zerar os agregados sem mexer na tela teria trocado um vazamento por uma
comparação falsa: um amigo real apareceria no pódio marcando 0 min, como se não estudasse. Então
quem está com o perfil desativado sai do ranking e passa a aparecer numa linha muda abaixo dele,
marcada "perfil social desativado", ainda com o botão de desfazer a amizade / remover da turma —
some do ranking, não da sua lista.

Verificações ao vivo:

| O que | Antes | Depois |
|---|---|---|
| Pedido pendente, perfil ativo (resposta HTTP real) | `coverage_pct: 2` | `coverage_pct: 0` |
| Amigo aceito e ativo | números reais | números reais (inalterado) |
| Amigo aceito que desativou | aparecia no pódio com os números | sai do pódio → "perfil social desativado" |
| Membro de turma que desativou | idem | idem |
| Aceitar o pedido | — | números voltam na hora (1% do edital) |
| Nome em pedido pendente | resolvido | resolvido (não quebrou) |

`tsc --noEmit` limpo, 175 testes passando, console sem erros em aba limpa, e todo o dado de teste
criado no banco foi removido (voltou a 1 amizade, 0 turmas, 3 perfis ativos).

---

## 8. Backlog P1/P2/P3 — fechado em 27/07

Migrations `20260727130000_social_hardening.sql`, `20260727140000_social_identity_constraints.sql`
e `20260727150000_revoke_trigger_fn_from_api.sql`, mais `social.service.ts`, `turmas.service.ts`,
`app/(app)/amigos/page.tsx`, `TurmasTab.tsx`, `SocialUI.tsx`, `ReportDialog.tsx` (novo),
`NotificationBell.tsx`, `lib/analytics.ts`, `next.config.ts`.

### P1-4 — o ranking era forjável

Os agregados eram calculados **no browser** e gravados pelo browser; a policy de update não
restringe coluna. Postgres não tem RLS por coluna, mas tem GRANT por coluna — então o cliente
perdeu o direito de escrever `streak_current`/`week_minutes`/`coverage_pct` e passou a pedir o
recálculo por `refresh_my_social_stats(p_tz)`, que lê a fonte da verdade (`study_logs`,
`target_exams`, `topic_target_exams`).

O risco dessa mudança é a **divergência**: o número que o amigo vê e o número que a pessoa vê na
Home dela precisam ser o mesmo, e agora existem duas implementações da regra de sequência. Duas
travas contra isso:

1. Os valores que o cliente já tinha gravado foram usados como referência — a RPC reproduziu
   **os 9 valores dos 3 usuários reais**.
2. Sete casos sintéticos cobrindo as regras que só aparecem em dados difíceis:

| Caso | Esperado | Obtido |
|---|---|---|
| 3 dias seguidos incluindo hoje | 3 | 3 ✅ |
| hoje pendente não quebra a sequência | 3 | 3 ✅ |
| falta de 1 dia é perdoada (ponte) | 4 | 4 ✅ |
| 2 faltas seguidas quebram | 2 | 2 ✅ |
| 2º perdão dentro de 7 dias é negado | 2 | 2 ✅ |
| dia com menos de 30 min não conta | 0 | 0 ✅ |
| limiar exato de 30 min conta | 2 | 2 ✅ |

Forjar `week_minutes = 99999` agora responde `permission denied for table social_profiles`; as
colunas legítimas (nome, avatar, ativar/desativar, código) seguem graváveis.

> ⚠️ A regra de sequência está duplicada em `services/streak.service.ts` e em
> `refresh_my_social_stats`. Mexeu em uma, mexa na outra.

### P1-5 — bloqueio e denúncia

Não existia estado terminal: recusar/remover só apagavam a linha, e o mesmo usuário reenviava
pedido indefinidamente.

- `social_blocks` + RPC `block_user` (atômica: registra o bloqueio **e** desfaz a amizade/pedido).
- A barreira é um **trigger** `SECURITY DEFINER`, não uma policy de RLS. Uma policy consultaria
  `social_blocks` como o próprio usuário — e quem está bloqueado não pode ler a linha que o
  bloqueia, então o `not exists` daria falso e a proteção falharia justamente contra quem ela
  existe. A mensagem é genérica de propósito: distinguir "bloqueado" de "outro erro" seria oráculo.
- `social_reports` + `ReportDialog` (reusa o primitivo `Overlay`). Só INSERT e leitura das próprias
  denúncias; a moderação lê pelo `service_role`. Sem UPDATE/DELETE.

Verificado ao vivo: bloquear pela UI apagou o pedido pendente e criou a seção "Bloqueados";
o bloqueado não enxerga a linha de bloqueio (`count = 0`) e o reenvio morre em `friendship_blocked`;
desbloquear pela UI limpou tudo; a denúncia chegou ao banco com motivo e detalhes.

### P1-6 — nome e avatar livres

A sanitização no service é a primeira linha de defesa, mas **não é enforcement** — a tabela continua
escrevível pela API REST, então bastava chamar o PostgREST direto. Fechado com CHECK no banco
(nome ≤ 40 chars, sem controles nem caracteres de largura zero/bidi; avatar só de Storage do
Supabase). Nome de 5.000 caracteres e avatar apontando para domínio de rastreio agora são recusados
pelo próprio Postgres.

Mais a CSP `img-src` em `next.config.ts`, que fecha o beacon de IP no `<img>` do ranking. Só essa
diretiva é declarada de propósito: `script-src` exigiria nonce no middleware e quebraria a app se
saísse errada; diretiva não declarada simplesmente não é aplicada.

> **Achado durante a verificação:** a primeira versão derivava o host de
> `NEXT_PUBLIC_SUPABASE_URL`. A env não está garantida quando `next.config.ts` é avaliado, e o
> resultado era uma CSP **sem** o Supabase — avatar quebrado para todos, sem erro em lugar nenhum.
> O host virou literal e o teste `lib/csp-headers.test.ts` guarda o caso.

### P1-7 — corrida de pedidos

Índice único sobre o par **ordenado** (`least`/`greatest`). O segundo insert simultâneo agora falha
no banco em vez de criar a pessoa duplicada no pódio.

### P2-8 — notificação de pedido

O sino lia só `reminders`. Passou a somar os pedidos esperando resposta, com item próprio no
dropdown levando a `/amigos`. Verificado: badge "1" e "1 pedido de amizade · Esperando sua resposta".

### P2-9 — ações destrutivas

O "X" de 13px que desfazia a amizade num clique virou um menu (`Menu` + `IconButton`, primitivos
que já existiam) com confirmação (`ConfirmDialog`) em desfazer amizade, bloquear, remover da turma,
sair da turma, apagar turma, desativar perfil e apagar dados. Isso também resolveu o alvo de toque
pequeno que eu tinha deixado passar na rodada dos P0.

### P2-10, P2-11, P2-12 e P3

- **P2-10** "Gerar um código novo" invalida o link antigo. Verificado: o código anterior passou a
  responder "Convite não encontrado".
- **P2-11** a copy do deep-link dizia "X quer estudar junto com você" — o sistema não sabe disso, e
  qualquer um com o link via a mesma frase. Agora: "Este é o convite de X no Focali".
- **P2-12** `delete_my_social_data()` apaga perfil, amizades, bloqueios, participação em turmas e
  as turmas próprias (com aviso explícito na confirmação). Verificado: os dados dos outros usuários
  ficam intactos.
- **P3-14** eventos de atrito instrumentados (recusa, remoção, cancelamento, bloqueio, denúncia,
  desativação, exclusão, rotação de código, saída de turma).
- **P3-15** as mensagens cruas do PostgREST saíram da tela; o detalhe técnico vai para o console.

### O que continua aberto

- **P3-13** — `other_id` (UUID de `auth.users`) segue indo ao cliente. Agora é necessário: é a chave
  de bloquear/denunciar. Não é explorável (toda leitura é escopada por `auth.uid()`).
- **Resíduo do avatar** — a constraint do banco garante a *forma* (`https://<algo>.supabase.co/
  storage/v1/object/...`); a origem exata é fixada só no cliente. Alguém hospedando um beacon no
  próprio projeto Supabase passaria pela constraint, mas não pelo cliente nem pela CSP.
- **Bloqueio e turmas** — bloquear alguém não remove os dois da mesma turma. Convivem sem se
  adicionar; se incomodar, o caminho é sair/remover da turma.
- **O veredito de produto da §5 não muda.** Nada disso torna a camada social necessária — só a torna
  segura o suficiente para existir sem ser um passivo.

`tsc --noEmit` limpo, **176 testes** passando, eslint sem erros, advisors sem achado novo, todas as
migrations conferidas contra o banco por hash, e o banco restaurado ao estado original.
