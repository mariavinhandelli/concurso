# Amigos & Turmas — onde está o valor (mercado + oportunidades)

Análise de 28/07/2026, depois de fechar o backlog de segurança da
[auditoria](amigos-auditoria-jul2026.md). A pergunta aqui é outra: **o que faria alguém querer usar
esse módulo?**

---

## 1. De onde partimos (dados do banco, não impressão)

| | |
|---|---|
| Usuários cadastrados | 7 |
| Estudaram nos últimos 30 dias | **3** |
| Perfis sociais ativos | 3 |
| Amizades | **1** |
| Turmas | **0** |

O módulo está tecnicamente são e praticamente parado. Isso é diagnóstico, não fracasso: com 3
pessoas estudando de fato, **nenhuma feature social poderia funcionar** — não há com quem ser
social. Qualquer leitura de "o social não pegou" é prematura.

Isso condiciona tudo o que vem abaixo: existem oportunidades que **dependem de densidade** (não
adianta construir agora) e oportunidades que **funcionam com estranhos** (essas sim são testáveis
hoje). A distinção é a parte mais importante deste documento.

---

## 2. O que o mercado já provou que funciona

### YPT / Yeolpumta (Coreia) — o comparável mais direto

Timer por matéria + grupos de estudo + **ranking em tempo real** + bloqueio de apps.
5 milhões de downloads, 4,51★ com 63 mil avaliações, ~160 mil instalações nos últimos 30 dias.
O público é quase o mesmo da Focali: preparação para concurso público (공무원) e vestibular.

O que a própria descrição do produto destaca como diferencial não é o timer — é *"ver a si mesmo
estudando e acompanhar isso junto com outras pessoas com objetivos parecidos"*. A co-presença é o
produto; o timer é a desculpa.

### Studyplus (Japão) — registro de estudo como rede social

Define-se literalmente como "Study SNS": você registra seu estudo diário e **compartilha o
registro**. O feed é o produto. Cresceu no mesmo nicho (vestibular, certificações, TOEIC) e evoluiu
para B2B com cursinhos.

### Focusmate / Flow Club — body doubling pareado

Sessões de 25/50 min com um estranho, câmera ligada, você declara a intenção, trabalha em silêncio
e faz check-in no fim. A evidência acadêmica sobre body doubling é **mista** — vale registrar isso
honestamente. Mas o mecanismo é claro e se aplica ao concurseiro: estrutura de *início* (o mais
difícil), expectativa social contínua e fronteira temporal concreta.

Detalhe contraintuitivo e importante: **o desconhecido funciona melhor que o amigo**. Você não quer
parecer disperso na frente de quem acabou de conhecer.

### O sinal local mais forte: os concurseiros brasileiros já fazem isso — no Discord

Existem comunidades ativas e grandes de concurseiros no Discord cujo recurso central são **salas de
voz 24h para estudar junto**: Study Community BR, Bonde dos Concurseiros, Biblioteca da Lulu,
Comunidade de Estudos PC. As descrições se repetem: "salas de estudo em grupo como
videoconferências, para que ninguém fique sozinho".

Ou seja: **o público-alvo da Focali já saiu da plataforma de estudo para buscar co-presença em
outro lugar.** Isso é demanda validada, local, e hoje atendida por uma ferramenta que não sabe nada
sobre o edital dessas pessoas.

---

## 3. O problema com o formato atual (e agora com evidência)

O ranking da Focali ordena por **minutos estudados na semana**, em lista absoluta, com pódio
(🥇🥈🥉). A literatura de gamificação educacional é bem específica sobre esse desenho:

- Alunos no fim de um **leaderboard absoluto** tendem a desengajar ao ver a própria posição, e são
  *menos* propensos a tentar fechar a distância — o efeito é o oposto do pretendido.
- Formatos **relativos** (comparação com pares parecidos) motivam onde o absoluto desmotiva.
- **Comparação para baixo** melhora desempenho e satisfação via autoeficácia — o que explica por que
  o pódio funciona bem só para quem já está em cima.
- Alunos **não competitivos** relatam desmotivação com o mesmo leaderboard que os competitivos
  descrevem como catalisador. Há também efeito documentado de redução do engajamento social de
  estudantes mulheres em aulas com leaderboard competitivo.
- Longitudinalmente, turmas gamificadas **caíram** em motivação intrínseca e satisfação em relação
  às não gamificadas.

Somando ao que já está no relatório de auditoria: a coluna "% do edital" compara pessoas de
**concursos diferentes**, onde o número não significa a mesma coisa. E o ranking por horas
contradiz a tese que o próprio `/progresso` adotou (você-vs-você, curva de retenção).

