// supabase/functions/monthly-narrative/index.ts
// M6 — narrativa do mês. Transforma os números do MÊS COMPLETO anterior numa
// leitura de 2-4 frases em segunda pessoa. A IA REDIGE, nunca calcula: todos
// os números são computados aqui (deterministicamente) e entram no prompt; o
// texto gerado passa por um juiz que confere se nenhum número foi inventado.
// Roda dia 1 de cada mês via pg_cron; idempotente por (user_id, month).
//
// Segredo necessário: ANTHROPIC_API_KEY (mesmo secret das outras functions).

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const BATCH_SIZE = 30;           // usuários por execução — folga enorme hoje
const MIN_MINUTES_MES = 15;      // menos que isso não há mês a narrar

// Push "sua leitura está pronta" — mesmo VAPID dos lembretes diários.
// Best-effort: sem chave ou sem inscrição, a narrativa é gravada do mesmo jeito.
const VAPID_PUBLIC = 'BBgjY2251ulxouwlZRKBWC4cMXfWWU4gyUpwHEnBcZxQrl8S0nTdjIvvYZ-KKJ7QCWXGEpIwWM6krSHew1mIKHE';
const VAPID_SUBJECT = 'mailto:mariavinhandelli@gmail.com';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface MonthStats {
  minutos: number;
  diasAtivos: number;
  questoes: number;
  acertoPct: number | null;
  badges: string[];            // labels desbloqueadas no mês
  // deltas vs. mês anterior (null = mês anterior sem atividade)
  deltaMinutos: number | null;
  deltaDiasAtivos: number | null;
  deltaAcertoPp: number | null;
}

const NARRATIVE_SCHEMA = {
  type: 'object',
  properties: {
    frases: {
      type: 'array',
      items: { type: 'string' },
      // A API de output estruturado não aceita limites de itens em arrays —
      // os limites (2 a 4 frases) são impostos no código: piso rejeita, teto
      // corta com slice(0, 4). O prompt pede 2-4.
    },
  },
  required: ['frases'],
  additionalProperties: false,
};

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    fiel: { type: 'boolean' },
    justificativa: { type: 'string' },
  },
  required: ['fiel', 'justificativa'],
  additionalProperties: false,
};

let lastError: string | null = null;

