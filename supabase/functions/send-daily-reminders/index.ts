// supabase/functions/send-daily-reminders/index.ts
// N1 (web push) — disparo dos lembretes diários. Roda de hora em hora (pg_cron).
// Para cada usuário com lembrete ativo cujo horário local bate com a hora atual,
// que AINDA não estudou hoje e que ainda NÃO foi lembrado hoje, envia um push a
// todas as suas assinaturas. Idempotente por dia (settings.lastRemindedDate) —
// por isso é seguro rodar com verify_jwt=false: não há dado exposto nem spam.
// Assinaturas mortas (404/410) são removidas.
//
// Lembrete ÉTICO (referência Duolingo): a mensagem se adapta a quantos dias a
// pessoa está sem estudar e, após PAUSA_APOS_DIAS dias sendo ignorado, o
// lembrete avisa que vai se calar e se pausa sozinho (settings.reminderPaused).
// A pausa se desfaz automaticamente quando a pessoa volta a estudar — sem
// precisar mexer em configuração.
//
// HORÁRIO (IA invisível · Fase 1): quem escolheu a hora de propósito
// (settings.reminderHourManual) é respeitado sempre. Para o resto, o lembrete
// segue o horário de pico REAL de estudo aprendido pelo feature store
// (user_features.peak_hour, recalculado toda madrugada); sem amostra suficiente,
// cai no reminderHour legado e por fim nas 19h.
//
// Segredo necessário: VAPID_PRIVATE_KEY (via `supabase secrets set`).
// A chave pública e o subject não são segredos — ficam embutidos abaixo.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BBgjY2251ulxouwlZRKBWC4cMXfWWU4gyUpwHEnBcZxQrl8S0nTdjIvvYZ-KKJ7QCWXGEpIwWM6krSHew1mIKHE';
const VAPID_SUBJECT = 'mailto:mariavinhandelli@gmail.com';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function localHour(tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()));
  } catch {
    return new Date().getUTCHours();
  }
}
function localDateOf(when: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(when);
  } catch {
    return when.toISOString().slice(0, 10);
  }
}

Deno.serve(async () => {
  if (!VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY não configurada' }), { status: 500 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, settings')
    .contains('settings', { reminderEnabled: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Horário de pico aprendido (feature store) — uma query para todos os perfis.
  const ids = (profiles ?? []).map((p) => p.id);
  const peakByUser = new Map<string, number>();
  if (ids.length > 0) {
    const { data: feats } = await supabase
      .from('user_features')
      .select('user_id, peak_hour')
      .in('user_id', ids)
      .not('peak_hour', 'is', null);
    for (const f of feats ?? []) peakByUser.set(f.user_id, f.peak_hour as number);
  }

  let sent = 0, skipped = 0, cleaned = 0;

  const PAUSA_APOS_DIAS = 21; // ignorado por 3 semanas → última mensagem + silêncio

  for (const p of profiles ?? []) {
    const s = (p.settings ?? {}) as {
      reminderHour?: number; reminderTz?: string; lastRemindedDate?: string;
      reminderPaused?: boolean; firstRemindedDate?: string; reminderHourManual?: boolean;
    };
    const tz = s.reminderTz || 'America/Sao_Paulo';
    const legado = typeof s.reminderHour === 'number' ? s.reminderHour : 19;
    const aprendida = peakByUser.get(p.id);
    const hour = s.reminderHourManual === true
      ? legado
      : (typeof aprendida === 'number' ? aprendida : legado);
    const today = localDateOf(new Date(), tz);

    // Horário ainda não chegou, ou já foi lembrado hoje (idempotência).
    if (localHour(tz) !== hour || s.lastRemindedDate === today) { skipped++; continue; }

    // Já estudou hoje? Então não precisa de lembrete.
    const { data: last } = await supabase
      .from('study_logs').select('started_at')
      .eq('user_id', p.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
    const lastDate = last?.started_at ? localDateOf(new Date(last.started_at), tz) : null;
    if (lastDate === today) {
      // Voltou a estudar: se o lembrete estava auto-pausado, reativa sozinho.
      if (s.reminderPaused) {
        await supabase.rpc('merge_profile_settings', { p_user_id: p.id, p_patch: { reminderPaused: false } });
      }
      skipped++; continue;
    }

    // Dias sem estudar (0 = nunca estudou; a data é 'YYYY-MM-DD' → diff em dias UTC).
    const diasSem = lastDate
      ? Math.round((Date.parse(today) - Date.parse(lastDate)) / 86_400_000)
      : 0;

    // Quem NUNCA estudou não tem "dias sem estudar" — a régua da pausa passa a
    // ser há quantos dias vem sendo lembrado sem nunca ter começado.
    const diasLembrado = !lastDate && s.firstRemindedDate
      ? Math.round((Date.parse(today) - Date.parse(s.firstRemindedDate)) / 86_400_000)
      : 0;

    // Auto-pausado e ainda sem voltar: fica em silêncio. (Reativar nas
    // configurações ou simplesmente estudar de novo desfaz a pausa.)
    if (s.reminderPaused) {
      if (diasSem > 0 && diasSem < PAUSA_APOS_DIAS) {
        // estudou depois da pausa (mas não hoje) → volta ao ciclo normal
        await supabase.rpc('merge_profile_settings', { p_user_id: p.id, p_patch: { reminderPaused: false } });
      } else { skipped++; continue; }
    }

    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth')
      .eq('user_id', p.id);
    if (!subs?.length) { skipped++; continue; }

    // Mensagem adaptada ao contexto — sempre honesta, nunca alarmista.
    const pausarAgora = diasSem >= PAUSA_APOS_DIAS || diasLembrado >= PAUSA_APOS_DIAS;
    let title = 'Hora de estudar 🔥';
    let body = 'Mantenha sua sequência viva — um bloco curto já conta.';
    let url = '/revisar';
    if (pausarAgora) {
      title = 'Vamos silenciar os lembretes por enquanto';
      body = 'Estes avisos não parecem estar ajudando agora. Eles voltam sozinhos quando você estudar de novo — no seu tempo.';
      url = '/';
    } else if (!lastDate) {
      // nunca estudou: não falar de "sequência" que não existe
      title = 'Seu primeiro bloco está esperando';
      body = '10 minutos hoje já contam. Comece pequeno.';
      url = '/';
    } else if (diasSem >= 4) {
      title = 'Voltar leve também conta';
      body = `${diasSem} dias fora — sem drama. 10 minutinhos hoje já reativam o ritmo.`;
      url = '/';
    } else if (diasSem >= 2) {
      body = 'Um bloco curto hoje evita o efeito bola de neve de revisões.';
    }

    const payload = JSON.stringify({ title, body, url, tag: 'focali-lembrete' });

    let enviouAlgum = false;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
        enviouAlgum = true;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode ?? 0;
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          cleaned++;
        }
      }
    }

    // Marca como lembrado hoje (idempotência) — só se algo saiu de fato.
    // Se esta foi a mensagem de despedida, pausa os lembretes até a pessoa voltar.
    if (enviouAlgum) {
      const patch: Record<string, unknown> = { lastRemindedDate: today };
      if (!s.firstRemindedDate) patch.firstRemindedDate = today; // régua p/ quem nunca estudou
      if (pausarAgora) patch.reminderPaused = true;
      await supabase.rpc('merge_profile_settings', { p_user_id: p.id, p_patch: patch });
    }
  }

  return new Response(JSON.stringify({ sent, skipped, cleaned }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
