// components/features/home/MarcoEditalCelebracao.tsx
// Marcos do edital: celebra 25/50/75/100% de cobertura uma única vez cada
// (localStorage por alvo+marco — mesmo padrão de "pular onboarding").
// Reusa a MESMA query key de CoberturaEdital (['edital-coverage']) — não gera
// fetch extra — e o ShareProgressCard já existente para viralização.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEditalCoverage, type EditalCoverage } from '@/services/coverage.service';
import { ShareProgressCard } from './ShareProgressCard';
import { theme, zIndex } from '@/lib/theme';

const MARCOS = [25, 50, 75, 100];

function celebradoKey(targetId: string, marco: number): string {
  return `focali_marco_${targetId}_${marco}`;
}

export function MarcoEditalCelebracao() {
  const { data } = useQuery<EditalCoverage>({ queryKey: ['edital-coverage'], queryFn: getEditalCoverage });
  const [marco, setMarco] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!data || !data.hasTarget || !data.targetId || data.total === 0) return;
    const alcancados = MARCOS.filter((m) => data.pct >= m);
    if (alcancados.length === 0) return;
    const maior = alcancados[alcancados.length - 1];
    const jaCelebrado = window.localStorage.getItem(celebradoKey(data.targetId, maior)) === '1';
    if (!jaCelebrado) setMarco(maior);
  }, [data]);

  function fechar() {
    if (data?.targetId && marco !== null) {
      for (const m of MARCOS) {
        if (m <= marco) window.localStorage.setItem(celebradoKey(data.targetId, m), '1');
      }
    }
    setMarco(null);
  }

  if (marco === null) return null;

  return (
    <div style={s.overlay} onClick={fechar}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.emoji}>{marco === 100 ? '🏆' : '🎉'}</div>
        <h2 style={s.h2}>{marco}% do edital coberto!</h2>
        <p style={s.sub}>
          {marco === 100
            ? 'Você cobriu o edital inteiro. Hora de blindar com revisões e simulados.'
            : `Continue nesse ritmo — faltam ${100 - marco}% para cobrir tudo.`}
        </p>
        <div style={s.actions}>
          <button style={s.ghost} onClick={fechar}>Fechar</button>
          <button style={s.primary} onClick={() => setSharing(true)}>Compartilhar →</button>
        </div>
      </div>
      {sharing && <ShareProgressCard onClose={() => { setSharing(false); fechar(); }} />}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex.modal, padding: 16 },
  modal: { background: theme.card, borderRadius: theme.radius, width: 'min(420px, 96vw)', padding: '32px 28px', textAlign: 'center', boxShadow: theme.shadowModal, fontFamily: theme.font },
  emoji: { fontSize: 46, marginBottom: 6 },
  h2: { fontSize: 20, fontWeight: 700, color: theme.ink, margin: '0 0 8px' },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 22px', lineHeight: 1.55 },
  actions: { display: 'flex', gap: 10, justifyContent: 'center' },
  ghost: { padding: '10px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
