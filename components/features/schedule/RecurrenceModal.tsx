// components/features/schedule/RecurrenceModal.tsx
// Criador/editor de recorrência. Dois modos: dia-fixo (matérias × dias da semana)
// e ciclo (sequência ordenada + meta de tempo/dia). Tempo das matérias em h+min.
'use client';

import { useEffect, useState } from 'react';
import { listSubjects, type Subject } from '@/services/subjects.service';
import {
  createRule, editRuleVersioned, type RecurrenceItemInput, type RuleSummary, type RecurrenceMode,
} from '@/services/recurrence.service';
import { theme } from '@/lib/theme';
import { toLocalDateString } from '@/lib/local-date';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  editRule?: RuleSummary | null;
  modoInicial?: RecurrenceMode;
}

const DIAS = [
  { label: 'S', weekday: 1 },
  { label: 'T', weekday: 2 },
  { label: 'Q', weekday: 3 },
  { label: 'Q', weekday: 4 },
  { label: 'S', weekday: 5 },
  { label: 'S', weekday: 6 },
  { label: 'D', weekday: 0 },
];

// helpers de conversão min <-> h/m
const toH = (min: number) => String(Math.floor(min / 60));
const toM = (min: number) => String(min % 60);
const toMin = (h: string, m: string) => (Number(h) || 0) * 60 + (Number(m) || 0);

interface DiaFixoItem { uid: number; subjectId: string; h: string; m: string; weekdays: Set<number>; }
interface CicloItem { uid: number; subjectId: string; h: string; m: string; }

let uidSeq = 1;

