// services/accuracyReports.service.ts
// Agrega acertos por matéria, a partir das sessões de QUESTÕES que têm
// matéria vinculada e questões registradas.

import { createClient } from '@/lib/supabase/client';

export interface AccuracyPoint {
  subjectName: string;
  total: number;       // questões feitas na matéria
  correct: number;     // acertos
  pct: number;         // % de acerto (0-100)
  color: string;       // cor pastel da matéria
}

export async function getAccuracyBySubject(): Promise<AccuracyPoint[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Busca logs de questões com matéria e ao menos 1 questão registrada.
  const { data: logs, error } = await supabase
    .from('study_logs')
    .select('subject_id, questions_total, questions_correct')
    .eq('user_id', user.id)
    .eq('mode', 'questoes')
    .not('subject_id', 'is', null)
    .gt('questions_total', 0);

  if (error) throw new Error('Erro ao buscar acertos: ' + error.message);
  if (!logs || logs.length === 0) return [];

  // Busca nomes e cores das matérias envolvidas.
  const { data: subjects, error: subjectsError } = await supabase
    .from('subjects')
    .select('id, name, color')
    .eq('user_id', user.id);
  if (subjectsError) throw new Error('Erro ao buscar matérias: ' + subjectsError.message);

  const subjectMap = new Map(
    (subjects ?? []).map((s) => [s.id, { name: s.name, color: s.color }]),
  );

  // Soma total e acertos por matéria.
  const agg = new Map<string, { total: number; correct: number }>();
  for (const log of logs) {
    const key = log.subject_id as string;
    const cur = agg.get(key) ?? { total: 0, correct: 0 };
    cur.total += log.questions_total ?? 0;
    cur.correct += log.questions_correct ?? 0;
    agg.set(key, cur);
  }

  // Monta os pontos, ordenados por % de acerto (pior primeiro = prioridade).
  const points: AccuracyPoint[] = [];
  for (const [subjectId, { total, correct }] of agg.entries()) {
    const info = subjectMap.get(subjectId);
    points.push({
      subjectName: info?.name ?? 'Matéria',
      total,
      correct,
      pct: total === 0 ? 0 : Math.round((correct / total) * 100),
      color: info?.color ?? '#C9B8DD',
    });
  }

  points.sort((a, b) => a.pct - b.pct);
  return points;
}
