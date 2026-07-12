// services/push.service.ts
// N1 (web push) — lado cliente: assina/desassina o navegador para notificações
// push e guarda a assinatura em push_subscriptions. As preferências de lembrete
// (ativo, horário, fuso) moram em profiles.settings via merge_profile_settings.
// Só roda no navegador (usa navigator/Notification); chamar de client components.

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

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;   // assinado neste navegador + preferência ativa
  hour: number;       // horário do lembrete (0–23)
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return { supported: false, permission: 'unsupported', enabled: false, hour: DEFAULT_REMINDER_HOUR };

  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = reg ? !!(await reg.pushManager.getSubscription()) : false;
  } catch { subscribed = false; }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let prefEnabled = false;
  let hour = DEFAULT_REMINDER_HOUR;
  if (user) {
    const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle();
    const s = (data?.settings ?? {}) as { reminderEnabled?: boolean; reminderHour?: number };
    prefEnabled = !!s.reminderEnabled;
    hour = typeof s.reminderHour === 'number' ? s.reminderHour : DEFAULT_REMINDER_HOUR;
  }

  return { supported: true, permission: Notification.permission, enabled: subscribed && prefEnabled, hour };
}

export async function enablePush(reminderHour: number = DEFAULT_REMINDER_HOUR): Promise<void> {
  if (!isPushSupported()) throw new Error('Seu navegador não suporta notificações push.');
  if (!VAPID_PUBLIC_KEY) throw new Error('Configuração de push ausente no servidor (VAPID).');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada. Habilite nas configurações do navegador.');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = sub.toJSON();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    user_agent: navigator.userAgent.slice(0, 300),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error('Erro ao salvar assinatura: ' + error.message);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  await supabase.rpc('merge_profile_settings', {
    p_user_id: user.id,
    // reminderPaused: false — reativar o lembrete desfaz a pausa automática
    // aplicada pelo cron quando os avisos vinham sendo ignorados.
    p_patch: { reminderEnabled: true, reminderHour, reminderTz: tz, reminderPaused: false },
  });
  track(EV.pushEnabled, { hour: reminderHour });
}

export async function disablePush(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* assinatura já removida / SW indisponível */ }

  if (user) {
    await supabase.rpc('merge_profile_settings', {
      p_user_id: user.id,
      p_patch: { reminderEnabled: false },
    });
  }
  track(EV.pushDisabled);
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