export function RecurrenceModal({ onClose, onCreated, editRule = null, modoInicial = 'dia_fixo' }: Props) {
  const isEdit = !!editRule;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mode, setMode] = useState<RecurrenceMode>(editRule?.mode ?? modoInicial);

  const [diaItems, setDiaItems] = useState<DiaFixoItem[]>(() => {
    if (editRule && editRule.mode === 'dia_fixo') {
      return editRule.materias.map((mt) => ({
        uid: uidSeq++, subjectId: mt.subjectId, h: toH(mt.minutes), m: toM(mt.minutes), weekdays: new Set(mt.weekdays),
      }));
    }
    return [{ uid: uidSeq++, subjectId: '', h: '1', m: '0', weekdays: new Set<number>() }];
  });

  const [cicloItems, setCicloItems] = useState<CicloItem[]>(() => {
    if (editRule && editRule.mode === 'ciclo') {
      return editRule.materias.map((mt) => ({ uid: uidSeq++, subjectId: mt.subjectId, h: toH(mt.minutes), m: toM(mt.minutes) }));
    }
    return [{ uid: uidSeq++, subjectId: '', h: '1', m: '0' }];
  });

  const [metaH, setMetaH] = useState(() => editRule?.cycleDailyMinutes ? toH(editRule.cycleDailyMinutes) : '3');
  const [metaM, setMetaM] = useState(() => editRule?.cycleDailyMinutes ? toM(editRule.cycleDailyMinutes) : '0');

  const [indeterminado, setIndeterminado] = useState(() => editRule ? !editRule.endDate : true);
  const [endDate, setEndDate] = useState(() => editRule?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { listSubjects().then(setSubjects).catch(() => {}); }, []);

  function colorOf(subjectId: string): string {
    return subjects.find((s) => s.id === subjectId)?.color ?? theme.line;
  }

  // ---- dia-fixo ----
  function addDia() { setDiaItems((p) => [...p, { uid: uidSeq++, subjectId: '', h: '1', m: '0', weekdays: new Set() }]); }
  function removeDia(uid: number) { setDiaItems((p) => p.filter((it) => it.uid !== uid)); }
  function setDiaField(uid: number, patch: Partial<DiaFixoItem>) { setDiaItems((p) => p.map((it) => it.uid === uid ? { ...it, ...patch } : it)); }
  function toggleDay(uid: number, weekday: number) {
    setDiaItems((p) => p.map((it) => {
      if (it.uid !== uid) return it;
      const next = new Set(it.weekdays);
      if (next.has(weekday)) next.delete(weekday); else next.add(weekday);
      return { ...it, weekdays: next };
    }));
  }

  // ---- ciclo ----
  function addCiclo() { setCicloItems((p) => [...p, { uid: uidSeq++, subjectId: '', h: '1', m: '0' }]); }
  function removeCiclo(uid: number) { setCicloItems((p) => p.filter((it) => it.uid !== uid)); }
  function setCicloField(uid: number, patch: Partial<CicloItem>) { setCicloItems((p) => p.map((it) => it.uid === uid ? { ...it, ...patch } : it)); }
  function moveCiclo(uid: number, dir: -1 | 1) {
    setCicloItems((p) => {
      const idx = p.findIndex((it) => it.uid === uid);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    setError('');
    const ruleItems: RecurrenceItemInput[] = [];

    if (mode === 'dia_fixo') {
      const validos = diaItems.filter((it) => it.subjectId && it.weekdays.size > 0);
      if (validos.length === 0) { setError('Adicione ao menos uma matéria com um dia marcado.'); return; }
      for (const it of validos) {
        const mins = toMin(it.h, it.m) || 60;
        for (const wd of it.weekdays) {
          ruleItems.push({ subjectId: it.subjectId, plannedMinutes: mins, weekday: wd, position: 0 });
        }
      }
    } else {
      const validos = cicloItems.filter((it) => it.subjectId);
      if (validos.length === 0) { setError('Adicione ao menos uma matéria ao ciclo.'); return; }
      validos.forEach((it, i) => {
        ruleItems.push({ subjectId: it.subjectId, plannedMinutes: toMin(it.h, it.m) || 60, cycleOrder: i, position: i });
      });
    }

    if (!indeterminado && !endDate) { setError('Defina a data final ou marque "indeterminado".'); return; }

    const cycleDailyMinutes = toMin(metaH, metaM);

    setSaving(true);
    try {
      const payload = {
        mode,
        endDate: indeterminado ? null : endDate,
        cycleDailyMinutes: mode === 'ciclo' ? cycleDailyMinutes : undefined,
        items: ruleItems,
      };
      if (isEdit && editRule) {
        await editRuleVersioned(editRule.id, payload);
      } else {
        await createRule(payload);
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSaving(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>{isEdit ? 'Editar recorrência' : 'Nova recorrência'}</h2>
        <p style={styles.subtitle}>
          {isEdit
            ? 'As mudanças valem a partir de hoje. As semanas passadas ficam como estavam.'
            : 'Defina um padrão que se repete sozinho.'}
        </p>

        {!isEdit && (
          <div style={styles.modeToggle}>
            <button onClick={() => setMode('dia_fixo')} style={{ ...styles.modeBtn, ...(mode === 'dia_fixo' ? styles.modeBtnOn : {}) }}>Dia fixo</button>
            <button onClick={() => setMode('ciclo')} style={{ ...styles.modeBtn, ...(mode === 'ciclo' ? styles.modeBtnOn : {}) }}>Ciclo</button>
          </div>
        )}
        <p style={styles.modeHint}>
          {mode === 'dia_fixo'
            ? 'Cada matéria se repete nos dias da semana que você marcar.'
            : 'As matérias formam uma fila que gira: você estuda a próxima sugerida e a roda avança.'}
        </p>

        {mode === 'dia_fixo' ? (
          <>
            <label style={styles.sectionLabel}>Matérias do padrão</label>
            {diaItems.map((it) => (
              <div key={it.uid} style={styles.itemCard}>
                <div style={styles.itemHead}>
                  <span style={{ ...styles.colorDot, background: colorOf(it.subjectId) }} />
                  <select value={it.subjectId} onChange={(e) => setDiaField(it.uid, { subjectId: e.target.value })} style={styles.subjectSelect}>
                    <option value="">Selecione a matéria…</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {diaItems.length > 1 && <button onClick={() => removeDia(it.uid)} style={styles.removeBtn} aria-label="Remover">✕</button>}
                </div>
                <div style={styles.timeRow}>
                  <input type="number" min="0" value={it.h} onChange={(e) => setDiaField(it.uid, { h: e.target.value })} style={styles.timeInput} />
                  <span style={styles.minUnit}>h</span>
                  <input type="number" min="0" max="59" value={it.m} onChange={(e) => setDiaField(it.uid, { m: e.target.value })} style={styles.timeInput} />
                  <span style={styles.minUnit}>min</span>
                </div>
                <div style={styles.daysRow}>
                  {DIAS.map((d, idx) => {
                    const on = it.weekdays.has(d.weekday);
                    return <button key={idx} onClick={() => toggleDay(it.uid, d.weekday)} style={{ ...styles.dayBtn, ...(on ? styles.dayBtnOn : {}) }}>{d.label}</button>;
                  })}
                </div>
              </div>
            ))}
            <button onClick={addDia} style={styles.addItemBtn}>+ adicionar matéria</button>
          </>
        ) : (
          <>
            <label style={styles.sectionLabel}>Sequência do ciclo</label>
            {cicloItems.map((it, i) => (
              <div key={it.uid} style={styles.cicloCard}>
                <div style={styles.cicloTop}>
                  <div style={styles.orderBox}>
                    <button onClick={() => moveCiclo(it.uid, -1)} disabled={i === 0} style={{ ...styles.arrowBtn, ...(i === 0 ? styles.arrowOff : {}) }} aria-label="Subir">▲</button>
                    <span style={styles.orderNum}>{i + 1}</span>
                    <button onClick={() => moveCiclo(it.uid, 1)} disabled={i === cicloItems.length - 1} style={{ ...styles.arrowBtn, ...(i === cicloItems.length - 1 ? styles.arrowOff : {}) }} aria-label="Descer">▼</button>
                  </div>
                  <span style={{ ...styles.colorDot, background: colorOf(it.subjectId) }} />
                  <select value={it.subjectId} onChange={(e) => setCicloField(it.uid, { subjectId: e.target.value })} style={styles.subjectSelect}>
                    <option value="">Selecione a matéria…</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {cicloItems.length > 1 && <button onClick={() => removeCiclo(it.uid)} style={styles.removeBtn} aria-label="Remover">✕</button>}
                </div>
                <div style={styles.timeRow}>
                  <input type="number" min="0" value={it.h} onChange={(e) => setCicloField(it.uid, { h: e.target.value })} style={styles.timeInput} />
                  <span style={styles.minUnit}>h</span>
                  <input type="number" min="0" max="59" value={it.m} onChange={(e) => setCicloField(it.uid, { m: e.target.value })} style={styles.timeInput} />
                  <span style={styles.minUnit}>min</span>
                </div>
              </div>
            ))}
            <button onClick={addCiclo} style={styles.addItemBtn}>+ adicionar matéria</button>

            <label style={styles.sectionLabel}>Meta de estudo por dia</label>
            <div style={styles.timeRow}>
              <input type="number" min="0" value={metaH} onChange={(e) => setMetaH(e.target.value)} style={styles.timeInput} />
              <span style={styles.minUnit}>h</span>
              <input type="number" min="0" max="59" value={metaM} onChange={(e) => setMetaM(e.target.value)} style={styles.timeInput} />
              <span style={styles.minUnit}>min</span>
            </div>
          </>
        )}

        <label style={styles.sectionLabel}>Prazo</label>
        <label style={styles.checkRow}>
          <input type="checkbox" checked={indeterminado} onChange={(e) => setIndeterminado(e.target.checked)} style={styles.checkbox} />
          <span>Indeterminado</span>
        </label>
        {!indeterminado && (
          <input type="date" value={endDate} min={toLocalDateString()} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancel}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={styles.save}>
            {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar recorrência')}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', fontFamily: theme.font },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 16px', lineHeight: 1.5 },
  modeToggle: { display: 'flex', gap: 4, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 4, marginBottom: 8 },
  modeBtn: { flex: 1, padding: '9px 0', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  modeBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  modeHint: { fontSize: 12, color: theme.inkFaint, margin: '0 0 8px', lineHeight: 1.5 },
  sectionLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: theme.inkSoft, margin: '16px 0 8px', letterSpacing: 0.3 },
  itemCard: { borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, padding: 12, marginBottom: 10 },
  itemHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  colorDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  subjectSelect: { flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13.5, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  timeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  timeInput: { width: 56, padding: '8px 8px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13.5, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  minUnit: { fontSize: 12, color: theme.inkSoft },
  removeBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', flexShrink: 0 },
  daysRow: { display: 'flex', gap: 5 },
  dayBtn: { flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 600, padding: '7px 0', borderRadius: 6, borderWidth: 0, background: theme.muted, color: theme.inkFaint, cursor: 'pointer', fontFamily: 'inherit' },
  dayBtnOn: { background: theme.teal, color: '#fff' },
  cicloCard: { borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, padding: 12, marginBottom: 8 },
  cicloTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  orderBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 },
  arrowBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 9, lineHeight: 1, cursor: 'pointer', padding: 1 },
  arrowOff: { color: theme.line, cursor: 'default' },
  orderNum: { fontSize: 12, fontWeight: 700, color: theme.ink },
  addItemBtn: { width: '100%', padding: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line, borderRadius: theme.radiusSm, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: theme.ink, cursor: 'pointer' },
  checkbox: { width: 16, height: 16, accentColor: theme.teal, cursor: 'pointer' },
  dateInput: { marginTop: 10, padding: '9px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  save: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
