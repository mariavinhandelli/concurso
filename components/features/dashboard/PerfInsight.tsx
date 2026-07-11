// components/features/dashboard/PerfInsight.tsx
// Rodapé de insight dos gráficos de Performance (M5): transforma "só um número"
// em uma leitura acionável — uma frase que diz o que fazer com aquele dado e,
// quando faz sentido, um botão de 1 clique. Padroniza o tom entre os cards.
'use client';

import type { ReactNode } from 'react';
import { theme } from '@/lib/theme';

type Tone = 'warn' | 'ok' | 'info';

const TONE: Record<Tone, { fg: string; bg: string }> = {
  warn: { fg: theme.warnDeep, bg: theme.warnTint },
  ok:   { fg: theme.tealDeep, bg: theme.tealBg },
  info: { fg: theme.clay,     bg: 'rgba(99,102,241,.07)' },
};

function ToneIcon({ tone, color }: { tone: Tone; color: string }) {
  if (tone === 'ok') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (tone === 'warn') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function PerfInsight({
  tone, children, cta,
}: {
  tone: Tone;
  children: ReactNode;
  cta?: { label: string; onClick: () => void };
}) {
  const c = TONE[tone];
  return (
    <div style={{ ...s.wrap, background: c.bg }}>
      <ToneIcon tone={tone} color={c.fg} />
      <p style={s.text}>{children}</p>
      {cta && (
        <button onClick={cta.onClick} style={{ ...s.cta, color: theme.onTeal, background: theme.primary }}>
          {cta.label}
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: theme.radiusSm, marginTop: 18, flexWrap: 'wrap', fontFamily: theme.font },
  text: { flex: 1, minWidth: 180, fontSize: 13, color: theme.ink, lineHeight: 1.5, margin: 0, fontWeight: 500 },
  cta: { border: 'none', borderRadius: theme.radiusXs, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
};
