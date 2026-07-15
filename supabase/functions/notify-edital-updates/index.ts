// supabase/functions/notify-edital-updates/index.ts
// Hub de Editais — push de novidades. Roda de hora em hora (pg_cron) e envia
// web push para quem SEGUE o edital (edital_follows) ou já ATIVOU o concurso
// (target_exams.catalog_edital_id) sempre que a curadoria publica um
// edital_update novo (notified_at is null). Idempotente: o update é marcado
// como notificado mesmo sem destinatários, para nunca reenviar.
// Assinaturas mortas (404/410) são removidas — mesmo padrão do
// send-daily-reminders. Segredo necessário: VAPID_PRIVATE_KEY.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const VAPID_PUBLIC = 'BBgjY2251ulxouwlZRKBWC4cMXfWWU4gyUpwHEnBcZxQrl8S0nTdjIvvYZ-KKJ7QCWXGEpIwWM6krSHew1mIKHE';
const VAPID_SUBJECT = 'mailto:mariavinhandelli@gmail.com';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TIPO_LABEL: Record<string, string> = {
  noticia: 'Notícia',
  retificacao: 'Retificação',
  aviso: 'Aviso',
  resultado: 'Resultado',
};

const BATCH = 20; // updates por execução — backstop contra enxurrada de curadoria

Deno.serve(async () => {
  if (!VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY não configurada' }), { status: 500 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { data: updates, error } = await supabase
    .from('edital_updates')
    .select('id, tipo, titulo, edital_catalog_id, editais_catalog(slug, orgao, cargo)')
    .is('notified_at', null)
    .order('published_at', { ascending: true })
    .limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0, cleaned = 0, notified = 0;

  for (const u of updates ?? []) {
    const edital = Array.isArray(u.editais_catalog) ? u.editais_catalog[0] : u.editais_catalog;

    // Destinatários: seguidores explícitos ∪ quem ativou o concurso.
    const [followsRes, targetsRes] = await Promise.all([
      supabase.from('edital_follows').select('user_id').eq('edital_catalog_id', u.edital_catalog_id),
      supabase.from('target_exams').select('user_id').eq('catalog_edital_id', u.edital_catalog_id).is('archived_at', null),
    ]);
    const userIds = new Set<string>([
      ...(followsRes.data ?? []).map((r) => r.user_id),
      ...(targetsRes.data ?? []).map((r) => r.user_id),
    ]);

    if (userIds.size > 0 && edital) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .in('user_id', [...userIds]);

      const label = TIPO_LABEL[u.tipo] ?? 'Novidade';
      const payload = JSON.stringify({
        title: `${label} — ${[edital.orgao, edital.cargo].filter(Boolean).join(' · ')}`,
        body: u.titulo,
        url: `/editais/${edital.slug}`,
        tag: `focali-edital-${u.id}`,
      });

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode ?? 0;
          if (code === 404 || code === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            cleaned++;
          }
        }
      }
    }

    // Marca como notificado SEMPRE (mesmo sem destinatários) — nunca reenvia.
    await supabase.from('edital_updates').update({ notified_at: new Date().toISOString() }).eq('id', u.id);
    notified++;
  }

  return new Response(JSON.stringify({ notified, sent, cleaned }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
