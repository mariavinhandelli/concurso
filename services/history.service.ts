// services/history.service.ts
// Histórico de sessões de estudo (leitura pura de study_logs). Busca as sessões
// de uma janela de dias, cruza com os nomes das matérias e agrupa por dia.

import { createClient } from '@/lib/supabase/client';

export interface HistorySession {
  id: string;
  subjectName: string;
  subjectColor: string;
  mode: string | null;
  startedAt: string;        // ISO
  durationSec: number;
  questionsTotal: number;
  questionsCorrect: number;
  energyLevel: number | null;   // 1..5
  qualitativeFeedback: string | null;
  insight: string | null;
}

export interface HistoryDay {
  dateKey: string;          // 'YYYY-MM-DD' (local)
  sessions: HistorySession[];
  totalSec: number;         // soma do dia
  totalQuestions: number;   // soma do dia
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Busca o histórico dos últimos `dias` dias, agrupado por dia (mais recente primeiro).
export async function getHistory(dias: number): Promise<HistoryDay[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - dias);
  since.setHours(0, 0, 0, 0);

  const { data: logs, error } = await supabase
    .from('study_logs')
    .select('id, subject_id, mode, started_at, duration_sec, questions_total, questions_correct, energy_level, qualitative_feedback, insight')
    .eq('user_id', user.id)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false });

  if (error) throw new Error('Erro ao carregar histórico: ' + error.message);

  // Mapa de matérias (id → nome, cor) para resolver os nomes.
  const { data: subjects } = await supabase
    .from('subjects').select('id, name, color').eq('user_id', user.id);
  const subjMap: Record<string, { name: string; color: string }> = {};
  for (const s of subjects ?? []) {
    subjMap[s.id] = { name: s.name, color: s.color ?? '#6BA89A' };
  }

  // Monta as sessões já com nome de matéria resolvido.
  const sessions: HistorySession[] = (logs ?? []).map((l) => {
    const subj = l.subject_id ? subjMap[l.subject_id] : null;
    return {
      id: l.id,
      subjectName: subj?.name ?? 'Sessão avulsa',
      subjectColor: subj?.color ?? '#AEA99D',
      mode: l.mode ?? null,
      startedAt: l.started_at,
      durationSec: l.duration_sec ?? 0,
      questionsTotal: l.questions_total ?? 0,
      questionsCorrect: l.questions_correct ?? 0,
      energyLevel: l.energy_level ?? null,
      qualitativeFeedback: l.qualitative_feedback ?? null,
      insight: l.insight ?? null,
    };
  });

  // Agrupa por dia (chave de data local do started_at).
  const dayMap = new Map<string, HistoryDay>();
  for (const s of sessions) {
    const key = localDateStr(new Date(s.startedAt));
    if (!dayMap.has(key)) {
      dayMap.set(key, { dateKey: key, sessions: [], totalSec: 0, totalQuestions: 0 });
    }
    const day = dayMap.get(key)!;
    day.sessions.push(s);
    day.totalSec += s.durationSec;
    day.totalQuestions += s.questionsTotal;
  }

  // Já vem ordenado (logs desc), então os dias saem do mais recente ao mais antigo.
  return Array.from(dayMap.values());
}