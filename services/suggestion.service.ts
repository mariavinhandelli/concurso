// services/suggestion.service.ts
// Decide "o que estudar agora": prioriza revisões vencidas (têm prazo),
// depois tópicos de saúde baixa (reforço), depois tópicos negligenciados há muito
// tempo (recuperar). Retorna 1 principal + lista, cada item marcado com seu `kind`.

import { createClient } from '@/lib/supabase/client';
import { listDueReviews } from '@/services/reviews.service';
import { getSaudeMap } from '@/services/metrics.service';

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], reason: 'no_topics' };

  // Fase 1 (paralela): revisões vencidas + tópicos do usuário + histórico de estudo.
  // Os logs vêm em ordem decrescente de data para derivarmos o "último estudo por tópico"
  // (a primeira ocorrência de cada topic_id já é a mais recente).
  const [vencidas, { data: topicos }, { data: logs }] = await Promise.all([
    listDueReviews(),
    supabase
      .from('topics')
      .select('id, name, subject_id, subjects(name)')
      .eq('user_id', user.id),
    supabase
      .from('study_logs')
      .select('topic_id, ended_at')
      .eq('user_id', user.id)
      .not('topic_id', 'is', null)
      .order('ended_at', { ascending: false }),
  ]);

  // Último estudo por tópico (ISO string). Como os logs vêm desc, a 1ª vez que
  // vemos um topic_id já é a sessão mais recente dele.
  const ultimoEstudo: Record<string, string> = {};
  for (const l of logs ?? []) {
    if (l.topic_id && !(l.topic_id in ultimoEstudo)) ultimoEstudo[l.topic_id] = l.ended_at;
  }

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
      subjectName: v.subjectName, motivo, urgencia, saude, kind: 'revisao',
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
    sugestoes.push({
      id: t.id, name: t.name, subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      motivo: `sem estudar há ${diasSem} dias`,
      urgencia: 300 + Math.min(diasSem, 120), // teto p/ não superar reforço/vencidas
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