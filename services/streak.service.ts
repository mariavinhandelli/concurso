// services/streak.service.ts
// Calcula a constância (streak): dias consecutivos com estudo, contando de hoje
// (ou ontem) pra trás. Marca quais dias bateram a meta e o recorde anual.
// Regra: um dia só conta para a sequência se teve no mínimo 25 minutos de estudo
// (evita "foguinho vazio" — manter a sequência com poucos minutos de presença).

import { createClient } from '@/lib/supabase/client';
import { getDailyTarget } from '@/services/goals.service';

// Mínimo de estudo para um dia entrar na sequência (25 min = 1500 s).
const MIN_SEGUNDOS_DIA = 25 * 60;

// Um dia "conta" para o streak se atingiu o mínimo de minutos.
function diaConta(segundos: number): boolean {
  return segundos >= MIN_SEGUNDOS_DIA;
}

export interface DayStudy {
  date: string;        // 'YYYY-MM-DD'
  minutes: number;
  metGoal: boolean;    // bateu a meta diária?
}

export interface StreakInfo {
  current: number;          // dias consecutivos atuais
  longest: number;          // recorde: maior sequência (janela de 365 dias)
  studiedToday: boolean;    // já estudou hoje (atingindo o mínimo)?
  lastDays: DayStudy[];     // últimos ~30 dias (para a trilha visual)
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getStreak(): Promise<StreakInfo> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { current: 0, longest: 0, studiedToday: false, lastDays: [] };

  const dailyTarget = await getDailyTarget();

  // Busca logs dos últimos 365 dias — janela ampla para o recorde anual.
  const since = new Date();
  since.setDate(since.getDate() - 365);
  since.setHours(0, 0, 0, 0);

  const { data: logs, error } = await supabase
    .from('study_logs')
    .select('duration_sec, started_at')
    .eq('user_id', user.id)
    .gte('started_at', since.toISOString());

  if (error) throw new Error('Erro ao calcular constância: ' + error.message);

  // Soma segundos por dia.
  const byDay = new Map<string, number>();
  for (const log of logs ?? []) {
    const key = localDateStr(new Date(log.started_at));
    byDay.set(key, (byDay.get(key) ?? 0) + (log.duration_sec ?? 0));
  }

  const todayStr = localDateStr(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);

  // "Estudou hoje" agora exige atingir o mínimo de 25 min.
  const studiedToday = diaConta(byDay.get(todayStr) ?? 0);

  // Conta o streak atual: começa de hoje (se já bateu o mínimo) ou de ontem
  // (se ainda não bateu hoje, mas a sequência até ontem está viva).
  let current = 0;
  const cursor = new Date();
  if (!studiedToday) {
    if (diaConta(byDay.get(yesterdayStr) ?? 0)) {
      cursor.setDate(cursor.getDate() - 1);
    } else {
      cursor.setDate(cursor.getDate() - 2); // streak já quebrou
    }
  }
  while (diaConta(byDay.get(localDateStr(cursor)) ?? 0)) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Recorde: maior sequência de dias consecutivos válidos, em toda a janela.
  const diasComEstudo = Array.from(byDay.keys())
    .filter((k) => diaConta(byDay.get(k) ?? 0))
    .sort();
  let longest = 0;
  let run = 0;
  let anterior: Date | null = null;
  for (const key of diasComEstudo) {
    const [y, m, d] = key.split('-').map(Number);
    const atual = new Date(y, m - 1, d);
    if (anterior) {
      const diffDias = Math.round((atual.getTime() - anterior.getTime()) / 86400000);
      run = diffDias === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    anterior = atual;
  }
  longest = Math.max(longest, current); // recorde nunca é menor que o atual

  // Trilha dos últimos 30 dias (do mais antigo ao mais recente).
  // A trilha visual continua mostrando os minutos reais — quem decide a cor é o
  // componente. (O mínimo de 25 min vale para a CONTAGEM da sequência, não para
  // exibir o histórico.)
  const lastDays: DayStudy[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const sec = byDay.get(key) ?? 0;
    const min = Math.round(sec / 60);
    lastDays.push({
      date: key,
      minutes: min,
      metGoal: dailyTarget > 0 && min >= dailyTarget,
    });
  }

  return { current, longest, studiedToday, lastDays };
}