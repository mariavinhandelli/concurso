// services/coverage.service.ts
// Cobertura do Edital: quanto do concurso-alvo primário já foi coberto.
// Denominador = tópicos vinculados ao edital (topic_target_exams), NÃO todos os
// tópicos da biblioteca (essa é a métrica genérica do journey.service).
// Camadas: dominado (saúde alta), em progresso (estudado ≥1x), não iniciado.

import { tryGetUser } from '@/lib/supabase/requireUser';
import { getSaudeMap } from '@/services/metrics.service';
import { getPrimaryTargetExam } from '@/services/primaryTargetCache';
import { getStudiedTopicIds } from '@/services/studiedTopicsCache';

const LIMIAR_DOMINIO = 70; // saúde >= isso conta como "dominado"

export interface EditalCoverage {
  hasTarget: boolean;      // existe concurso-alvo?
  targetId: string | null;
  targetName: string | null;
  total: number;           // tópicos do edital
  covered: number;         // estudados ≥1 vez
  mastered: number;        // saúde >= LIMIAR_DOMINIO
  inProgress: number;      // estudados mas ainda não dominados
  notStarted: number;      // nunca estudados
  pct: number;             // covered / total × 100 (o número-herói)
  masteredPct: number;     // mastered / total × 100
}

const EMPTY: EditalCoverage = {
  hasTarget: false, targetId: null, targetName: null,
  total: 0, covered: 0, mastered: 0, inProgress: 0, notStarted: 0,
  pct: 0, masteredPct: 0,
};

export async function getEditalCoverage(): Promise<EditalCoverage> {
  const auth = await tryGetUser();
  if (!auth) return EMPTY;
  const { supabase } = auth;

  // Alvo primário (ou o mais antigo, se nenhum marcado como primário).
  // H12 — cache compartilhado com raiox/suggestion (mesma query, 3x por carga).
  const target = await getPrimaryTargetExam();
  if (!target) return EMPTY;

  const targetName =
    [target.orgao, target.cargo].filter(Boolean).join(' · ') || target.slug || 'Meu edital';

  // Tópicos vinculados ao edital (denominador).
  const { data: links, error: linksError } = await supabase
    .from('topic_target_exams')
    .select('topic_id')
    .eq('target_exam_id', target.id);
  if (linksError) throw new Error('Erro ao buscar tópicos do edital: ' + linksError.message);

  const linkedIds = (links ?? []).map((l) => l.topic_id as string);
  const total = linkedIds.length;
  if (total === 0) return { ...EMPTY, hasTarget: true, targetId: target.id, targetName };

  // Estudados ≥1 vez (interseção com o conjunto de tópicos estudados) + saúde
  // em lote. studiedTopicIds vem de get_studied_topic_ids() (RPC, distinct no
  // servidor, cache compartilhado com raiox.service — mesma dado, uma query só)
  // em vez de buscar study_logs.topic_id cru sem limite. A interseção com o
  // edital continua em memória: mandar os ids num `.in()` gerava uma URL com
  // 300+ UUIDs (editais grandes já existem em produção), perto do limite de
  // URI do gateway.
  const [studiedTopicIds, saudeMap] = await Promise.all([
    getStudiedTopicIds(),
    getSaudeMap(linkedIds),
  ]);

  const coveredSet = new Set(
    linkedIds.filter((id) => studiedTopicIds.has(id)),
  );
  const covered = coveredSet.size;
  const mastered = linkedIds.filter(
    (id) => coveredSet.has(id) && (saudeMap[id] ?? 0) >= LIMIAR_DOMINIO,
  ).length;

  const inProgress = covered - mastered;
  const notStarted = total - covered;

  return {
    hasTarget: true,
    targetId: target.id,
    targetName,
    total,
    covered,
    mastered,
    inProgress,
    notStarted,
    pct: Math.round((covered / total) * 100),
    masteredPct: Math.round((mastered / total) * 100),
  };
}
