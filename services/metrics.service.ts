// services/metrics.service.ts
// Motor da "Saúde do Tópico" (0–100). Combina acerto recente + SRS, e aplica
// o decaimento da curva de esquecimento. Grava o resultado no cache topic_metrics.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';

const PESO_ACERTO = 0.60;           // acerto recente é o preditor mais forte de aprovação
const PESO_SRS = 0.40;              // spaced repetition completa o score quando há flashcards
const MIN_QUESTOES_CONFIAVEL = 30;  // <30 questões → margem de erro estatística alta (±16%)
const TETO_AMOSTRA_PEQUENA = 55;    // abaixo de qualquer limiar de aprovação → sinal visual claro
const N_SESSOES_RECENTES = 8;       // 8 sessões → tendência mais estável (1 ruim = 12.5%, não 20%)

interface SaudeComponentes {
  acerto_recente: number | null;
  srs_score: number | null;
  fator_decaimento: number;
  amostra_questoes: number;
}

function normalizar(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

export function mediaPonderadaRenormalizada(
  itens: Array<{ valor: number | null; peso: number }>,
): number | null {
  const validos = itens.filter((i) => i.valor !== null) as Array<{ valor: number; peso: number }>;
  if (validos.length === 0) return null;
  const somaPesos = validos.reduce((s, i) => s + i.peso, 0);
  const somaValores = validos.reduce((s, i) => s + i.valor * i.peso, 0);
  return somaValores / somaPesos;
}

export async function recalcularSaude(topicId: string): Promise<number> {
  const { supabase, userId } = await requireUser();
  const hoje = new Date();

  const [
    { data: logs, error: logsError },
    { data: cards, error: cardsError },
    { data: topic, error: topicError },
  ] = await Promise.all([
    supabase
      .from('study_logs')
      .select('questions_total, questions_correct, ended_at')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .eq('mode', 'questoes')
      .order('ended_at', { ascending: false })
      .limit(N_SESSOES_RECENTES),
    supabase
      .from('flashcards')
      .select('ease_factor, repetitions')
      .eq('user_id', userId)
      .eq('topic_id', topicId),
    supabase
      .from('topics')
      .select('last_reviewed, interval_days')
      .eq('id', topicId)
      .single(),
  ]);

  if (logsError) throw new Error('Erro ao ler sessões: ' + logsError.message);
  if (cardsError) throw new Error('Erro ao ler flashcards: ' + cardsError.message);
  if (topicError) throw new Error('Erro ao ler tópico: ' + topicError.message);

  const totalQ = (logs ?? []).reduce((s, l) => s + (l.questions_total ?? 0), 0);
  const acertosQ = (logs ?? []).reduce((s, l) => s + (l.questions_correct ?? 0), 0);
  const acertoRecente = totalQ > 0 ? acertosQ / totalQ : null;

  // Só entram cards JÁ REVISADOS ao menos uma vez (repetitions > 0). Um card
  // recém-criado nasce com ease_factor 2.5 (default do banco), que normalizado
  // vale 0.8 — ou seja, criar 10 cards e não revisar nenhum injetava um "80% de
  // domínio" no componente SRS (40% da nota). Saúde subia sem nenhum estudo.
  // ease_factor NULL (linha antiga, sem default aplicado) caía em Number(null)=0
  // e derrubava a média para o outro extremo — agora cai no padrão 2.5.
  let srsScore: number | null = null;
  const cardsRevisados = (cards ?? []).filter((c) => (c.repetitions ?? 0) > 0);
  if (cardsRevisados.length > 0) {
    const media = cardsRevisados.reduce(
      (s, c) => s + normalizar(c.ease_factor === null ? 2.5 : Number(c.ease_factor), 1.3, 2.8),
      0,
    ) / cardsRevisados.length;
    srsScore = media;
  }

  const ultimaSessao = logs && logs.length > 0 ? new Date(logs[0].ended_at) : null;
  const ultimaRevisao = topic.last_reviewed ? new Date(topic.last_reviewed) : null;
  const ref = [ultimaSessao, ultimaRevisao].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;

  let fatorDecaimento = 1.0;
  if (ref) {
    const diasSem = (hoje.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24);
    const meiaVida = Math.max(topic.interval_days ?? 0, 7); // mínimo 7 dias (1 semana) — menos punitivo para tópicos conhecidos
    fatorDecaimento = Math.pow(0.5, diasSem / meiaVida);
  }

  const base = mediaPonderadaRenormalizada([
    { valor: acertoRecente, peso: PESO_ACERTO },
    { valor: srsScore, peso: PESO_SRS },
  ]);

  let saude = base === null ? 0 : base * fatorDecaimento * 100;
  if (totalQ < MIN_QUESTOES_CONFIAVEL) saude = Math.min(saude, TETO_AMOSTRA_PEQUENA);

  const saudeArredondada = Math.round(saude);
  const componentes: SaudeComponentes = {
    acerto_recente: acertoRecente,
    srs_score: srsScore,
    fator_decaimento: Number(fatorDecaimento.toFixed(2)),
    amostra_questoes: totalQ,
  };

  const { error: upsertError } = await supabase
    .from('topic_metrics')
    .upsert({
      topic_id: topicId,
      user_id: userId,
      saude_atual: saudeArredondada,
      saude_componentes: componentes,
      recalculated_at: hoje.toISOString(),
    }, { onConflict: 'topic_id,user_id' });
  if (upsertError) throw new Error('Erro ao salvar métricas: ' + upsertError.message);

  return saudeArredondada;
}

// Um `.in()` vira lista de UUIDs na URL do PostgREST (~43 bytes por id). Editais
// grandes já passam de 300 tópicos vinculados em produção, o que colocava a
// requisição na fronteira do limite de tamanho de URI do gateway — e uma falha
// aqui derruba Cobertura e Raio-X inteiros. Fatiar mantém cada URL curta.
const IN_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function getSaudeMap(topicIds: string[]): Promise<Record<string, number>> {
  if (topicIds.length === 0) return {};
  const auth = await tryGetUser();
  if (!auth) return {};

  const lotes = await Promise.all(
    chunk(topicIds, IN_CHUNK).map((ids) =>
      auth.supabase
        .from('topic_metrics')
        .select('topic_id, saude_atual')
        .eq('user_id', auth.userId)
        .in('topic_id', ids),
    ),
  );

  const mapa: Record<string, number> = {};
  for (const { data, error } of lotes) {
    // H11 — saúde ausente não pode virar "0" silencioso: a Cobertura passaria a
    // dizer "0 tópicos dominados" e o Raio-X derrubaria o score sem explicação.
    if (error) throw new Error('Erro ao ler saúde dos tópicos: ' + error.message);
    for (const row of data ?? []) mapa[row.topic_id] = row.saude_atual;
  }
  return mapa;
}

// Um tópico estudado só em modo teoria/lei/juris (nunca em "questões", nunca
// com flashcard revisado) cai em saude=0 por FALTA de dado, não por
// desempenho ruim — recalcularSaude vira 0 quando os dois componentes são
// null (ver acima). getSaudeMap devolve só o número, indistinguível dos dois
// casos; isto aqui devolve quais tópicos têm sinal REAL, para quem for rotular
// "frágil"/"precisa reforço" não acusar quem simplesmente ainda não fez uma
// questão.
export async function getAssessedTopicIds(topicIds: string[]): Promise<Set<string>> {
  if (topicIds.length === 0) return new Set();
  const auth = await tryGetUser();
  if (!auth) return new Set();

  const lotes = await Promise.all(
    chunk(topicIds, IN_CHUNK).map((ids) =>
      auth.supabase
        .from('topic_metrics')
        .select('topic_id, saude_componentes')
        .eq('user_id', auth.userId)
        .in('topic_id', ids),
    ),
  );

  const assessed = new Set<string>();
  for (const { data, error } of lotes) {
    if (error) throw new Error('Erro ao ler avaliação dos tópicos: ' + error.message);
    for (const row of data ?? []) {
      const c = row.saude_componentes as SaudeComponentes | null;
      if (c && (c.acerto_recente !== null || c.srs_score !== null)) assessed.add(row.topic_id);
    }
  }
  return assessed;
}

export async function getAcertoRecente(): Promise<number | null> {
  const auth = await tryGetUser();
  if (!auth) return null;

  const { data: logs, error } = await auth.supabase
    .from('study_logs')
    .select('questions_total, questions_correct')
    .eq('user_id', auth.userId)
    .eq('mode', 'questoes')
    .order('ended_at', { ascending: false })
    .limit(10);
  // H11 — falha de rede não pode virar "ainda sem questões": a Home mostraria
  // "sem dados de acerto" para quem tem histórico e o coach mudaria de conselho.
  if (error) throw new Error('Erro ao ler acerto recente: ' + error.message);

  const total = (logs ?? []).reduce((s, l) => s + (l.questions_total ?? 0), 0);
  const acertos = (logs ?? []).reduce((s, l) => s + (l.questions_correct ?? 0), 0);
  if (total === 0) return null;
  return Math.round((acertos / total) * 100);
}

export async function getAcertoTopico(topicId: string): Promise<{ pct: number | null; total: number }> {
  const auth = await tryGetUser();
  if (!auth) return { pct: null, total: 0 };

  const { data: logs, error } = await auth.supabase
    .from('study_logs')
    .select('questions_total, questions_correct')
    .eq('user_id', auth.userId)
    .eq('topic_id', topicId)
    .eq('mode', 'questoes');
  // Mesmo motivo do H11 em getAcertoRecente.
  if (error) throw new Error('Erro ao ler acerto do tópico: ' + error.message);

  const total = (logs ?? []).reduce((s, l) => s + (l.questions_total ?? 0), 0);
  const acertos = (logs ?? []).reduce((s, l) => s + (l.questions_correct ?? 0), 0);
  if (total === 0) return { pct: null, total: 0 };
  return { pct: Math.round((acertos / total) * 100), total };
}
