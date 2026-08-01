// services/push.service.ts
// Lembrete diário de estudo: a preferência (profiles.settings.reminderEnabled)
// dirige o SINO (canal principal, sempre funciona) e, como bônus, a assinatura
// de push do navegador (canal secundário — só existe onde o navegador suporta
// e a pessoa concede permissão). Ligar/desligar o lembrete NUNCA depende de
// push: só grava a preferência. A assinatura de push é tentada best-effort por
// cima, e sua falha/ausência não desliga o lembrete no sino.

import { createClient } from '@/lib/supabase/client';
import { track, EV } from '@/lib/analytics';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export const DEFAULT_REMINDER_HOUR = 19;

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// VAPID key (base64url) → Uint8Array, formato exigido por pushManager.subscribe.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Buffer explícito (ArrayBuffer, não ArrayBufferLike) para casar com o tipo
  // BufferSource exigido por applicationServerKey.
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface ReminderState {
  reminderEnabled: boolean;              // preferência — dirige o sino sempre
  hour: number;
  pushSupported: boolean;
  pushSubscribed: boolean;               // este navegador tem assinatura ativa (bônus)
  permission: NotificationPermission | 'unsupported';
}

export async function getReminderState(): Promise<ReminderState> {
  const supported = isPushSupported();

  let subscribed = false;
  if (supported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      subscribed = reg ? !!(await reg.pushManager.getSubscription()) : false;
    } catch { subscribed = false; }
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let reminderEnabled = false;
  let hour = DEFAULT_REMINDER_HOUR;
  if (user) {
    const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle();
    const s = (data?.settings ?? {}) as { reminderEnabled?: boolean; reminderHour?: number };
    reminderEnabled = !!s.reminderEnabled;
    hour = typeof s.reminderHour === 'number' ? s.reminderHour : DEFAULT_REMINDER_HOUR;
  }

  return {
    reminderEnabled,
    hour,
    pushSupported: supported,
    pushSubscribed: subscribed,
    permission: supported ? Notification.permission : 'unsupported',
  };
}

// Assina push neste navegador — best-effort, chamado como bônus depois de
// ligar o lembrete. Nunca lança: sem push, o sino continua entregando sozinho.
async function trySubscribePush(): Promise<void> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY || Notification.permission === 'denied') return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const json = sub.toJSON();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 300),
    }, { onConflict: 'endpoint' });
  } catch {
    // best-effort: o lembrete pelo sino já foi garantido antes desta chamada
  }
}

async function unsubscribePush(): Promise<void> {
  try {
    const supabase = createClient();
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* assinatura já removida / SW indisponível */ }
}

// Liga/desliga o lembrete diário. Grava a preferência primeiro (o sino já
// passa a valer) e só then tenta o bônus de push — nessa ordem, de propósito.
export async function setReminderEnabled(enabled: boolean, reminderHour: number = DEFAULT_REMINDER_HOUR): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  if (!enabled) {
    await supabase.rpc('merge_profile_settings', { p_user_id: user.id, p_patch: { reminderEnabled: false } });
    await unsubscribePush();
    track(EV.reminderDisabled);
    return;
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    // reminderPaused: false — reativar o lembrete desfaz a pausa automática
    // aplicada pelo cron quando os avisos vinham sendo ignorados.
    p_patch: { reminderEnabled: true, reminderHour, reminderTz: tz, reminderPaused: false },
  });
  track(EV.reminderEnabled, { hour: reminderHour });

  await trySubscribePush();
}

export async function setReminderHour(hour: number): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // reminderHourManual: a pessoa escolheu a hora de propósito — o cron passa a
  // respeitá-la sempre. Sem o flag, o lembrete segue o horário de pico real de
  // estudo aprendido pelo feature store (user_features.peak_hour).
  await supabase.rpc('merge_profile_settings', { p_user_id: user.id, p_patch: { reminderHour: hour, reminderHourManual: true } });
}
