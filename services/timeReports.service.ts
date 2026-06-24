// services/timeReports.service.ts
// Agrega o tempo estudado em baldes (dia/semana/mês/ano) para o gráfico.
// Por ora soma no navegador; se o volume crescer muito, migra-se p/ o banco.

import { createClient } from '@/lib/supabase/client';
import { getDailyTarget } from '@/services/goals.service';

export type Granularity = 'dia' | 'semana' | 'mes' | 'ano';

export interface TimePoint {
  label: string;       // rótulo do eixo X (ex: "12/06", "Sem 24", "Jun", "2026")
  minutes: number;     // minutos estudados no balde
  targetMinutes: number; // meta correspondente ao balde
}

// Quantos baldes mostrar e quantos dias cada filtro abrange.
const CONFIG: Record<Granularity, { buckets: number; daysBack: number }> = {
  dia:    { buckets: 14, daysBack: 14 },   // últimos 14 dias
  semana: { buckets: 12, daysBack: 84 },   // últimas 12 semanas
  mes:    { buckets: 12, daysBack: 365 },  // últimos 12 meses
  ano:    { buckets: 5,  daysBack: 365 * 5 }, // últimos 5 anos
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Gera a chave do balde a que uma data pertence, conforme a granularidade.
function bucketKey(d: Date, g: Granularity): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (g === 'ano') return `${y}`;
  if (g === 'mes') return `${y}-${m}`;
  if (g === 'semana') {
    // Semana ISO aproximada: ano + número da semana.
    const onejan = new Date(y, 0, 1);
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  }
  return `${y}-${m}-${day}`; // dia
}

// Rótulo amigável para exibir no eixo X.
function bucketLabel(d: Date, g: Granularity): string {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (g === 'ano') return `${d.getFullYear()}`;
  if (g === 'mes') return meses[d.getMonth()];
  if (g === 'semana') {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

// Quantos dias cada balde representa (para calcular a meta do balde).
const DAYS_PER_BUCKET: Record<Granularity, number> = {
  dia: 1, semana: 7, mes: 30, ano: 365,
};

export async function getTimeSeries(g: Granularity): Promise<TimePoint[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { buckets, daysBack } = CONFIG[g];
  const dailyTarget = await getDailyTarget();

  // Início do período (00:00 de daysBack dias atrás).
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - daysBack);

  const { data: logs, error } = await supabase
    .from('study_logs')
    .select('duration_sec, started_at')
    .eq('user_id', user.id)
    .gte('started_at', since.toISOString());

  if (error) throw new Error('Erro ao buscar histórico: ' + error.message);

  // Soma os minutos por chave de balde.
  const totals = new Map<string, number>();
  for (const log of logs ?? []) {
    const d = new Date(log.started_at);
    const key = bucketKey(d, g);
    totals.set(key, (totals.get(key) ?? 0) + (log.duration_sec ?? 0));
  }

  // Monta os baldes em ordem cronológica (do mais antigo ao mais recente).
  const points: TimePoint[] = [];
  const cursor = new Date();
  for (let i = buckets - 1; i >= 0; i--) {
    const d = new Date(cursor);
    if (g === 'dia') d.setDate(d.getDate() - i);
    else if (g === 'semana') d.setDate(d.getDate() - i * 7);
    else if (g === 'mes') d.setMonth(d.getMonth() - i);
    else if (g === 'ano') d.setFullYear(d.getFullYear() - i);

    const key = bucketKey(d, g);
    const sec = totals.get(key) ?? 0;
    points.push({
      label: bucketLabel(d, g),
      minutes: Math.round(sec / 60),
      targetMinutes: dailyTarget * DAYS_PER_BUCKET[g],
    });
  }

  return points;
}