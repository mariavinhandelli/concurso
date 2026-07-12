// components/features/settings/NotificacoesCard.tsx
// N1 (web push) — opt-in de lembretes diários nas Configurações. Ativa/desativa a
// assinatura de push do navegador, escolhe o horário e permite um teste local.
// Não envia nada sozinho: o disparo diário é feito pela Edge Function (backend).
'use client';

import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getPushState, enablePush, disablePush, setReminderHour, isPushSupported, type PushState,
} from '@/services/push.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';

const HORAS = Array.from({ length: 24 }, (_, h) => h);

// "Está no cliente?" via useSyncExternalStore: getServerSnapshot=false → o 1º
// render do cliente casa com o servidor (evita mismatch de hidratação, já que
// isPushSupported() só é verdadeiro no navegador).
const emptySubscribe = () => () => {};

export function NotificacoesCard() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const { data: st, refetch, isLoading } = useQuery<PushState>({
    queryKey: ['push-state'],
    queryFn: getPushState,
    staleTime: 30_000,
  });

  async function toggle() {
    if (!st || busy) return;
    setBusy(true);
    try {
      if (st.enabled) {
        await disablePush();
        toast.success('Lembretes diários desativados.');
      } else {
        await enablePush(st.hour);
        toast.success('Lembretes diários ativados! 🔔');
      }
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível alterar os lembretes.');
    } finally {
      setBusy(false);
    }
  }

  async function changeHour(h: number) {
    setBusy(true);
    try {
      await setReminderHour(h);
      await refetch();
    } catch {
      toast.error('Não foi possível salvar o horário.');
    } finally {
      setBusy(false);
    }
  }

  async function testar() {
    try {
      if (Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') {
          toast.error('O navegador não concedeu permissão de notificação.');
          return;
        }
      }
      // Sem ícone SVG de propósito: Chrome/Windows costuma ignorar SVG e pode
      // até suprimir a notificação — PNG/sem-ícone é o caminho seguro.
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Focali 🔔', {
        body: 'Notificação de teste — está funcionando!',
        tag: 'focali-teste',
      });
      toast.success('Teste enviado. Se nada apareceu, veja o modo "Foco"/"Não perturbe" do Windows e as notificações do Chrome.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar o teste.');
    }
  }

  const supported = isPushSupported();
  const enabled = !!st?.enabled;
  const blocked = st?.permission === 'denied';

  return (
    <section style={styles.card}>
      <div style={styles.cardTitle}>Lembretes</div>
      <p style={styles.intro}>
        Receba um lembrete diário no seu horário de estudo — o empurrãozinho que mantém a
        sequência viva mesmo nos dias corridos.
      </p>

      {!isClient ? null : !supported ? (
        <p style={styles.muted}>Seu navegador não suporta notificações push.</p>
      ) : (
        <>
          <div style={styles.row}>
            <div>
              <div style={styles.rowLabel}>Lembrete diário de estudo</div>
              <div style={styles.rowHint}>
                {blocked
                  ? 'Notificações bloqueadas no navegador — libere nas permissões do site.'
                  : enabled ? 'Ativo neste dispositivo.' : 'Desligado.'}
              </div>
            </div>
            <Switch
              checked={enabled}
              onChange={toggle}
              disabled={busy || blocked || isLoading}
              aria-label="Ativar lembretes diários"
            />
          </div>

          {enabled && (
            <div style={{ ...styles.row, marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${theme.line}` }}>
              <div>
                <div style={styles.rowLabel}>Horário</div>
                <div style={styles.rowHint}>Quando você quer ser lembrado.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select
                  value={st?.hour ?? 19}
                  onChange={(e) => changeHour(Number(e.target.value))}
                  disabled={busy}
                  style={{ width: 'auto' }}
                  aria-label="Horário do lembrete"
                >
                  {HORAS.map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </Select>
                <button onClick={testar} style={styles.testBtn}>Enviar teste</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24, marginBottom: 18 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  intro: { fontSize: 13, color: theme.inkSoft, margin: '0 0 18px', lineHeight: 1.5 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontSize: 15, fontWeight: 600, color: theme.ink },
  rowHint: { fontSize: 13, color: theme.inkFaint, marginTop: 3, maxWidth: 380 },
  testBtn: { padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  muted: { color: theme.inkFaint, fontSize: 14 },
};
