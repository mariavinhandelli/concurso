// components/features/home/PlanoProntoBanner.tsx
// Celebra o plano recém-criado pelo OnboardingWizard assim que a Home aparece
// por trás do modal — em vez de o primeiro instante pós-onboarding ser a
// "parede de zeros" (streak 0, missões 0 de 3). Lido uma única vez do
// localStorage (chave por usuário) e removido na sequência: não é um estado
// persistente, é um flash de boas-vindas ao plano.
'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { getOnboardingStatus } from '@/services/onboarding.service';
import { justOnboardedKey } from './OnboardingWizard';
import { useTimer } from '@/components/features/timer/TimerContext';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface JustOnboarded {
  subjectId: string | null;
  subjectName: string | null;
  minutes: number | null;
}

export function PlanoProntoBanner() {
  const { data: status } = useQuery({
    queryKey: ['onboarding-status'], queryFn: getOnboardingStatus, staleTime: Infinity,
  });
  const { start } = useTimer();
  const [info, setInfo] = useState<JustOnboarded | null | undefined>(undefined);

  useEffect(() => {
    if (!status?.userId || typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(justOnboardedKey(status.userId));
    if (!raw) { setInfo(null); return; }
    window.localStorage.removeItem(justOnboardedKey(status.userId)); // só uma vez
    try { setInfo(JSON.parse(raw)); } catch { setInfo(null); }
  }, [status?.userId]);

  if (!info) return null;

  return (
    <div style={s.card}>
      <button style={s.dismiss} onClick={() => setInfo(null)} aria-label="Dispensar">
        <X size={14} strokeWidth={2} />
      </button>
      <span style={s.emoji}>🎉</span>
      <div style={s.text}>
        <p style={s.title}>Seu plano está pronto</p>
        <p style={s.body}>
          {info.subjectName
            ? <>Primeiro bloco: <b style={s.strong}>{info.subjectName}</b>{info.minutes ? ` · ${info.minutes} min` : ''}.</>
            : 'Comece quando quiser — seu ciclo já está distribuído por matéria.'}
        </p>
      </div>
      {info.subjectId && (
        <Button size="sm" onClick={() => { start({ mode: 'teoria', topicId: null, subjectId: info.subjectId }); setInfo(null); }}>
          Começar agora
        </Button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '14px 16px',
    background: theme.tealBg, border: `0.5px solid ${theme.teal}`, borderRadius: theme.radius,
    fontFamily: theme.font, position: 'relative',
  },
  emoji: { fontSize: 24, flexShrink: 0 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 2px' },
  body: { fontSize: 13, color: theme.inkSoft, margin: 0, lineHeight: 1.5 },
  strong: { color: theme.ink, fontWeight: 700 },
  dismiss: {
    position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent',
    color: theme.tealDeep, cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center', opacity: 0.65,
  },
};
