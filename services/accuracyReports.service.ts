// services/accuracyReports.service.ts
// Agrega acertos por matéria, a partir das sessões de QUESTÕES que têm
// matéria vinculada e questões registradas.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface AccuracyPoint {
  subjectId: string;   // para ações (reforçar / abrir a matéria)
  subjectName: string;
  total: number;       // questões feitas na matéria
  correct: number;     // acertos
  pct: number;         // % de acerto (0-100)
  color: string;       // cor pastel da matéria
}

interface AccuracyRow {
  subject_id: string;
  subject_name: string;
  subject_color: string;
  total: number | null;
  correct: number | null;
}

// undefined = todo o histórico (comportamento original). Um número filtra aos
// últimos N dias — para responder "como ANDO agora", não só "como fui sempre".
//
// Auditoria de performance (02/08) — antes buscava study_logs cru sem
// `.limit()` + query separada de subjects, e somava por disciplina em JS.
// get_accuracy_by_subject (migration 20260802224000) já agrupa no servidor;
// o corte de data continua calculado aqui (mesma meia-noite local de sempre)
// e só é passado pronto pra RPC, sem mudar o comportamento.
export async function getAccuracyBySubject(dias?: number): Promise<AccuracyPoint[]> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return [];

  let since: string | null = null;
  if (dias) {
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    corte.setHours(0, 0, 0, 0);
    since = corte.toISOString();
  }

  const { data: rows, error } = await supabase.rpc('get_accuracy_by_subject', { p_since: since });
  if (error) throw new Error('Erro ao buscar acertos: ' + error.message);
  if (!rows || rows.length === 0) return [];

  const points: AccuracyPoint[] = (rows as AccuracyRow[]).map((r) => {
    const total = r.total ?? 0;
    const correct = r.correct ?? 0;
    return {
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      total,
      correct,
      pct: total === 0 ? 0 : Math.round((correct / total) * 100),
      color: r.subject_color,
    };
  });

  // Ordenados por % de acerto (pior primeiro = prioridade).
  points.sort((a, b) => a.pct - b.pct);
  return points;
}