**Conclusão:** o formato atual é o de maior risco possível para um público com ansiedade de
desempenho documentada. Não é neutro — pode ativamente afastar exatamente quem mais precisa de
ajuda.

---

## 4. Oportunidades, em ordem de retorno

### 🟢 O1 — Turma pública por edital (resolve o cold start)

**O problema real do módulo não é o ranking, é a partida a frio.** Hoje o caminho é: ative o perfil
→ convide alguém → essa pessoa precisa ter conta na Focali → ela precisa aceitar. Quatro passos e
uma dependência externa. Nenhum usuário novo atravessa isso.

A Focali tem uma peça que Discord, YPT e Studyplus não têm: **sabe para qual concurso cada pessoa
estuda** (`target_exams`, `topic_target_exams`, o Hub de Editais). Dá para colocar a pessoa numa
turma **no primeiro dia, sem convidar ninguém**: "Turma TCE-GO 2026 · 14 pessoas".

É a única oportunidade que funciona com **estranhos** — e portanto a única testável no estágio
atual. Todas as outras exigem que o usuário já tenha amigos na plataforma.

### 🟢 O2 — Trocar o pódio de horas por consistência

Substituir "minutos da semana" por **dias combinados cumpridos** ("3 de 5"). Três ganhos de uma vez:
mede o que o app ensina, não humilha quem tem menos tempo disponível, e não é forjável de forma
interessante. A plataforma já tem a peça certa parada na gaveta: o **pacto de estudo** da Onda de
Hábito.

Barato e reduz risco de dano. Deveria vir antes de qualquer investimento novo.

### 🟢 O3 — Comparação com pares parecidos, não com indivíduos

Em vez de listar pessoas, mostrar posição relativa dentro de um grupo comparável:
*"entre as 14 pessoas estudando para TCE-GO, você está acima da mediana em constância"*.
É exatamente o formato que a pesquisa aponta como o que motiva, e é um dado que **só a Focali tem**
— nem o Discord nem o YPT conseguem calcular isso.

### 🟡 O4 — Sala de estudo (co-presença) — **depende de densidade**

O que os concurseiros vão buscar no Discord, dentro da Focali e ligado ao edital: quem está
estudando **agora**, com avatar, matéria e tempo decorrido. Sem vídeo e sem áudio — a plataforma já
tem timer, Modo Foco e `passiveSession`; falta só presença (Supabase Realtime).

**Mas: uma sala de estudo com 3 usuários ativos é uma sala vazia — e sala vazia é pior que sala
nenhuma.** Prova que ninguém está ali. Isto é potencialmente o item de maior valor do módulo e
mesmo assim **não deve ser construído agora**. Gatilho sugerido: ~20 pessoas estudando no mesmo dia.

### 🟡 O5 — Turma com meta coletiva, não com ranking interno

Hoje turma = mais um ranking. Turma deveria ter um objetivo **comum**: "a turma soma 100h esta
semana". Cooperação bate competição justamente para o perfil não competitivo, que é quem o
leaderboard atual afasta. E resolve o mesmo problema do O2 num contexto de grupo.

### 🟡 O6 — Toque de ombro em vez de feed

O feed do Studyplus funciona, mas feed aberto custa moderação — e a Focali tem uma pessoa
moderando e um canal de denúncia criado ontem. A versão barata do mesmo efeito: **reação leve a
marcos do amigo** (bateu a meta, fechou uma matéria do edital, voltou depois de sumir). Um botão de
"força!" já cria reciprocidade, e o push (N1) já está no ar.

### ⚪ O7 — Identidade (avatares) — *base entregue nesta sessão*

Ver §6. Rosto importa mais quanto mais perto de co-presença (O4) o módulo chegar.

### ⚪ O8 — Ligar convite ao card compartilhável

O `ShareProgressCard` já existe e já sai da plataforma. Ele deveria carregar o link de convite
junto — é o único item da lista que é **aquisição**, não retenção.

---

## 5. O que eu não faria

- **Feed aberto ou chat livre.** Custo de moderação incompatível com o tamanho do time.
- **Ranking global/público.** Todo o problema de comparação negativa, elevado.
- **Streak compartilhada que quebra se o outro falhar.** Cria co-dependência e culpa; é o oposto do
  que esse público precisa.
- **Notificação de "fulano está estudando e você não".** Vira chicote, não convite.

---

## 6. Avatares — entregue nesta sessão

