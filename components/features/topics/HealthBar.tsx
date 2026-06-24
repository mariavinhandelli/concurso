// components/features/topics/HealthBar.tsx
// Barra de "Saúde do Tópico" (0–100). Verde-sálvia = dominado, âmbar = em
// construção, rosa-poeira = frágil. Sem dado = barra neutra "não medido".
'use client';

import { theme } from '@/lib/theme';

interface Props {
  saude?: number; // undefined = nunca medido (sem sessão de questões)
}

// Faixas de cor por nível de domínio. Tons suaves, alinhados à paleta.
function corPorSaude(s: number): { fill: string; label: string } {
  if (s >= 70) return { fill: '#9CAF88', label: 'Dominado' };      // verde-sálvia
  if (s >= 40) return { fill: '#E8C07D', label: 'Em construção' }; // âmbar pastel
  return { fill: '#D8A0A6', label: 'Frágil' };                     // rosa-poeira
}

export function HealthBar({ saude }: Props) {
  // Estado "nunca medido": barra cinza-clara, sem preenchimento.
  if (saude === undefined) {
    return (
      <div style={styles.wrap} title="Sem questões respondidas ainda">
        <div style={styles.track}>
          <div style={{ ...styles.fill, width: '0%' }} />
        </div>
        <span style={{ ...styles.pct, color: '#B8B2A8' }}>—</span>
      </div>
    );
  }

  const { fill, label } = corPorSaude(saude);
  return (
    <div style={styles.wrap} title={`Saúde: ${saude}/100 · ${label}`}>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${saude}%`, background: fill }} />
      </div>
      <span style={{ ...styles.pct, color: fill }}>{saude}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 },
  track: {
    flex: 1, height: 6, borderRadius: 999,
    background: '#EFEBE3', overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999, transition: 'width 0.3s ease' },
  pct: { fontSize: 12, fontWeight: 600, minWidth: 22, textAlign: 'right' },
};