// services/suggestion.service.ts
// Decide "o que estudar agora": prioriza revisões vencidas (têm prazo),
// depois tópicos de saúde baixa (reforço), depois tópicos negligenciados há muito
// tempo (recuperar). Retorna 1 principal + lista, cada item marcado com seu `kind`.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { listDueReviews } from '@/services/reviews.service';
import { getSaudeMap } from '@/services/metrics.service';
import { getPrimaryTargetExam } from '@/services/primaryTargetCache';

export type SuggestionKind = 'revisao' | 'reforco' | 'recuperar';

export interface SuggestedTopic {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  motivo: string;          // texto curto: "revisão vencida há 3 dias" etc.
  urgencia: number;        // score interno (maior = mais urgente)
  saude?: number;          // saúde atual, se houver
  kind: SuggestionKind;    // natureza da sugestão — define o rótulo/ação na UI
}

export interface SuggestionsResult {
  items: SuggestedTopic[];
  reason: 'has_suggestions' | 'no_topics' | 'all_caught_up';
}

const SAUDE_BAIXA = 50;       // abaixo disso, conta como "precisa reforçar"
const NEGLIGENCIA_DIAS = 14;  // sem estudar há >= isso → "recuperar" (esquecimento)

export async function getSuggestions(): Promise<SuggestionsResult> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return { items: [], reason: 'no_topics' };

  // Fase 1 (paralela): revisões vencidas + tópicos do usuário + histórico de estudo.
  // Os logs vêm em ordem decrescente de data para derivarmos o "último estudo por tópico"
  // (a primeira ocorrência de cada topic_id já é a mais recente).
  const [vencidas, { data: topicos }, { data: logs }, primTarget] = await Promise.all([
    listDueReviews(),
    supabase
      .from('topics')
      .select('id, name, subject_id, subjects(name)')
      .eq('user_id', user.id),
    // N10: questions_total/correct entram para o sinal de erro real por tópico.
    supabase
      .from('study_logs')
      .select('topic_id, ended_at, questions_total, questions_correct')
      .eq('user_id', user.id)
      .not('topic_id', 'is', null)
      .order('ended_at', { ascending: false }),
    // N10: edital primário → peso das matérias.
    // H12 — cache compartilhado com coverage/raiox (mesma query, 3x por carga).
    getPrimaryTargetExam(),
  ]);

  // Último estudo por tópico (ISO string). Como os logs vêm desc, a 1ª vez que
  // vemos um topic_id já é a sessão mais recente dele.
  const ultimoEstudo: Record<string, string> = {};
  // N10: acurácia acumulada por tópico (sinal de erro real).
  const acc: Record<string, { total: number; correct: number }> = {};
  for (const l of logs ?? []) {
    if (l.topic_id && !(l.topic_id in ultimoEstudo)) ultimoEstudo[l.topic_id] = l.ended_at;
    const qt = l.questions_total ?? 0;
    if (l.topic_id && qt > 0) {
      const a = acc[l.topic_id] ?? { total: 0, correct: 0 };
      a.total += qt;
      a.correct += l.questions_correct ?? 0;
      acc[l.topic_id] = a;
    }
  }

  // Fase 2 (paralela): saúde de TODOS os ids em uma única query.
  const idsVencidos = new Set(vencidas.map((v) => v.id));
  const idsTopicos = (topicos ?? []).map((t) => t.id).filter((id) => !idsVencidos.has(id));
  const todosIds = [...idsVencidos, ...idsTopicos];
  const saudeMap = todosIds.length > 0 ? await getSaudeMap(todosIds) : {};

  // N10: peso por matéria do edital primário (exam_blueprints.weight, ex.: 2–4).
  const primaryTargetId = primTarget?.id;
  const pesoPorSubject: Record<string, number> = {};
  let maxPeso = 0;
  if (primaryTargetId) {
    const { data: bp } = await supabase
      .from('exam_blueprints')
      .select('subject_id, weight')
      .eq('target_exam_id', primaryTargetId);
    for (const r of bp ?? []) {
      const w = Number(r.weight ?? 0);
      if (r.subject_id && w > 0) {
        pesoPorSubject[r.subject_id] = w;
        if (w > maxPeso) maxPeso = w;
      }
    }
  }

  // N10: além do prazo (SM-2), prioriza por PESO no edital e por ERRO real.
  // Boosts modestos (teto ~60–70) reordenam dentro das faixas sem inverter a
  // hierarquia base (vencidas > reforço > recuperar). Enriquecem também o motivo.
  const PESO_BOOST_MAX = 60;
  const ERRO_MIN_Q = 4;        // só considera erro com amostra mínima de questões
  const ERRO_LIMIAR = 0.6;     // acurácia abaixo disso conta como "erra muito"
  function ajuste(subjectId: string, topicId: string): { boost: number; tag: string | null } {
    let boost = 0;
    let tag: string | null = null;
    const w = pesoPorSubject[subjectId];
    if (w && maxPeso > 0) boost += Math.round((w / maxPeso) * PESO_BOOST_MAX);

    const a = acc[topicId];
    if (a && a.total >= ERRO_MIN_Q) {
      const ratio = a.correct / a.total;
      if (ratio < ERRO_LIMIAR) {
        boost += Math.round((ERRO_LIMIAR - ratio) * 120);
        tag = `você acertou ${Math.round(ratio * 100)}% aqui`;
      }
    }
    // Erro é mais acionável que peso → só rotula "peso alto" na ausência de erro.
    if (!tag && w && maxPeso > 0 && w >= maxPeso) tag = 'peso alto no edital';
    return { boost, tag };
  }

  const sugestoes: SuggestedTopic[] = [];

  // --- Bloco A: revisões vencidas (prioridade máxima) ---
  for (const v of vencidas) {
    const saude = saudeMap[v.id];
    let urgencia = 1000 + v.overdueDays * 10;
    if (saude !== undefined && saude < SAUDE_BAIXA) urgencia += (SAUDE_BAIXA - saude);

    let motivo = v.overdueDays === 0
      ? 'revisão vence hoje'
      : `revisão vencida há ${v.overdueDays} ${v.overdueDays === 1 ? 'dia' : 'dias'}`;

    const aj = ajuste(v.subjectId, v.id);
    urgencia += aj.boost;
    if (aj.tag) motivo += ` · ${aj.tag}`;

    sugestoes.push({
      id: v.id, name: v.name, subjectId: v.subjectId,
      subjectName: v.subjectName, motivo, urgencia, saude, kind: 'revisao',
    });
  }

  // --- Bloco B: tópicos de saúde baixa SEM revisão vencida ---
  for (const t of topicos ?? []) {
    if (idsVencidos.has(t.id)) continue;
    const saude = saudeMap[t.id];
    if (saude === undefined || saude >= SAUDE_BAIXA) continue;

    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    const aj = ajuste(t.subject_id, t.id);
    let motivo = (saude ?? 0) < 30 ? 'muito frágil, vale priorizar' : 'precisa de reforço';
    if (aj.tag) motivo += ` · ${aj.tag}`;
    sugestoes.push({
      id: t.id, name: t.name, subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      motivo,
      urgencia: 500 + (SAUDE_BAIXA - saude) + aj.boost,
      saude, kind: 'reforco',
    });
  }

  // --- Bloco C: tópicos negligenciados (já estudados, mas parados há muito tempo) ---
  // Sinal de esquecimento por abandono: diferente do Bloco B, que olha desempenho.
  // Só entram tópicos COM histórico (nunca-estudados são "começar do zero", não "recuperar")
  // e que ainda não foram sugeridos por vencimento ou fragilidade.
  const jaSugerido = new Set(sugestoes.map((s) => s.id));
  const agora = Date.now();
  for (const t of topicos ?? []) {
    if (jaSugerido.has(t.id)) continue;
    const ultimo = ultimoEstudo[t.id];
    if (!ultimo) continue; // nunca estudado → não é "recuperar"

    const diasSem = Math.floor((agora - new Date(ultimo).getTime()) / 86_400_000);
    if (diasSem < NEGLIGENCIA_DIAS) continue;

    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    const aj = ajuste(t.subject_id, t.id);
    let motivo = `sem estudar há ${diasSem} dias`;
    if (aj.tag) motivo += ` · ${aj.tag}`;
    sugestoes.push({
      id: t.id, name: t.name, subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      motivo,
      urgencia: 300 + Math.min(diasSem, 120) + aj.boost, // teto base p/ não superar reforço/vencidas
      saude: saudeMap[t.id],
      kind: 'recuperar',
    });
  }

  const hasTopics = (topicos ?? []).length > 0;
  const sorted = sugestoes.sort((a, b) => b.urgencia - a.urgencia).slice(0, 6);

  return {
    items: sorted,
    reason: sorted.length > 0 ? 'has_suggestions' : hasTopics ? 'all_caught_up' : 'no_topics',
  };
}