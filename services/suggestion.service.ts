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

const SAUDE_BAIXA = 50; // abaixo disso, conta como "precisa reforçar"

export async function getSuggestions(): Promise<SuggestedTopic[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Revisões vencidas (já vêm com overdueDays).
  const vencidas = await listDueReviews();

  // 2. Saúde dos tópicos vencidos (pra enriquecer o motivo).
  const idsVencidos = vencidas.map((v) => v.id);
  const saudeVencidos = await getSaudeMap(idsVencidos);

  const sugestoes: SuggestedTopic[] = [];
  const jaIncluidos = new Set<string>();

  // --- Bloco A: revisões vencidas (prioridade máxima) ---
  for (const v of vencidas) {
    const saude = saudeVencidos[v.id];
    // Urgência: dias de atraso pesam forte; saúde baixa soma um empurrão.
    let urgencia = 1000 + v.overdueDays * 10;
    if (saude !== undefined && saude < SAUDE_BAIXA) urgencia += (SAUDE_BAIXA - saude);

    const motivo = v.overdueDays === 0
      ? 'revisão vence hoje'
      : `revisão vencida há ${v.overdueDays} ${v.overdueDays === 1 ? 'dia' : 'dias'}`;

    sugestoes.push({
      id: v.id, name: v.name, subjectId: v.subjectId,
      subjectName: v.subjectName, motivo, urgencia, saude,
    });
    jaIncluidos.add(v.id);
  }

  // --- Bloco B: tópicos de saúde baixa SEM revisão vencida ---
  // Busca tópicos do usuário que tenham métrica de saúde baixa.
  const { data: topicos } = await supabase
    .from('topics')
    .select('id, name, subject_id, subjects(name)')
    .eq('user_id', user.id);

  if (topicos && topicos.length > 0) {
    const idsTopicos = topicos.map((t) => t.id).filter((id) => !jaIncluidos.has(id));
    const saudeMap = await getSaudeMap(idsTopicos);

    for (const t of topicos) {
      if (jaIncluidos.has(t.id)) continue;
      const saude = saudeMap[t.id];
      // Só entra se tem saúde medida E está baixa.
      if (saude === undefined || saude >= SAUDE_BAIXA) continue;

      const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
      sugestoes.push({
        id: t.id, name: t.name, subjectId: t.subject_id,
        subjectName: subj?.name ?? 'Matéria',
        motivo: `saúde ${saude}, precisa reforçar`,
        urgencia: 500 + (SAUDE_BAIXA - saude), // menor que qualquer vencida
        saude,
      });
    }
  }

  // Ordena por urgência (maior primeiro) e devolve no máximo 6 (1 principal + 5).
  return sugestoes.sort((a, b) => b.urgencia - a.urgencia).slice(0, 6);
}