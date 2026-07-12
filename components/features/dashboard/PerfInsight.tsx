// components/features/dashboard/PerfInsight.tsx
// Rodapé de insight dos gráficos de Performance (M5): transforma "só um número"
// em uma leitura acionável — uma frase que diz o que fazer com aquele dado e,
// quando faz sentido, um botão de 1 clique. Padroniza o tom entre os cards.
'use client';

import type { ReactNode } from 'react';
import { Check, TriangleAlert, Info } from 'lucide-react';
import { theme } from '@/lib/theme';

type Tone = 'warn' | 'ok' | 'info';

const TONE: Record<Tone, { fg: string; bg: string }> = {
  warn: { fg: theme.warnDeep, bg: theme.warnTint },
  ok:   { fg: theme.tealDeep, bg: theme.tealBg },
  info: { fg: theme.clay,     bg: 'rgba(99,102,241,.07)' },
};

function ToneIcon({ tone, color }: { tone: Tone; color: string }) {
  const style = { flexShrink: 0, marginTop: 1 };
  if (tone === 'ok') return <Check size={15} color={color} strokeWidth={2.2} style={style} />;
  if (tone === 'warn') return <TriangleAlert size={15} color={color} strokeWidth={2} style={style} />;
  return <Info size={15} color={color} strokeWidth={2} style={style} />;
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
