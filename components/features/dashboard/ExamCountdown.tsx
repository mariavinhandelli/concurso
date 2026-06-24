// components/features/dashboard/ExamCountdown.tsx
// Contagem regressiva para múltiplos concursos. A cor do número reflete a
// urgência (≤14 dias = terracota), não uma cor decorativa arbitrária.
'use client';

import { useEffect, useState } from 'react';
import {
  listExamTargets, createExamTarget, deleteExamTarget,
  daysUntil, EXAM_COLORS, type ExamTarget,
} from '@/services/examTargets.service';
import { theme } from '@/lib/theme';

export function ExamCountdown() {
  const [targets, setTargets] = useState<ExamTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState(EXAM_COLORS[0]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setTargets(await listExamTargets());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!name.trim() || !date) return;
    try {
      await createExamTarget(name, date, color);
      setName(''); setDate(''); setColor(EXAM_COLORS[0]); setAdding(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }

  async function handleDelete(id: string, n: string) {
    if (!confirm(`Remover a contagem para "${n}"?`)) return;
    try { await deleteExamTarget(id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao remover.'); }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Contagem para a prova</span>
        {!adding && (
          <button onClick={() => setAdding(true)} style={styles.addLink}>+ Adicionar</button>
        )}
      </div>

      {adding && (
        <div style={styles.form}>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nome do concurso (ex: TCE-GO)" style={styles.input}
          />
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={styles.input}
          />
          <div style={styles.colors}>
            {EXAM_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                style={{ ...styles.colorDot, background: c,
                  outline: color === c ? `2px solid ${theme.inkSoft}` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
          <div style={styles.formActions}>
            <button onClick={() => setAdding(false)} style={styles.cancelBtn}>Cancelar</button>
            <button onClick={handleCreate} style={styles.saveBtn}>Salvar</button>
          </div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : targets.length === 0 && !adding ? (
        <p style={styles.muted}>Nenhuma prova cadastrada. Adicione uma data para acompanhar.</p>
      ) : (
        <div style={styles.list}>
          {targets.map((t) => {
            const dias = daysUntil(t.exam_date);
            const passou = dias < 0;
            const critico = dias >= 0 && dias <= 7;
            const urgente = dias > 7 && dias <= 30;
            const numColor = passou ? theme.inkFaint : critico ? theme.crit : urgente ? theme.warn : theme.ok;
            return (
              <div key={t.id} style={styles.item}>
                <div style={styles.itemInfo}>
                  <span style={styles.itemName}>{t.name}</span>
                  <span style={styles.itemDate}>
                    {new Date(t.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div style={styles.itemCount}>
                  {passou ? (
                    <span style={styles.passed}>realizada</span>
                  ) : (
                    <>
                      <span style={{ ...styles.days, color: numColor }}>{dias}</span>
                      <span style={styles.daysLabel}>{dias === 1 ? 'dia' : 'dias'}</span>
                    </>
                  )}
                </div>
                <button onClick={() => handleDelete(t.id, t.name)} style={styles.removeBtn} aria-label={`Remover ${t.name}`}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  addLink: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, padding: 16, background: theme.bg, borderRadius: 12 },
  input: { padding: 10, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit' },
  colors: { display: 'flex', gap: 10 },
  colorDot: { width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer' },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { padding: '8px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { padding: '8px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14, margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', flex: 1 },
  item: { display: 'flex', alignItems: 'center', gap: 14, background: theme.bg, borderRadius: 12, padding: '14px 16px' },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  itemName: { fontSize: 15, color: theme.ink, fontWeight: 500 },
  itemDate: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  itemCount: { display: 'flex', alignItems: 'baseline', gap: 4 },
  days: { fontSize: 32, fontWeight: 600, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' },
  daysLabel: { fontSize: 12, color: theme.inkFaint },
  passed: { fontSize: 13, color: theme.inkFaint, fontStyle: 'italic' },
  removeBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', opacity: .5 },
};