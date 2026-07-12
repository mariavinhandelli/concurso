'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '@/lib/theme';
import { TRIBUNAIS, TIPOS, STATUS_OPTIONS, INCIDENCIA_OPTIONS, type JurisSortBy, type JurisCompletude } from '@/services/jurisprudencias.service';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';

export interface JurisFilterValues {
  tribunal: string;
  tipo: string;
  disciplina: string;
  status: string;
  estrelas: string;
  incidencia: string;
  ano: string;
  sortBy: JurisSortBy | '';
  completude: JurisCompletude | '';
}

export const EMPTY_FILTERS: JurisFilterValues = {
  tribunal: '', tipo: '', disciplina: '', status: '', estrelas: '', incidencia: '', ano: '', sortBy: '', completude: '',
};

interface Props {
  values: JurisFilterValues;
  onChange: (values: JurisFilterValues) => void;
  disciplinas: string[];
}

export function JurisFilterBar({ values, onChange, disciplinas }: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.entries(values).filter(([k, v]) => k !== 'sortBy' && Boolean(v)).length;

  const anos = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  function set<K extends keyof JurisFilterValues>(key: K, value: string) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Ordenação — sempre visível */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: theme.inkSoft, whiteSpace: 'nowrap' }}>Ordenar por</span>
        <Select
          value={values.sortBy}
          onChange={(e) => set('sortBy', e.target.value)}
          style={{ width: 'auto', minWidth: 150, padding: '7px 28px 7px 10px', fontSize: 13 }}
        >
          <option value="">Relevância</option>
          <option value="recentes">Mais Recentes</option>
          <option value="antigas">Mais Antigas</option>
          <option value="estrelas">Mais Estrelas</option>
        </Select>
      </div>

      {/* Filtros colapsíveis */}
      <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.ink }}>Filtros</span>
          {activeCount > 0 && (
            <Badge variant="brand" tone="solid">{activeCount}</Badge>
          )}
          {activeCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange({ ...EMPTY_FILTERS, sortBy: values.sortBy }); }}
              style={styles.clearBtn}
            >Limpar</button>
          )}
          <ChevronDown size={14} color={theme.inkFaint} strokeWidth={1.7}
            style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </div>

        {open && (
          <div style={{ padding: '4px 16px 16px', borderTop: `0.5px solid ${theme.line}` }}>
            <div style={styles.grid}>
              <div>
                <label style={styles.label}>Tribunal</label>
                <Select value={values.tribunal} onChange={(e) => set('tribunal', e.target.value)}>
                  <option value="">Todos</option>
                  {TRIBUNAIS.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Tipo</label>
                <Select value={values.tipo} onChange={(e) => set('tipo', e.target.value)}>
                  <option value="">Todos</option>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Disciplina</label>
                <Select value={values.disciplina} onChange={(e) => set('disciplina', e.target.value)}>
                  <option value="">Todas</option>
                  {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Status</label>
                <Select value={values.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="">Todos</option>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Estrelas</label>
                <Select value={values.estrelas} onChange={(e) => set('estrelas', e.target.value)}>
                  <option value="">Qualquer</option>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}{n < 5 ? ' ou mais' : ''}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Incidência</label>
                <Select value={values.incidencia} onChange={(e) => set('incidencia', e.target.value)}>
                  <option value="">Qualquer</option>
                  {INCIDENCIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Ano</label>
                <Select value={values.ano} onChange={(e) => set('ano', e.target.value)}>
                  <option value="">Qualquer</option>
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </div>
              <div>
                <label style={styles.label}>Cobertura</label>
                <Select value={values.completude} onChange={(e) => set('completude', e.target.value)}>
                  <option value="">Qualquer</option>
                  <option value="com_flashcard">Com flashcard</option>
                  <option value="sem_flashcard">Sem flashcard</option>
                  <option value="com_questao">Com questão C/E</option>
                  <option value="sem_questao">Sem questão C/E</option>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  clearBtn: { fontSize: 12, fontWeight: 600, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 14px', marginTop: 10 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },
};
