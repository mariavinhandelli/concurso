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
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';

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
    <>
      <Overlay onClose={fechar} maxWidth={420} labelledBy="marco-edital-title" hideClose>
        <div style={{ textAlign: 'center' }}>
          <div style={s.emoji}>{marco === 100 ? '🏆' : '🎉'}</div>
          <h2 id="marco-edital-title" style={s.h2}>{marco}% do edital coberto!</h2>
          <p style={s.sub}>
            {marco === 100
              ? 'Você cobriu o edital inteiro. Hora de blindar com revisões e simulados.'
              : `Continue nesse ritmo — faltam ${100 - marco}% para cobrir tudo.`}
          </p>
          <div style={s.actions}>
            <Button variant="outline" onClick={fechar}>Fechar</Button>
            <Button onClick={() => setSharing(true)}>Compartilhar →</Button>
          </div>
        </div>
      </Overlay>
      {sharing && <ShareProgressCard onClose={() => { setSharing(false); fechar(); }} />}
    </>
  );
}

const s: Record<string, CSSProperties> = {
  emoji: { fontSize: 46, marginBottom: 6 },
  h2: { fontSize: 20, fontWeight: 700, color: theme.ink, margin: '0 0 8px' },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 22px', lineHeight: 1.55 },
  actions: { display: 'flex', gap: 10, justifyContent: 'center' },
};
