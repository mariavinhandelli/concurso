// components/features/home/RetomadaCard.tsx
// Modo Retomada (M4): quando o usuário volta após um hiato (≥ 4 dias), a Home o
// recebe com este card no topo — acolhedor, sem culpa — em vez da montanha de
// revisões. Reenquadra a pilha e oferece um "recomeço leve" com teto de itens,
// atacando o churn no momento mais frágil (véspera do abandono). Some sozinho
// quando não há hiato e pode ser dispensado por hoje.
'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getRetomadaStatus, type RetomadaStatus } from '@/services/retomada.service';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useUser } from '@/components/layout/UserContext';
import { toLocalDateString } from '@/lib/local-date';
import { theme } from '@/lib/theme';

const LIMITE_LEVE = 10;

export function RetomadaCard() {
  const router = useRouter();
  const { name } = useUser();
  const hoje = toLocalDateString();
  const [dismissedOn, setDismissedOn] = usePersistedState<string>('retomada:dismissed', '', (v) => v ?? '');

  const { data } = useQuery<RetomadaStatus>({
    queryKey: ['retomada'],
    queryFn: getRetomadaStatus,
    staleTime: 5 * 60_000,
  });

  if (!data?.isHiato || dismissedOn === hoje) return null;

  const { diasAusente, pendencias } = data;
  const nome = name ? `, ${name}` : '';
  const temPilha = pendencias > 0;
  const leve = Math.min(LIMITE_LEVE, pendencias);

  return (
    <div style={s.card}>
      <div style={s.top}>
        <span style={s.eyebrow}>Bem-vindo de volta</span>
        <button onClick={() => setDismissedOn(hoje)} style={s.dismiss} aria-label="Dispensar por hoje">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <h2 style={s.title}>Que bom te ver{nome}. 👋</h2>
      <p style={s.body}>
        Foram {diasAusente} dias — sem cobrança. O que importa é você estar aqui agora.
        {temPilha
          ? ` Você tem ${pendencias} ${pendencias === 1 ? 'revisão acumulada' : 'revisões acumuladas'}: não precisa encarar tudo hoje.`
          : ' Suas revisões estão em dia — é só retomar o ritmo.'}
      </p>

      <div style={s.actions}>
        {temPilha ? (
          <button onClick={() => router.push(`/revisar?limite=${LIMITE_LEVE}`)} style={s.primary}>
            Recomeçar leve · {leve} {leve === 1 ? 'item' : 'itens'}
          </button>
        ) : (
          <button onClick={() => setDismissedOn(hoje)} style={s.primary}>Vamos nessa</button>
        )}
        <button onClick={() => setDismissedOn(hoje)} style={s.ghost}>agora não</button>
      </div>

      <p style={s.reassure}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        Sua sequência tem perdão — um tropeço não zera tudo.
      </p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: theme.tealBg,
    border: `0.5px solid ${theme.teal}`,
    borderRadius: theme.radius,
    padding: 22,
    marginBottom: 16,
    fontFamily: theme.font,
    minWidth: 0,
  },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.tealDeep },
  dismiss: { border: 'none', background: 'transparent', color: theme.tealDeep, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.7 },
  title: { fontSize: 21, fontWeight: 800, color: theme.ink, letterSpacing: -0.4, margin: '0 0 6px' },
  body: { fontSize: 14.5, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 16px', maxWidth: 620 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  primary: { padding: '11px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghost: { padding: '11px 14px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  reassure: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: theme.tealDeep, margin: '14px 0 0', fontWeight: 500 },
};
