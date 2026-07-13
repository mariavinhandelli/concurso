'use client';

import { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Subject } from '@/services/subjects.service';
import type { RecurrenceItemInput } from '@/services/recurrence.service';
import type { RuleSummary } from '@/services/recurrence.service';
import { theme } from '@/lib/theme';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';

const DIAS = [
  { label: 'S', weekday: 1 }, { label: 'T', weekday: 2 }, { label: 'Q', weekday: 3 },
  { label: 'Q', weekday: 4 }, { label: 'S', weekday: 5 }, { label: 'S', weekday: 6 }, { label: 'D', weekday: 0 },
];

const toH = (min: number) => String(Math.floor(min / 60));
const toM = (min: number) => String(min % 60);

interface DiaFixoItem { uid: number; subjectId: string; h: string; m: string; weekdays: Set<number> }

interface Props {
  subjects: Subject[];
  editRule?: RuleSummary | null;
}

// Ref exposto para o modal pai chamar getItems() no submit sem prop drilling.
export interface DiaFixoFormRef {
  getItems: () => RecurrenceItemInput[] | null; // null = validação falhou
}

let _uid = 0;
const nextUid = () => ++_uid;

export const DiaFixoForm = forwardRef<DiaFixoFormRef, Props>(function DiaFixoForm(
  { subjects, editRule },
  ref,
) {
  const [items, setItems] = useState<DiaFixoItem[]>(() => {
    if (editRule?.mode === 'dia_fixo') {
      return editRule.materias.map((mt) => ({
        uid: nextUid(), subjectId: mt.subjectId,
        h: toH(mt.minutes), m: toM(mt.minutes),
        weekdays: new Set(mt.weekdays),
      }));
    }
    return [{ uid: nextUid(), subjectId: '', h: '1', m: '0', weekdays: new Set<number>() }];
  });

  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    getItems() {
      const validos = items.filter((it) => it.subjectId && it.weekdays.size > 0);
      if (validos.length === 0) {
        setError('Adicione ao menos uma matéria com um dia marcado.');
        return null;
      }
      setError('');
      const result: RecurrenceItemInput[] = [];
      for (const it of validos) {
        const mins = (Number(it.h) || 0) * 60 + (Number(it.m) || 0) || 60;
        for (const wd of it.weekdays) {
          result.push({ subjectId: it.subjectId, plannedMinutes: mins, weekday: wd, position: 0 });
        }
      }
      return result;
    },
  }));

  function add() { setItems((p) => [...p, { uid: nextUid(), subjectId: '', h: '1', m: '0', weekdays: new Set() }]); }
  function remove(uid: number) { setItems((p) => p.filter((it) => it.uid !== uid)); }
  function patch(uid: number, change: Partial<DiaFixoItem>) { setItems((p) => p.map((it) => it.uid === uid ? { ...it, ...change } : it)); }
  function toggleDay(uid: number, weekday: number) {
    setItems((p) => p.map((it) => {
      if (it.uid !== uid) return it;
      const next = new Set(it.weekdays);
      if (next.has(weekday)) next.delete(weekday); else next.add(weekday);
      return { ...it, weekdays: next };
    }));
  }

  const colorOf = (subjectId: string) => subjects.find((s) => s.id === subjectId)?.color ?? theme.line;

  return (
    <>
      <label style={styles.sectionLabel}>Matérias do padrão</label>
      {items.map((it) => (
        <div key={it.uid} style={styles.itemCard}>
          <div style={styles.itemHead}>
            <span style={{ ...styles.colorDot, background: colorOf(it.subjectId) }} />
            <Select value={it.subjectId} onChange={(e) => patch(it.uid, { subjectId: e.target.value })} style={{ flex: 1, minWidth: 0, padding: '8px 32px 8px 10px', borderRadius: theme.radiusXs, fontSize: 14 }}>
              <option value="">Selecione a matéria…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {items.length > 1 && <IconButton size="sm" onClick={() => remove(it.uid)} aria-label="Remover" style={{ color: theme.inkFaint }}><X size={13} strokeWidth={2} /></IconButton>}
          </div>
          <div style={styles.timeRow}>
            <Input type="number" min="0" value={it.h} onChange={(e) => patch(it.uid, { h: e.target.value })} style={{ width: 56, padding: 8, borderRadius: theme.radiusXs, fontSize: 14, textAlign: 'center' }} />
            <span style={styles.unit}>h</span>
            <Input type="number" min="0" max="59" value={it.m} onChange={(e) => patch(it.uid, { m: e.target.value })} style={{ width: 56, padding: 8, borderRadius: theme.radiusXs, fontSize: 14, textAlign: 'center' }} />
            <span style={styles.unit}>min</span>
          </div>
          <div style={styles.daysRow}>
            {DIAS.map((d, idx) => {
              const on = it.weekdays.has(d.weekday);
              return <button key={idx} onClick={() => toggleDay(it.uid, d.weekday)} style={{ ...styles.dayBtn, ...(on ? styles.dayBtnOn : {}) }}>{d.label}</button>;
            })}
          </div>
        </div>
      ))}
      <button onClick={add} style={styles.addBtn}>+ adicionar matéria</button>
      {error && <p style={styles.error}>{error}</p>}
    </>
  );
});

const styles: Record<string, React.CSSProperties> = {
  sectionLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: theme.inkSoft, margin: '16px 0 8px', letterSpacing: 0.3 },
  itemCard: { borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, padding: 12, marginBottom: 10 },
  itemHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  colorDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  timeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  unit: { fontSize: 12, color: theme.inkSoft },
  daysRow: { display: 'flex', gap: 5 },
  dayBtn: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, padding: '7px 0', borderRadius: 6, border: 'none', background: theme.muted, color: theme.inkFaint, cursor: 'pointer', fontFamily: 'inherit' },
  dayBtnOn: { background: theme.teal, color: theme.onTeal },
  addBtn: { width: '100%', padding: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line, borderRadius: theme.radiusSm, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: theme.danger, fontSize: 13, margin: '8px 0 0' },
};
