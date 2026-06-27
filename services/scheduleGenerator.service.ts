// services/scheduleGenerator.service.ts
// CÉREBRO DO GERADOR. Lê os pesos das matérias de um edital, normaliza, aplica
// piso mínimo, e distribui o tempo. Não cria nada — devolve uma prévia testável.

import { createClient } from '@/lib/supabase/client';

export interface GeneratorSubject {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  weight: number;
  sharePct: number;        // fatia proporcional (0-100)
  minutesPerCycle: number; // tempo atribuído (por volta do ciclo OU por semana)
}

export interface GeneratorPreview {
  targetExamId: string;
  subjects: GeneratorSubject[];
  totalMinutes: number;       // soma do tempo distribuído
  examDate: string | null;    // data da prova (se houver)
  daysUntilExam: number | null;
}

const PISO_MIN = 30; // piso mínimo por matéria

// Lê os pesos do edital e monta a prévia de distribuição.
// totalMinutes = quanto tempo total distribuir (por ciclo/semana, definido pela tela).
export async function buildPreview(
  targetExamId: string,
  totalMinutes: number,
): Promise<GeneratorPreview> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  // Pesos das matérias do edital.
  const { data: blueprints, error } = await supabase
    .from('exam_blueprints')
    .select('subject_id, weight, subjects(name, color)')
    .eq('target_exam_id', targetExamId)
    .eq('user_id', user.id);

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

  // Data da prova (via exam_targets, ligado por... precisa do vínculo).
  // target_exams não tem data; a data está em exam_targets. Buscamos se houver slug/legacy.
  const examDate: string | null = null;
  const daysUntilExam: number | null = null;
  // (a data é resolvida na tela; aqui deixamos null por ora — ver nota)

  const somaPesos = rows.reduce((s, r) => s + r.weight, 0);
  if (somaPesos === 0 || rows.length === 0) {
    return { targetExamId, subjects: [], totalMinutes: 0, examDate, daysUntilExam };
  }

  // 1) Distribuição proporcional bruta.
  let subjects: GeneratorSubject[] = rows.map((r) => {
    const sharePct = (r.weight / somaPesos) * 100;
    const raw = (r.weight / somaPesos) * totalMinutes;
    return {
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      subjectColor: r.subjectColor,
      weight: r.weight,
      sharePct,
      minutesPerCycle: raw,
    };
  });

  // 2) Aplica piso mínimo e redistribui o excedente.
  // Matérias abaixo do piso sobem pra 30min; o que falta é tirado proporcionalmente das acima.
  const abaixo = subjects.filter((s) => s.minutesPerCycle < PISO_MIN);
  if (abaixo.length > 0) {
    const deficit = abaixo.reduce((s, x) => s + (PISO_MIN - x.minutesPerCycle), 0);
    const acima = subjects.filter((s) => s.minutesPerCycle >= PISO_MIN);
    const somaAcima = acima.reduce((s, x) => s + x.minutesPerCycle, 0);

    subjects = subjects.map((s) => {
      if (s.minutesPerCycle < PISO_MIN) {
        return { ...s, minutesPerCycle: PISO_MIN };
      }
      // tira proporcionalmente o déficit das de cima
      const corte = somaAcima > 0 ? (s.minutesPerCycle / somaAcima) * deficit : 0;
      return { ...s, minutesPerCycle: Math.max(PISO_MIN, s.minutesPerCycle - corte) };
    });
  }

  // 3) Arredonda pra múltiplos de 5min (mais limpo).
  subjects = subjects.map((s) => ({
    ...s,
    minutesPerCycle: Math.round(s.minutesPerCycle / 5) * 5,
  }));

  const totalFinal = subjects.reduce((s, x) => s + x.minutesPerCycle, 0);

  return { targetExamId, subjects, totalMinutes: totalFinal, examDate, daysUntilExam };
}

// Lista os editais disponíveis (pra escolher no gerador).
export async function listTargetExams(): Promise<{ id: string; label: string }[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('target_exams')
    .select('id, board_id, cargo, orgao, is_primary')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false });

  // Resolve o nome da banca por mapa (sem join, evita ambiguidade de FK).
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
