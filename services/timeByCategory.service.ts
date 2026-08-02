// services/timeByCategory.service.ts
// Agrega o tempo de estudo por disciplina num período (dia/semana/mês/total),
// com navegação por offset (0 = atual, -1 = anterior, etc.).

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

// 'custom' = intervalo escolhido no calendário (duas datas livres). Ignora o
// offset — quem navega são as datas.
export type PeriodView = 'dia' | 'semana' | 'mes' | 'total' | 'custom';

export interface DateRange {
  start: string; // 'YYYY-MM-DD' (local)
  end: string;   // 'YYYY-MM-DD' (local, inclusivo)
}

export interface CategorySlice {
  subjectId: string;
  subjectName: string;
  color: string;
  minutes: number;
}

export interface TimeByCategoryResult {
  slices: CategorySlice[];
  totalMinutes: number;
  periodLabel: string;     // ex: "16/06", "9–15/jun", "junho 2026", "todo o período"
  canGoForward: boolean;   // false quando já está no período atual
}

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function toIsoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Calcula o intervalo [início, fim] do período, dado a visão e o offset.
function periodRange(view: PeriodView, offset: number, range?: DateRange): { start: Date; end: Date; label: string; canGoForward: boolean } {
  const hoje = new Date();

  if (view === 'custom') {
    // Datas locais montadas componente a componente: `new Date('2026-08-01')`
    // é interpretado como UTC e, em fuso negativo, volta um dia.
    const parse = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1);
    };
    const a = parse(range?.start ?? toIsoDay(hoje));
    const b = parse(range?.end ?? toIsoDay(hoje));
    // Datas invertidas pelo usuário: normaliza em vez de devolver período vazio.
    const [ini, fim] = a <= b ? [a, b] : [b, a];
    return {
      start: startOfDay(ini), end: endOfDay(fim),
      label: fmtDay(ini) === fmtDay(fim) ? fmtDay(ini) : `${fmtDay(ini)}–${fmtDay(fim)}`,
      canGoForward: false,
    };
  }

  if (view === 'total') {
    const start = new Date(2000, 0, 1);
    return { start, end: endOfDay(hoje), label: 'todo o período', canGoForward: false };
  }

  if (view === 'dia') {
    const d = new Date(hoje);
    d.setDate(d.getDate() + offset);
    return {
      start: startOfDay(d), end: endOfDay(d),
      label: offset === 0 ? 'hoje' : fmtDay(d),
      canGoForward: offset < 0,
    };
  }

  if (view === 'semana') {
    // semana começa no domingo
    const base = new Date(hoje);
    base.setDate(base.getDate() + offset * 7);
    const diaSemana = base.getDay(); // 0=dom
    const inicio = startOfDay(new Date(base));
    inicio.setDate(inicio.getDate() - diaSemana);
    const fim = endOfDay(new Date(inicio));
    fim.setDate(fim.getDate() + 6);
    return {
      start: inicio, end: fim,
      label: `${fmtDay(inicio)}–${fmtDay(fim)}`,
      canGoForward: offset < 0,
    };
  }

  // mês
  const m = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
  const inicio = startOfDay(m);
  const fim = endOfDay(new Date(m.getFullYear(), m.getMonth() + 1, 0));
  return {
    start: inicio, end: fim,
    label: m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    canGoForward: offset < 0,
  };
}

export async function getTimeByCategory(
  view: PeriodView, offset: number, range?: DateRange,
): Promise<TimeByCategoryResult> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return { slices: [], totalMinutes: 0, periodLabel: '', canGoForward: false };

  const { start, end, label, canGoForward } = periodRange(view, offset, range);

  // Auditoria de performance (02/08) — antes buscava study_logs cru (com join
  // subjects) sem `.limit()`; na visão "total" (desde 2000) uma conta antiga
  // podia puxar dezenas de milhares de linhas. get_time_by_category já soma
  // por disciplina no servidor (migration 20260802223000) — o resultado é do
  // tamanho do nº de disciplinas, não do nº de sessões.
  const { data: rows, error } = await supabase.rpc('get_time_by_category', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) throw new Error('Erro ao agregar tempo: ' + error.message);

  // Sessões SEM matéria (revisões passivas, simulados de VM) entram numa
  // fatia própria — antes eram descartadas e o card dizia "nenhum estudo"
  // enquanto o Ritmo, na mesma página, contava a sessão. A mesma fonte não
  // pode dar duas respostas.
  const SEM_MATERIA_ID = '__sem_materia__';
  const porSubject = new Map<string, { name: string; color: string; sec: number }>();
  type TimeByCategoryRow = { subject_id: string | null; subject_name: string | null; subject_color: string | null; seconds: number | null };
  for (const row of (rows ?? []) as TimeByCategoryRow[]) {
    const key = row.subject_id ?? SEM_MATERIA_ID;
    porSubject.set(key, row.subject_id
      ? { name: row.subject_name ?? 'Sem matéria', color: row.subject_color ?? '#C9B8DD', sec: row.seconds ?? 0 }
      : { name: 'Revisões e treinos', color: '#94A3B8', sec: row.seconds ?? 0 }); // cinza neutro (dado dinâmico do gráfico)
  }

  const slices: CategorySlice[] = Array.from(porSubject.entries())
    .map(([subjectId, v]) => ({
      subjectId, subjectName: v.name, color: v.color,
      minutes: Math.round(v.sec / 60),
    }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = slices.reduce((s, x) => s + x.minutes, 0);

  return { slices, totalMinutes, periodLabel: label, canGoForward };
}