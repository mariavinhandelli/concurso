'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import { TRIBUNAIS, TIPOS, STATUS_OPTIONS, INCIDENCIA_OPTIONS } from '@/services/jurisprudencias.service';

export interface JurisFilterValues {
  tribunal: string;
  tipo: string;
  disciplina: string;
  status: string;
  estrelas: string;
  incidencia: string;
  ano: string;
}

export const EMPTY_FILTERS: JurisFilterValues = {
  tribunal: '', tipo: '', disciplina: '', status: '', estrelas: '', incidencia: '', ano: '',
};

interface Props {
  values: JurisFilterValues;
  onChange: (values: JurisFilterValues) => void;
  disciplinas: string[];
}

export function JurisFilterBar({ values, onChange, disciplinas }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.values(values).filter(Boolean).length;
  const anos = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  function set<K extends keyof JurisFilterValues>(key: K, value: string) {
    onChange({ ...values, [key]: value });
  }

  const sel: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.line}`, background: theme.card,
    fontSize: 13.5, color: theme.ink, fontFamily: theme.font,
    cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink }}>Filtros</span>
        {activeCount > 0 && (
          <span style={styles.countBadge}>{activeCount}</span>
        )}
        {activeCount > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(EMPTY_FILTERS); }}
            style={styles.clearBtn}
          >Limpar</button>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: `0.5px solid ${theme.line}` }}>
          <div style={styles.grid}>
            <div>
              <label style={styles.label}>Tribunal</label>
              <select value={values.tribunal} onChange={(e) => set('tribunal', e.target.value)} style={sel}>
                <option value="">Todos</option>
                {TRIBUNAIS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Tipo</label>
              <select value={values.tipo} onChange={(e) => set('tipo', e.target.value)} style={sel}>
                <option value="">Todos</option>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Disciplina</label>
              <select value={values.disciplina} onChange={(e) => set('disciplina', e.target.value)} style={sel}>
                <option value="">Todas</option>
                {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Status</label>
              <select value={values.status} onChange={(e) => set('status', e.target.value)} style={sel}>
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Estrelas</label>
              <select value={values.estrelas} onChange={(e) => set('estrelas', e.target.value)} style={sel}>
                <option value="">Qualquer</option>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Incidência</label>
              <select value={values.incidencia} onChange={(e) => set('incidencia', e.target.value)} style={sel}>
                <option value="">Qualquer</option>
                {INCIDENCIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Ano</label>
              <select value={values.ano} onChange={(e) => set('ano', e.target.value)} style={sel}>
                <option value="">Qualquer</option>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  countBadge: { fontSize: 11, fontWeight: 700, color: '#fff', background: theme.teal, borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' },
  clearBtn: { fontSize: 11.5, fontWeight: 600, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 14px', marginTop: 10 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },
};
