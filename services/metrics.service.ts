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
      .select('ease_factor')
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

  let srsScore: number | null = null;
  if (cards && cards.length > 0) {
    const media = cards.reduce((s, c) => s + normalizar(Number(c.ease_factor), 1.3, 2.8), 0) / cards.length;
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

export async function getSaudeMap(topicIds: string[]): Promise<Record<string, number>> {
  if (topicIds.length === 0) return {};
  const auth = await tryGetUser();
  if (!auth) return {};

  const { data, error } = await auth.supabase
    .from('topic_metrics')
    .select('topic_id, saude_atual')
    .eq('user_id', auth.userId)
    .in('topic_id', topicIds);

  if (error) {
    console.error('Erro ao ler saúde em lote:', error.message);
    return {};
  }

  const mapa: Record<string, number> = {};
  for (const row of data ?? []) mapa[row.topic_id] = row.saude_atual;
  return mapa;
}

export async function getAcertoRecente(): Promise<number | null> {
  const auth = await tryGetUser();
  if (!auth) return null;

  const { data: logs } = await auth.supabase
    .from('study_logs')
    .select('questions_total, questions_correct')
    .eq('user_id', auth.userId)
    .eq('mode', 'questoes')
    .order('ended_at', { ascending: false })
    .limit(10);

  const total = (logs ?? []).reduce((s, l) => s + (l.questions_total ?? 0), 0);
  const acertos = (logs ?? []).reduce((s, l) => s + (l.questions_correct ?? 0), 0);
  if (total === 0) return null;
  return Math.round((acertos / total) * 100);
}

export async function getAcertoTopico(topicId: string): Promise<{ pct: number | null; total: number }> {
  const auth = await tryGetUser();
  if (!auth) return { pct: null, total: 0 };

  const { data: logs } = await auth.supabase
    .from('study_logs')
    .select('questions_total, questions_correct')
    .eq('user_id', auth.userId)
    .eq('topic_id', topicId)
    .eq('mode', 'questoes');

  const total = (logs ?? []).reduce((s, l) => s + (l.questions_total ?? 0), 0);
  const acertos = (logs ?? []).reduce((s, l) => s + (l.questions_correct ?? 0), 0);
  if (total === 0) return { pct: null, total: 0 };
  return { pct: Math.round((acertos / total) * 100), total };
}
