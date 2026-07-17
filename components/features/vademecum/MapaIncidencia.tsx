// components/features/vademecum/MapaIncidencia.tsx
// Aba "Mapa de incidência": visão de calor dos artigos por relevância em
// concursos. Chips coloridos agrupados por Título; clique navega ao artigo.
'use client';

import { useMemo, type CSSProperties } from 'react';
import { Target } from 'lucide-react';
import type { Lei, LeiArtigo, LeiIncidencia } from '@/services/leis.service';
import { theme } from '@/lib/theme';

const NIVEL: Record<LeiIncidencia, { bg: string; ink: string; border: string; label: string }> = {
  muito_alta: { bg: `color-mix(in srgb, ${theme.danger} 16%, transparent)`, ink: theme.danger,  border: `color-mix(in srgb, ${theme.danger} 45%, transparent)`, label: 'Muito alta' },
  alta:       { bg: `color-mix(in srgb, ${theme.warn} 16%, transparent)`,   ink: theme.warnDeep, border: `color-mix(in srgb, ${theme.warn} 45%, transparent)`,   label: 'Alta' },
  media:      { bg: `color-mix(in srgb, ${theme.ok} 13%, transparent)`,     ink: theme.okDeep,   border: `color-mix(in srgb, ${theme.ok} 35%, transparent)`,     label: 'Média' },
  baixa:      { bg: 'transparent',                                          ink: theme.inkFaint, border: theme.line,                                              label: 'Baixa' },
};

interface Props {
  lei: Lei;
  onNavigate: (numero: string) => void;
}

export function MapaIncidencia({ lei, onNavigate }: Props) {
  // Agrupa por Título (primeiro segmento do caminho), preservando a ordem.
  const grupos = useMemo(() => {
    const out: { titulo: string; artigos: LeiArtigo[] }[] = [];
    for (const a of lei.artigos) {
      const titulo = a.caminho?.split(' › ')[0] ?? 'Sem título';
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.titulo === titulo) ultimo.artigos.push(a);
      else out.push({ titulo, artigos: [a] });
    }
    return out;
  }, [lei]);

  const topArtigos = useMemo(
    () => lei.artigos.filter((a) => a.incidencia === 'muito_alta'),
    [lei],
  );

  const contagem = useMemo(() => {
    const c: Record<LeiIncidencia, number> = { muito_alta: 0, alta: 0, media: 0, baixa: 0 };
    for (const a of lei.artigos) c[a.incidencia] += 1;
    return c;
  }, [lei]);

  return (
    <div>
      {/* Legenda + contagens */}
      <div style={s.legenda}>
        {(Object.keys(NIVEL) as LeiIncidencia[]).map((n) => (
          <span key={n} style={s.legItem}>
            <span style={{ ...s.legDot, background: NIVEL[n].bg, borderColor: NIVEL[n].border }} />
            {NIVEL[n].label} <b style={{ color: theme.inkSoft }}>({contagem[n]})</b>
          </span>
        ))}
      </div>

      {/* Top artigos — os que decidem prova */}
      <div style={s.topBox}>
        <h3 style={{ ...s.topTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Target size={16} strokeWidth={2} /> Os {topArtigos.length} artigos que decidem prova
        </h3>
        <div style={s.topList}>
          {topArtigos.map((a) => (
            <button key={a.key} onClick={() => onNavigate(a.numero)} style={s.topRow}>
              <span style={s.topNum}>{a.rotulo}</span>
              <span style={s.topNota}>{a.incidenciaNota}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap por Título */}
      {grupos.map((g) => (
        <div key={g.titulo} style={s.grupo}>
          <h4 style={s.grupoTitulo}>{g.titulo}</h4>
          <div style={s.chips}>
            {g.artigos.map((a) => {
              const n = NIVEL[a.incidencia];
              return (
                <button
                  key={a.key}
                  onClick={() => onNavigate(a.numero)}
                  title={`${a.rotulo} — incidência ${n.label.toLowerCase()}${a.revogado ? ' (revogado)' : ''}`}
                  style={{
                    ...s.chip,
                    background: n.bg,
                    color: n.ink,
                    borderColor: n.border,
                    textDecoration: a.revogado ? 'line-through' : 'none',
                  }}
                >
                  {a.numero}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  legenda: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 16 },
  legItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: theme.inkSoft },
  legDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderStyle: 'solid', display: 'inline-block' },
  topBox: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '14px 16px', marginBottom: 18 },
  topTitle: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 10px' },
  topList: { display: 'flex', flexDirection: 'column', gap: 4 },
  topRow: { display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 6px', borderRadius: theme.radiusSm },
  topNum: { fontSize: 13, fontWeight: 700, color: theme.danger, flexShrink: 0, minWidth: 74 },
  topNota: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.5 },
  grupo: { marginBottom: 16 },
  grupoTitulo: { fontSize: 12, fontWeight: 700, color: theme.teal, letterSpacing: 0.4, textTransform: 'uppercase', margin: '0 0 8px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  chip: { minWidth: 40, padding: '6px 6px', borderRadius: theme.radiusXs, borderWidth: 1, borderStyle: 'solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
};
