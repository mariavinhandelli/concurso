// supabase/functions/send-daily-reminders/index.ts
// N1 (web push) — disparo dos lembretes diários. Roda de hora em hora (pg_cron).
// Para cada usuário com lembrete ativo cujo horário local bate com a hora atual,
// que AINDA não estudou hoje e que ainda NÃO foi lembrado hoje, envia um push a
// todas as suas assinaturas. Idempotente por dia (settings.lastRemindedDate) —
// por isso é seguro rodar com verify_jwt=false: não há dado exposto nem spam.
// Assinaturas mortas (404/410) são removidas.
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

  let sent = 0, skipped = 0, cleaned = 0;

  for (const p of profiles ?? []) {
    const s = (p.settings ?? {}) as { reminderHour?: number; reminderTz?: string; lastRemindedDate?: string };
    const tz = s.reminderTz || 'America/Sao_Paulo';
    const hour = typeof s.reminderHour === 'number' ? s.reminderHour : 19;
    const today = localDateOf(new Date(), tz);

    // Horário ainda não chegou, ou já foi lembrado hoje (idempotência).
    if (localHour(tz) !== hour || s.lastRemindedDate === today) { skipped++; continue; }

    // Já estudou hoje? Então não precisa de lembrete.
    const { data: last } = await supabase
      .from('study_logs').select('started_at')
      .eq('user_id', p.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (last?.started_at && localDateOf(new Date(last.started_at), tz) === today) { skipped++; continue; }

    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth')
      .eq('user_id', p.id);
    if (!subs?.length) { skipped++; continue; }

    const payload = JSON.stringify({
      title: 'Hora de estudar 🔥',
      body: 'Mantenha sua sequência viva — um bloco curto já conta.',
      url: '/revisar',
      tag: 'focali-lembrete',
    });

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
    if (enviouAlgum) {
      await supabase.rpc('merge_profile_settings', { p_user_id: p.id, p_patch: { lastRemindedDate: today } });
    }
  }

  return new Response(JSON.stringify({ sent, skipped, cleaned }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
