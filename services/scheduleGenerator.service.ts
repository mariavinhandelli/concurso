// services/scheduleGenerator.service.ts
// CÉREBRO DO GERADOR. Lê os pesos das matérias de um edital, normaliza, aplica
// piso mínimo, e distribui o tempo. Não cria nada — devolve uma prévia testável.

import { requireUser, tryGetUser } from '@/lib/supabase/requireUser';

export interface GeneratorSubject {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  weight: number;
  sharePct: number;
  minutesPerCycle: number;
}

export interface GeneratorPreview {
  targetExamId: string;
  subjects: GeneratorSubject[];
  totalMinutes: number;
}

const PISO_MIN = 30;

export async function buildPreview(
  targetExamId: string,
  totalMinutes: number,
): Promise<GeneratorPreview> {
  const { supabase, userId } = await requireUser();

  const { data: blueprints, error } = await supabase
    .from('exam_blueprints')
    .select('subject_id, weight, subjects(name, color)')
    .eq('target_exam_id', targetExamId)
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao ler pesos: ' + error.message);

  const rows = (blueprints ?? []).map((b) => {
    const subj = Array.isArray(b.subjects) ? b.subjects[0] : b.subjects;
    return {
      subjectId: b.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      subjectColor: subj?.color ?? '#C9B8DD',
      weight: Number(b.weight) || 0,
    };
  }).filter((r) => r.weight > 0);

  const somaPesos = rows.reduce((s, r) => s + r.weight, 0);
  if (somaPesos === 0 || rows.length === 0) {
    return { targetExamId, subjects: [], totalMinutes: 0 };
  }

  // 1) Distribuição proporcional bruta.
  let subjects: GeneratorSubject[] = rows.map((r) => {
    const sharePct = (r.weight / somaPesos) * 100;
    const raw = (r.weight / somaPesos) * totalMinutes;
    return { subjectId: r.subjectId, subjectName: r.subjectName, subjectColor: r.subjectColor, weight: r.weight, sharePct, minutesPerCycle: raw };
  });

  // 2) Aplica piso mínimo e redistribui o excedente.
  const abaixo = subjects.filter((s) => s.minutesPerCycle < PISO_MIN);
  if (abaixo.length > 0) {
    const deficit = abaixo.reduce((s, x) => s + (PISO_MIN - x.minutesPerCycle), 0);
    const acima = subjects.filter((s) => s.minutesPerCycle >= PISO_MIN);
    const somaAcima = acima.reduce((s, x) => s + x.minutesPerCycle, 0);
    subjects = subjects.map((s) => {
      if (s.minutesPerCycle < PISO_MIN) return { ...s, minutesPerCycle: PISO_MIN };
      const corte = somaAcima > 0 ? (s.minutesPerCycle / somaAcima) * deficit : 0;
      return { ...s, minutesPerCycle: Math.max(PISO_MIN, s.minutesPerCycle - corte) };
    });
  }

  // 3) Arredonda pra múltiplos de 5min.
  subjects = subjects.map((s) => ({ ...s, minutesPerCycle: Math.round(s.minutesPerCycle / 5) * 5 }));

  const totalFinal = subjects.reduce((s, x) => s + x.minutesPerCycle, 0);
  return { targetExamId, subjects, totalMinutes: totalFinal };
}

export async function listTargetExams(): Promise<{ id: string; label: string }[]> {
  const ctx = await tryGetUser();
  if (!ctx) return [];
  const { supabase, userId } = ctx;

  const { data } = await supabase
    .from('target_exams')
    .select('id, board_id, cargo, orgao, is_primary')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });

  const { data: boards } = await supabase.from('exam_boards').select('id, name');
  const boardMap: Record<string, string> = {};
  for (const b of boards ?? []) boardMap[b.id] = b.name;

  return (data ?? []).map((t) => {
    const bancaNome = t.board_id ? boardMap[t.board_id] ?? null : null;
    return {
      id: t.id,
      label: [t.orgao, t.cargo, bancaNome].filter(Boolean).join(' · ') || 'Edital',
    };
  });
}
