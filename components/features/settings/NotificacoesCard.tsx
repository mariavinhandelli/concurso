// components/features/settings/NotificacoesCard.tsx
// Opt-in de lembrete diário nas Configurações. O switch grava a preferência
// (profiles.settings.reminderEnabled), que é o que o SINO da topbar usa —
// funciona em qualquer navegador, sempre. Quando o navegador suporta push e
// concede permissão, a plataforma também assina push como bônus (não há
// PWA/app nativo ainda, então isso é só um alcance extra pra quem instala e
// concede permissão de propósito). Não envia nada sozinho: o disparo diário é
// feito pela Edge Function (backend).
'use client';

import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getReminderState, setReminderEnabled, setReminderHour, isPushSupported, type ReminderState,
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

  const { data: st, refetch, isLoading } = useQuery<ReminderState>({
    queryKey: ['reminder-state'],
    queryFn: getReminderState,
    staleTime: 30_000,
  });

  async function toggle() {
    if (!st || busy) return;
    setBusy(true);
    try {
      if (st.reminderEnabled) {
        await setReminderEnabled(false);
        toast.success('Lembretes diários desativados.');
      } else {
        await setReminderEnabled(true, st.hour);
        toast.success('Lembretes diários ativados! Você vai receber um aviso no sino.');
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

  const enabled = !!st?.reminderEnabled;
  const pushSupported = isClient && isPushSupported();
  const pushBonusAtivo = pushSupported && !!st?.pushSubscribed;
  const pushBloqueado = st?.permission === 'denied';

  return (
    <section style={styles.card}>
      <div style={styles.cardTitle}>Lembretes</div>
      <p style={styles.intro}>
        Receba um lembrete diário no seu horário de estudo, no sino de notificações — o
        empurrãozinho que mantém a sequência viva mesmo nos dias corridos.
      </p>

      <div style={styles.row}>
        <div>
          <div style={styles.rowLabel}>Lembrete diário de estudo</div>
          <div style={styles.rowHint}>
            {enabled ? 'Ativo — avisa no sino, todo dia.' : 'Desligado.'}
          </div>
        </div>
        <Switch
          checked={enabled}
          onChange={toggle}
          disabled={busy || isLoading}
          aria-label="Ativar lembretes diários"
        />
      </div>

      {enabled && (
        <div style={{ ...styles.row, marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${theme.line}` }}>
          <div>
            <div style={styles.rowLabel}>Horário</div>
            <div style={styles.rowHint}>Quando você quer ser lembrado.</div>
          </div>
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
        </div>
      )}

      {enabled && pushSupported && (
        <div style={{ ...styles.row, marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${theme.line}` }}>
          <div>
            <div style={styles.rowLabel}>Notificação do navegador (extra)</div>
            <div style={styles.rowHint}>
              {pushBloqueado
                ? 'Bloqueada nas permissões do site — o lembrete continua chegando no sino.'
                : pushBonusAtivo
                  ? 'Também ativa neste navegador, além do sino.'
                  : 'Não ativada neste navegador — o lembrete continua chegando no sino.'}
            </div>
          </div>
          {pushBonusAtivo && (
            <button onClick={testar} style={styles.testBtn}>Enviar teste</button>
          )}
        </div>
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
};
