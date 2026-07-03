'use client';

import { useImperativeHandle, forwardRef, useState } from 'react';
import type { Subject } from '@/services/subjects.service';
import type { RecurrenceItemInput } from '@/services/recurrence.service';
import type { RuleSummary } from '@/services/recurrence.service';
import { theme } from '@/lib/theme';

const toH = (min: number) => String(Math.floor(min / 60));
const toM = (min: number) => String(min % 60);

interface CicloItem { uid: number; subjectId: string; h: string; m: string }

interface Props {
  subjects: Subject[];
  editRule?: RuleSummary | null;
}

export interface CicloFormRef {
  getItems: () => { items: RecurrenceItemInput[]; cycleDailyMinutes: number } | null;
}

let _uid = 0;
const nextUid = () => ++_uid;

export const CicloForm = forwardRef<CicloFormRef, Props>(function CicloForm(
  { subjects, editRule },
  ref,
) {
  const [items, setItems] = useState<CicloItem[]>(() => {
    if (editRule?.mode === 'ciclo') {
      return editRule.materias.map((mt) => ({
        uid: nextUid(), subjectId: mt.subjectId, h: toH(mt.minutes), m: toM(mt.minutes),
      }));
    }
    return [{ uid: nextUid(), subjectId: '', h: '1', m: '0' }];
  });

  const [metaH, setMetaH] = useState(() => editRule?.cycleDailyMinutes ? toH(editRule.cycleDailyMinutes) : '3');
  const [metaM, setMetaM] = useState(() => editRule?.cycleDailyMinutes ? toM(editRule.cycleDailyMinutes) : '0');
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    getItems() {
      const validos = items.filter((it) => it.subjectId);
      if (validos.length === 0) {
        setError('Adicione ao menos uma matéria ao ciclo.');
        return null;
      }
      setError('');
      return {
        items: validos.map((it, i): RecurrenceItemInput => ({
          subjectId: it.subjectId,
          plannedMinutes: (Number(it.h) || 0) * 60 + (Number(it.m) || 0) || 60,
          cycleOrder: i,
          position: i,
        })),
        cycleDailyMinutes: (Number(metaH) || 0) * 60 + (Number(metaM) || 0),
      };
    },
  }));

  function add() { setItems((p) => [...p, { uid: nextUid(), subjectId: '', h: '1', m: '0' }]); }
  function remove(uid: number) { setItems((p) => p.filter((it) => it.uid !== uid)); }
  function patch(uid: number, change: Partial<CicloItem>) { setItems((p) => p.map((it) => it.uid === uid ? { ...it, ...change } : it)); }
  function move(uid: number, dir: -1 | 1) {
    setItems((p) => {
      const idx = p.findIndex((it) => it.uid === uid);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  const colorOf = (subjectId: string) => subjects.find((s) => s.id === subjectId)?.color ?? theme.line;

  return (
    <>
      <label style={styles.sectionLabel}>Sequência do ciclo</label>
      {items.map((it, i) => (
        <div key={it.uid} style={styles.card}>
          <div style={styles.top}>
            <div style={styles.orderBox}>
              <button onClick={() => move(it.uid, -1)} disabled={i === 0} style={{ ...styles.arrowBtn, ...(i === 0 ? styles.arrowOff : {}) }} aria-label="Subir">▲</button>
              <span style={styles.orderNum}>{i + 1}</span>
              <button onClick={() => move(it.uid, 1)} disabled={i === items.length - 1} style={{ ...styles.arrowBtn, ...(i === items.length - 1 ? styles.arrowOff : {}) }} aria-label="Descer">▼</button>
            </div>
            <span style={{ ...styles.colorDot, background: colorOf(it.subjectId) }} />
            <select value={it.subjectId} onChange={(e) => patch(it.uid, { subjectId: e.target.value })} style={styles.subjectSelect}>
              <option value="">Selecione a matéria…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {items.length > 1 && <button onClick={() => remove(it.uid)} style={styles.removeBtn} aria-label="Remover">✕</button>}
          </div>
          <div style={styles.timeRow}>
            <input type="number" min="0" value={it.h} onChange={(e) => patch(it.uid, { h: e.target.value })} style={styles.timeInput} />
            <span style={styles.unit}>h</span>
            <input type="number" min="0" max="59" value={it.m} onChange={(e) => patch(it.uid, { m: e.target.value })} style={styles.timeInput} />
            <span style={styles.unit}>min</span>
          </div>
        </div>
      ))}
      <button onClick={add} style={styles.addBtn}>+ adicionar matéria</button>

      <label style={styles.sectionLabel}>Meta de estudo por dia</label>
      <div style={styles.timeRow}>
        <input type="number" min="0" value={metaH} onChange={(e) => setMetaH(e.target.value)} style={styles.timeInput} />
        <span style={styles.unit}>h</span>
        <input type="number" min="0" max="59" value={metaM} onChange={(e) => setMetaM(e.target.value)} style={styles.timeInput} />
        <span style={styles.unit}>min</span>
      </div>

      {error && <p style={styles.error}>{error}</p>}
    </>
  );
});

const styles: Record<string, React.CSSProperties> = {
  sectionLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: theme.inkSoft, margin: '16px 0 8px', letterSpacing: 0.3 },
  card: { borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, padding: 12, marginBottom: 8 },
  top: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  orderBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 },
  arrowBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 9, lineHeight: 1, cursor: 'pointer', padding: 1 },
  arrowOff: { color: theme.line, cursor: 'default' },
  orderNum: { fontSize: 12, fontWeight: 700, color: theme.ink },
  colorDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  subjectSelect: { flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13.5, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  timeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  timeInput: { width: 56, padding: '8px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13.5, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  unit: { fontSize: 12, color: theme.inkSoft },
  removeBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', flexShrink: 0 },
  addBtn: { width: '100%', padding: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line, borderRadius: theme.radiusSm, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: theme.danger, fontSize: 13, margin: '8px 0 0' },
};
