// components/features/home/SequenciaRiscoCard.tsx
// N8 — Retomada PREVENTIVA (dia 1–3). O Modo Retomada (RetomadaCard) só age no
// hiato (≥4 dias), quando o estrago já começou. Este card age antes: quando a
// sequência ainda está VIVA mas a pessoa não estudou hoje, lembra que faltam só
// 30 min para não perdê-la — atacando o churn no dia mais barato de intervir.
// Some sozinho ao estudar hoje e é dispensável. Não altera nenhum dado.
'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { getStreak, type StreakInfo } from '@/services/streak.service';
import { getRetomadaStatus, type RetomadaStatus } from '@/services/retomada.service';
import { usePersistedState } from '@/hooks/usePersistedState';
import { toLocalDateString } from '@/lib/local-date';
import { theme } from '@/lib/theme';

const MIN_DIA = 30; // minutos que garantem o dia na sequência (streak.service)

export function SequenciaRiscoCard() {
  const router = useRouter();
  const hoje = toLocalDateString();
  const [dismissedOn, setDismissedOn] = usePersistedState<string>(
    'streakrisk:dismissed', '', (v) => v ?? '',
  );

  const { data: streak } = useQuery<StreakInfo>({ queryKey: ['streak'], queryFn: () => getStreak() });
  const { data: retomada } = useQuery<RetomadaStatus>({ queryKey: ['retomada'], queryFn: getRetomadaStatus, staleTime: 5 * 60_000 });

  // Janela preventiva: 1–3 dias sem estudar. 0 = estudou hoje (nada a fazer);
  // ≥4 = hiato, território do RetomadaCard. Ancorar em diasAusente (e não em
  // streak>0) cobre também quem já quebrou a sequência mas ainda dá pra retomar
  // barato — que é justamente quando o empurrão importa mais. Dispensável por hoje.
  if (!retomada || retomada.isHiato) return null;
  const dias = retomada.diasAusente;
  if (dias < 1 || dias > 3) return null;
  if (dismissedOn === hoje) return null;

  const n = streak?.current ?? 0;
  const viva = n > 0;
  const diasLabel = `${dias} ${dias === 1 ? 'dia' : 'dias'}`;

  return (
    <div style={s.card}>
      <div style={s.top}>
        <span style={s.eyebrow}>{viva ? 'Sequência em risco' : 'Hora de voltar'}</span>
        <button onClick={() => setDismissedOn(hoje)} style={s.dismiss} aria-label="Dispensar por hoje">
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      {viva ? (
        <>
          <h2 style={s.title}>Sua sequência de {n} {n === 1 ? 'dia' : 'dias'} está viva 🔥</h2>
          <p style={s.body}>
            Você não estuda há {diasLabel}. Bastam <b style={s.strong}>{MIN_DIA} min</b> hoje para
            manter o ritmo — antes que a sequência caia.
          </p>
        </>
      ) : (
        <>
          <h2 style={s.title}>Faz {diasLabel} — bora voltar leve?</h2>
          <p style={s.body}>
            Voltar hoje, mesmo com pouco, evita o efeito bola de neve. Um bloco curto de{' '}
            <b style={s.strong}>{MIN_DIA} min</b> já reativa o ritmo.
          </p>
        </>
      )}
      <div style={s.actions}>
        <button onClick={() => router.push('/revisar')} style={s.primary}>Estudar agora</button>
        <button onClick={() => setDismissedOn(hoje)} style={s.ghost}>agora não</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: theme.warnBg, border: `0.5px solid ${theme.warn}`, borderRadius: theme.radius,
    padding: 18, marginBottom: 16, fontFamily: theme.font, minWidth: 0,
  },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.warnDeep },
  dismiss: { border: 'none', background: 'transparent', color: theme.warnDeep, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.7 },
  title: { fontSize: 19, fontWeight: 800, color: theme.ink, letterSpacing: -0.3, margin: '0 0 6px' },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.55, margin: '0 0 14px', maxWidth: 600 },
  strong: { color: theme.ink, fontWeight: 700 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  primary: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.warn, color: theme.onWarn, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghost: { padding: '10px 14px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
};