async function callClaude(
  model: string,
  system: string,
  userText: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userText }],
      output_config: { format: { type: 'json_schema', schema } },
      thinking: { type: 'disabled' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Claude API ${res.status}: ${text}`);
    if (!lastError) lastError = `HTTP ${res.status}: ${text.slice(0, 500)}`;
    return null;
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    if (!lastError) lastError = 'refusal';
    return null;
  }
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock) {
    if (!lastError) lastError = `sem bloco de texto: ${JSON.stringify(data).slice(0, 500)}`;
    return null;
  }
  try {
    return JSON.parse(textBlock.text);
  } catch {
    if (!lastError) lastError = `JSON inválido: ${textBlock.text.slice(0, 500)}`;
    return null;
  }
}

// Data local de São Paulo de um timestamp ISO (dias ativos contam no fuso da usuária).
function spDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

interface LogRow {
  user_id: string;
  started_at: string;
  duration_sec: number | null;
  questions_total: number | null;
  questions_correct: number | null;
}

function aggregate(rows: LogRow[]): Omit<MonthStats, 'badges' | 'deltaMinutos' | 'deltaDiasAtivos' | 'deltaAcertoPp'> {
  let sec = 0, q = 0, c = 0;
  const dias = new Set<string>();
  for (const r of rows) {
    sec += r.duration_sec ?? 0;
    q += r.questions_total ?? 0;
    c += r.questions_correct ?? 0;
    if ((r.duration_sec ?? 0) > 0) dias.add(spDate(r.started_at));
  }
  return {
    minutos: Math.round(sec / 60),
    diasAtivos: dias.size,
    questoes: q,
    acertoPct: q > 0 ? Math.round((c / q) * 100) : null,
  };
}

function statsText(mesLabel: string, s: MonthStats): string {
  const linhas = [
    `Mês: ${mesLabel}`,
    `Minutos estudados: ${s.minutos}`,
    `Dias com estudo: ${s.diasAtivos}`,
    `Questões respondidas: ${s.questoes}`,
    s.acertoPct !== null ? `Acerto em questões: ${s.acertoPct}%` : 'Acerto em questões: (não fez questões)',
    s.badges.length > 0 ? `Conquistas desbloqueadas no mês: ${s.badges.join(', ')}` : 'Conquistas desbloqueadas no mês: nenhuma',
  ];
  if (s.deltaMinutos !== null) linhas.push(`Variação de minutos vs. mês anterior: ${s.deltaMinutos >= 0 ? '+' : ''}${s.deltaMinutos}`);
  if (s.deltaDiasAtivos !== null) linhas.push(`Variação de dias ativos vs. mês anterior: ${s.deltaDiasAtivos >= 0 ? '+' : ''}${s.deltaDiasAtivos}`);
  if (s.deltaAcertoPp !== null) linhas.push(`Variação de acerto vs. mês anterior: ${s.deltaAcertoPp >= 0 ? '+' : ''}${s.deltaAcertoPp} pontos percentuais`);
  return linhas.join('\n');
}

async function generateNarrative(mesLabel: string, s: MonthStats) {
  return callClaude(
    'claude-haiku-4-5',
    'Você escreve, em português do Brasil, uma leitura mensal curta para uma estudante de concursos públicos. ' +
      'Regras invioláveis: use SOMENTE os números fornecidos — nunca invente números, matérias, comparações ou ' +
      'fatos; fale em segunda pessoa ("você"); tom honesto e encorajador, sem bajulação e sem drama; se o mês ' +
      'foi fraco, reconheça com gentileza e aponte o recomeço; 2 a 4 frases curtas, sem emojis, sem exclamações em excesso.',
    `Números do mês (fonte única e completa — nada além disto existe):\n${statsText(mesLabel, s)}\n\n` +
      'Escreva a leitura do mês.',
    NARRATIVE_SCHEMA,
  );
}

async function judgeNarrative(mesLabel: string, s: MonthStats, frases: string[]) {
  return callClaude(
    'claude-haiku-4-5',
    'Você verifica se um texto sobre estatísticas de estudo é fiel aos números fornecidos, sem inventar nada.',
    `Números reais:\n${statsText(mesLabel, s)}\n\nTexto gerado:\n"${frases.join(' ')}"\n\n` +
      'O texto menciona APENAS números/fatos presentes na lista (ou arredondamentos triviais deles, como horas a ' +
      'partir de minutos)? fiel=false se qualquer número, matéria ou fato não constar da lista.',
    JUDGE_SCHEMA,
  );
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Avisa "sua leitura está pronta": sino (canal principal, sempre) + push pra
// quem tem assinatura de navegador (canal secundário, best-effort).
async function pushLeituraPronta(userId: string, mesLabel: string): Promise<void> {
  const title = `Sua leitura de ${mesLabel.split(' ')[0]} está pronta`;
  const body = 'Como foi seu mês de estudos, em poucas frases — a partir dos seus números.';
  const link = '/progresso';

  try {
    await supabase.from('notifications').insert({ user_id: userId, type: 'narrative_ready', title, body, link });
  } catch (e) {
    console.error(`Aviso da leitura no sino falhou (${userId}):`, e);
  }

  if (!VAPID_PRIVATE) return;
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (!subs?.length) return;
    const payload = JSON.stringify({ title, body, url: link, tag: 'focali-leitura-mes' });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode ?? 0;
        // inscrição morta (mesma limpeza do send-daily-reminders)
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  } catch (e) {
    console.error(`Push da leitura falhou (${userId}):`, e);
  }
}

Deno.serve(async () => {
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), { status: 500 });
  }
  if (VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // Mês COMPLETO anterior (UTC é suficiente para bordas de mês aqui: o cron
  // roda dia 1 às 07:30 UTC, horas depois da virada em qualquer fuso BR).
  const now = new Date();
  const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const firstPrevPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const month = firstPrev.toISOString().slice(0, 7); // 'YYYY-MM'
  const mesLabel = `${MESES[firstPrev.getUTCMonth()]} de ${firstPrev.getUTCFullYear()}`;

  // Logs dos DOIS meses (alvo + anterior, para os deltas) numa leitura só.
  const { data: logs, error: logsError } = await supabase
    .from('study_logs')
    .select('user_id, started_at, duration_sec, questions_total, questions_correct')
    .gte('started_at', firstPrevPrev.toISOString())
    .lt('started_at', firstThis.toISOString());
  if (logsError) {
    return new Response(JSON.stringify({ error: logsError.message }), { status: 500 });
  }

  const alvoPorUser = new Map<string, LogRow[]>();
  const prevPorUser = new Map<string, LogRow[]>();
  const cutoff = firstPrev.toISOString();
  for (const l of (logs ?? []) as LogRow[]) {
    const mapa = l.started_at >= cutoff ? alvoPorUser : prevPorUser;
    if (!mapa.has(l.user_id)) mapa.set(l.user_id, []);
    mapa.get(l.user_id)!.push(l);
  }

  // Já narrados este mês (idempotência).
  const { data: done } = await supabase
    .from('monthly_narratives')
    .select('user_id')
    .eq('month', month);
  const jaFeitos = new Set((done ?? []).map((d) => d.user_id as string));

  let created = 0, skipped = 0, failed = 0;
  const userIds = [...alvoPorUser.keys()].filter((u) => !jaFeitos.has(u)).slice(0, BATCH_SIZE);

  for (const userId of userIds) {
    const base = aggregate(alvoPorUser.get(userId)!);
    if (base.minutos < MIN_MINUTES_MES) { skipped++; continue; }

    const prev = prevPorUser.has(userId) ? aggregate(prevPorUser.get(userId)!) : null;
    const temPrev = !!prev && (prev.minutos > 0 || prev.diasAtivos > 0);

    // Conquistas desbloqueadas dentro do mês narrado.
    const { data: badgeRows } = await supabase
      .from('user_badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', userId)
      .gte('unlocked_at', firstPrev.toISOString())
      .lt('unlocked_at', firstThis.toISOString());

    const stats: MonthStats = {
      ...base,
      badges: (badgeRows ?? []).map((b) => b.badge_id as string),
      deltaMinutos: temPrev ? base.minutos - prev!.minutos : null,
      deltaDiasAtivos: temPrev ? base.diasAtivos - prev!.diasAtivos : null,
      deltaAcertoPp: temPrev && base.acertoPct !== null && prev!.acertoPct !== null
        ? base.acertoPct - prev!.acertoPct
        : null,
    };

    const gen = await generateNarrative(mesLabel, stats);
    const frases = ((gen?.frases as string[] | undefined) ?? []).slice(0, 4);
    if (frases.length < 2) { failed++; continue; }

    const veredito = await judgeNarrative(mesLabel, stats, frases);
    if (!veredito || veredito.fiel !== true) {
      console.error(`Narrativa reprovada pelo juiz (${userId}): ${veredito?.justificativa ?? 'sem retorno'}`);
      failed++;
      continue;
    }

    const { error: insError } = await supabase
      .from('monthly_narratives')
      .insert({ user_id: userId, month, frases, stats, model: 'claude-haiku-4-5' });
    if (insError) {
      console.error(`Insert falhou (${userId}): ${insError.message}`);
      failed++;
      continue;
    }
    created++;

    // Retenção: quem tem push ativo fica sabendo que a leitura chegou.
    await pushLeituraPronta(userId, mesLabel);
  }

  return new Response(
    JSON.stringify({ month, created, skipped, failed, lastError }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
