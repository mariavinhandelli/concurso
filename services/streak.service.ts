// services/streak.service.ts
// Calcula a constância (streak): dias consecutivos com estudo, contando de hoje
// (ou ontem) pra trás. Marca quais dias bateram a meta e o recorde anual.
// Regra: um dia só conta para a sequência se teve no mínimo 30 minutos de estudo
// (evita "foguinho vazio" — manter a sequência com poucos minutos de presença).

import { createClient } from '@/lib/supabase/client';
import { getDailyTarget } from '@/services/goals.service';
import { toLocalDateString as localDateStr } from '@/lib/local-date';

const MIN_SEGUNDOS_DIA = 30 * 60; // 30 min = sessão mínima produtiva (referência Tec Concursos / Gran Cursos)
const JANELA_PERDAO = 7;          // no máximo 1 folga perdoada ("escudo") a cada 7 dias

function diaConta(segundos: number): boolean {
  return segundos >= MIN_SEGUNDOS_DIA;
}

// Diferença em dias entre duas datas 'YYYY-MM-DD' (a - b).
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

export interface DayStudy {
  date: string;        // 'YYYY-MM-DD'
  minutes: number;
  metGoal: boolean;    // bateu a meta diária?
  forgiven?: boolean;  // folga "escudada": dia sem estudo perdoado na sequência atual
}

export interface StreakInfo {
  current: number;          // dias consecutivos atuais (folgas perdoadas não somam)
  longest: number;          // recorde: maior sequência (janela de 1095 dias)
  studiedToday: boolean;    // já estudou hoje (atingindo o mínimo)?
  lastDays: DayStudy[];     // últimos 60 dias (para a trilha visual)
  shieldUsed: boolean;      // a sequência atual foi salva por um escudo (folga perdoada)?
}

type SupabaseClient = ReturnType<typeof createClient>;

// QW5: aceita client + userId opcionais para evitar segundo getUser() quando chamado
// de dentro de getBadgeState() (que já fez getUser() no início).
export async function getStreak(_supabase?: SupabaseClient, _userId?: string): Promise<StreakInfo> {
  const supabase = _supabase ?? createClient();
  const uid = _userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { current: 0, longest: 0, studiedToday: false, lastDays: [], shieldUsed: false };

  // Janela de 3 anos para capturar recordes antigos sem perder histórico.
  const since = new Date();
  since.setDate(since.getDate() - 1095);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  // QW5: getDailyTarget corre em paralelo com o loop paginado.
  const dailyTargetPromise = getDailyTarget();

  // QW5: paginar para não depender do max_rows do PostgREST (padrão 1000).
  const PAGE_SIZE = 1000;
  type LogRow = { duration_sec: number | null; started_at: string };
  const allLogs: LogRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('study_logs')
      .select('duration_sec, started_at')
      .eq('user_id', uid)
      .gte('started_at', sinceIso)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error('Erro ao calcular constância: ' + error.message);
    if (!data || data.length === 0) break;
    allLogs.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  const dailyTarget = await dailyTargetPromise;

  // Soma segundos por dia.
  const byDay = new Map<string, number>();
  for (const log of allLogs) {
    const key = localDateStr(new Date(log.started_at));
    byDay.set(key, (byDay.get(key) ?? 0) + (log.duration_sec ?? 0));
  }

  const todayStr = localDateStr(new Date());
  const studiedToday = diaConta(byDay.get(todayStr) ?? 0);

  // Conta o streak atual COM PERDÃO ("escudo"): caminha de hoje (ou ontem, pois hoje
  // ainda é pendente) para trás. Um dia sem estudo é perdoado — faz ponte sem somar —
  // desde que (a) o dia anterior tenha estudo (nunca perdoa 2 faltas seguidas) e
  // (b) não haja outra folga perdoada nos últimos JANELA_PERDAO dias (1 folga/semana).
  let current = 0;
  const perdoados: string[] = [];
  const cursor = new Date();
  if (!studiedToday) cursor.setDate(cursor.getDate() - 1); // hoje pendente não quebra

  const podePerdoar = (): boolean => {
    const dataStr = localDateStr(cursor);
    // limite: no máximo 1 perdão a cada JANELA_PERDAO dias
    if (perdoados.some((p) => Math.abs(diasEntre(p, dataStr)) < JANELA_PERDAO)) return false;
    // nunca perdoa 2 faltas seguidas: o dia anterior precisa ter estudo
    const antes = new Date(cursor);
    antes.setDate(antes.getDate() - 1);
    return diaConta(byDay.get(localDateStr(antes)) ?? 0);
  };

  while (true) {
    const key = localDateStr(cursor);
    if (diaConta(byDay.get(key) ?? 0)) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (podePerdoar()) {
      perdoados.push(key);
      cursor.setDate(cursor.getDate() - 1); // ponte: não incrementa o contador
    } else {
      break;
    }
  }
  const perdoadosSet = new Set(perdoados);

  // Recorde: maior sequência de dias consecutivos válidos em toda a janela.
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

  // Trilha dos últimos 60 dias (do mais antigo ao mais recente).
  // StreakBar mostra 30 no mobile e 60 no desktop; fornecemos 60 para cobrir ambos.
  const lastDays: DayStudy[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    const sec = byDay.get(key) ?? 0;
    const min = Math.round(sec / 60);
    lastDays.push({
      date: key,
      minutes: min,
      metGoal: dailyTarget > 0 && min >= dailyTarget,
      forgiven: perdoadosSet.has(key),
    });
  }

  return { current, longest, studiedToday, lastDays, shieldUsed: perdoados.length > 0 };
}
