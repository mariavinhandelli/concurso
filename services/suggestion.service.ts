// services/suggestion.service.ts
// Decide "o que estudar agora": prioriza revisões vencidas (têm prazo),
// depois tópicos de saúde baixa (precisam reforço). Retorna 1 principal + lista.

import { createClient } from '@/lib/supabase/client';
import { listDueReviews } from '@/services/reviews.service';
import { getSaudeMap } from '@/services/metrics.service';

export interface SuggestedTopic {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  motivo: string;          // texto curto: "revisão vencida há 3 dias" etc.
  urgencia: number;        // score interno (maior = mais urgente)
  saude?: number;          // saúde atual, se houver
}

export interface SuggestionsResult {
  items: SuggestedTopic[];
  reason: 'has_suggestions' | 'no_topics' | 'all_caught_up';
}

const SAUDE_BAIXA = 50; // abaixo disso, conta como "precisa reforçar"

export async function getSuggestions(): Promise<SuggestionsResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], reason: 'no_topics' };

  // Fase 1 (paralela): revisões vencidas + todos os tópicos do usuário ao mesmo tempo.
  const [vencidas, { data: topicos }] = await Promise.all([
    listDueReviews(),
    supabase
      .from('topics')
      .select('id, name, subject_id, subjects(name)')
      .eq('user_id', user.id),
  ]);

  // Fase 2 (paralela): saúde de TODOS os ids em uma única query.
  const idsVencidos = new Set(vencidas.map((v) => v.id));
  const idsTopicos = (topicos ?? []).map((t) => t.id).filter((id) => !idsVencidos.has(id));
  const todosIds = [...idsVencidos, ...idsTopicos];
  const saudeMap = todosIds.length > 0 ? await getSaudeMap(todosIds) : {};

  const sugestoes: SuggestedTopic[] = [];

  // --- Bloco A: revisões vencidas (prioridade máxima) ---
  for (const v of vencidas) {
    const saude = saudeMap[v.id];
    let urgencia = 1000 + v.overdueDays * 10;
    if (saude !== undefined && saude < SAUDE_BAIXA) urgencia += (SAUDE_BAIXA - saude);

    const motivo = v.overdueDays === 0
      ? 'revisão vence hoje'
      : `revisão vencida há ${v.overdueDays} ${v.overdueDays === 1 ? 'dia' : 'dias'}`;

    sugestoes.push({
      id: v.id, name: v.name, subjectId: v.subjectId,
      subjectName: v.subjectName, motivo, urgencia, saude,
    });
  }

  // --- Bloco B: tópicos de saúde baixa SEM revisão vencida ---
  for (const t of topicos ?? []) {
    if (idsVencidos.has(t.id)) continue;
    const saude = saudeMap[t.id];
    if (saude === undefined || saude >= SAUDE_BAIXA) continue;

    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    sugestoes.push({
      id: t.id, name: t.name, subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      motivo: (saude ?? 0) < 30 ? 'muito frágil, vale priorizar' : 'precisa de reforço',
      urgencia: 500 + (SAUDE_BAIXA - saude),
      saude,
    });
  }

  const hasTopics = (topicos ?? []).length > 0;
  const sorted = sugestoes.sort((a, b) => b.urgencia - a.urgencia).slice(0, 6);

  return {
    items: sorted,
    reason: sorted.length > 0 ? 'has_suggestions' : hasTopics ? 'all_caught_up' : 'no_topics',
  };
}