Você pediu que os avatares apareçam. Ao ir implementar, o motivo de não aparecerem era um **bug**:
`enableSocial` lia a foto de `profiles.avatar_url`, coluna **vazia para todos os usuários**. A foto
real mora em `auth.users.user_metadata.avatar_url`, que é onde a tela de perfil grava depois do
upload. Nenhum avatar jamais chegou ao ranking — todo mundo sempre apareceu como inicial.

Corrigido:

- `identidadeDe()` passa a ler a foto de `user_metadata` (com `profiles` como reserva);
- `syncMySocialIdentity()` mantém nome e foto **em dia** — antes eram um retrato tirado no dia da
  ativação, então trocar a foto no perfil não mudava nada para os amigos. Só escreve se mudou;
- backfill dos perfis existentes (2 dos 3 tinham foto no `auth`);
- `Avatar` cai para a inicial se a imagem falhar (arquivo removido, URL antiga, offline) — com foto
  real passa a existir o caso de imagem quebrada, que é pior que a inicial;
- removido o `loading="lazy"`: para um avatar de 28-40px em lista curta não economiza nada e atrasa
  a linha.

Verificado ao vivo: as duas fotos carregam (512×512 e 2364×1330).

> **Achado en passant, fora do escopo:** a foto de 2364×1330 é a original, baixada inteira para
> renderizar em 38px. O upload em `app/(app)/profile/page.tsx` nem sempre redimensiona. Vale
> normalizar para ~256px na origem — pesa em toda tela que mostra avatar, não só nesta.

---

## 7. Recomendação

Se a régua continua sendo a da due diligence — *só entra feature que traga estranhos usando ou
pagando* — então a resposta honesta é:

1. **O2 + O3 agora** (métrica de consistência + comparação com pares). São baratos, reduzem risco de
   dano e não dependem de escala. Deixam o módulo pronto para quando houver gente.
2. **O1 em seguida** (turma pública por edital). É o único item que gera valor social **sem** o
   usuário precisar trazer alguém — e portanto o único teste real de "o social importa aqui?".
3. **O4 só depois da densidade.** É provavelmente o maior valor do módulo e mesmo assim seria
   desperdício construir hoje: sala vazia prova o contrário do que se quer provar.
4. **O8 junto de qualquer esforço de aquisição.**

E a ressalva que não mudou desde a auditoria: nada disso torna a camada social **necessária**. O que
mudou é que agora existe um caminho plausível para ela ser boa — e ele começa por parar de ranquear
horas.

---

## Fontes

- [YPT — Yeolpumta (Google Play)](https://play.google.com/store/apps/details?id=com.pallo.passiontimerscoped&hl=en_US) · [YPT — Study Group (App Store)](https://apps.apple.com/us/app/ypt-study-group/id1441909643) · [métricas de instalação](https://www.appbrain.com/app/%EC%97%B4%EC%A0%95%ED%92%88%EC%9D%80%ED%83%80%EC%9D%B4%EB%A8%B8-%ED%98%BC%EC%9E%90-%EA%B3%B5%EB%B6%80%ED%95%98%EC%A7%80%EB%A7%90%EA%B3%A0-%EC%97%B4%ED%92%88%ED%83%80%EC%97%90%EC%84%9C%ED%95%A8%EA%BB%98-%EA%B3%B5%EB%B6%80%ED%95%98%EC%84%B8%EC%9A%94/com.pallo.passiontimerscoped) · [relato de uso](https://www.typeitout.com/article/yeolpumta-study-tracker-for-neet-ss-preparation/)
- [Studyplus (App Store)](https://apps.apple.com/us/app/studyplus-record-study/id505410049) · [parceria com Kawaijuku](https://univ-journal.net/113153/)
- [Focusmate — como funciona](https://www.focusmate.com/how-it-works/) · [body doubling e produtividade](https://www.focusmate.com/blog/adhd-body-double-productivity-accountability/) · [evidência acadêmica (mista)](https://arxiv.org/pdf/2509.12153)
- Discord de concurseiros BR: [Study Community BR](https://discord.me/studycommunitybr) · [servidores de concursos](https://disboard.org/servers/tag/concursos) · [Comunidade de Estudos PC](https://www.proximosconcursos.com/discord-concursos-publicos/)
- Leaderboards e comparação social: [efeito da direção do leaderboard](https://www.sciencedirect.com/org/science/article/pii/S1062737524000672) · [competitividade individual e rankings](https://www.sciencedirect.com/science/article/abs/pii/S0360131524002100) · [leaderboard reduz engajamento social de estudantes mulheres](https://link.springer.com/article/10.1007/s12528-025-09438-4) · [estudo longitudinal de gamificação](https://www.sciencedirect.com/science/article/abs/pii/S0360131514002000) · [princípios de design de leaderboard](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8097522/)
