// components/features/schedule/GeneratorModal.tsx
// Gerador automático: lê os pesos do edital, distribui o tempo proporcionalmente
// (piso 30min), e monta uma regra de recorrência (ciclo ou dia-fixo) via createRule.
// No dia-fixo, distribui as matérias pelos dias por peso, intercalando.
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  buildPreview, listTargetExams, type GeneratorPreview, type GeneratorSubject,
} from '@/services/scheduleGenerator.service';
import { createRule, type RecurrenceItemInput, type RecurrenceMode } from '@/services/recurrence.service';
import { theme } from '@/lib/theme';
import { toLocalDateString } from '@/lib/local-date';

interface Props {
  onClose: () => void;
  onGenerated: () => void;
  presetExamId?: string;
}

const DIAS_FULL = [
  { label: 'S', weekday: 1 }, { label: 'T', weekday: 2 }, { label: 'Q', weekday: 3 },
  { label: 'Q', weekday: 4 }, { label: 'S', weekday: 5 }, { label: 'S', weekday: 6 }, { label: 'D', weekday: 0 },
];

// Distribui as matérias pelos dias escolhidos, proporcional ao peso, intercalando.
// Retorna os itens da regra (cada um = matéria num dia, com seu tempo).
function distribuirDiaFixo(
  subjects: GeneratorSubject[],
  diasSemana: number[],
  materiasPorDia: number,
): RecurrenceItemInput[] {
  if (subjects.length === 0 || diasSemana.length === 0) return [];

  const totalSlots = diasSemana.length * materiasPorDia;
  const somaPeso = subjects.reduce((s, x) => s + x.weight, 0);

  // 1) Quantos slots cada matéria ganha (proporcional ao peso, piso 1).
  const slotsPorMateria = subjects.map((s) => ({
    subject: s,
    slots: Math.max(1, Math.round((s.weight / somaPeso) * totalSlots)),
  }));

  // 2) Tempo por aparição: o tempo proporcional da matéria dividido pelos slots dela.
  // Garante que pesada tenha sessão >= leve (o minutesPerCycle já é proporcional ao peso).
  const tempoPorSlot = (sm: { subject: GeneratorSubject; slots: number }) => {
    const base = Math.round((sm.subject.minutesPerCycle / sm.slots) / 5) * 5;
    return Math.max(30, base); // piso 30min por sessão
  };

  // 3) Monta uma fila de aparições (cada matéria repetida 'slots' vezes).
  // Ordena por slots desc pra distribuir as mais frequentes primeiro.
  const fila: { subjectId: string; minutes: number }[] = [];
  const expandidas = slotsPorMateria
    .map((sm) => ({ id: sm.subject.subjectId, slots: sm.slots, minutes: tempoPorSlot(sm) }))
    .sort((a, b) => b.slots - a.slots);

  // round-robin: vai pegando uma de cada matéria por rodada até esgotar os slots
  const restante = expandidas.map((e) => ({ ...e }));
  let total = restante.reduce((s, e) => s + e.slots, 0);
  while (total > 0) {
    for (const e of restante) {
      if (e.slots > 0) {
        fila.push({ subjectId: e.id, minutes: e.minutes });
        e.slots--;
        total--;
      }
    }
  }

  // 4) Distribui a fila pelos dias, intercalando (evita mesma matéria em dia seguido).
  // Estratégia: preenche dia a dia; em cada slot, pega da fila a próxima matéria que
  // não seja igual à última colocada no dia anterior, quando possível.
  const items: RecurrenceItemInput[] = [];
  const porDia: { subjectId: string; minutes: number }[][] = diasSemana.map(() => []);

  let ultimaDoDiaAnterior: string | null = null;
  for (let d = 0; d < diasSemana.length; d++) {
    for (let k = 0; k < materiasPorDia && fila.length > 0; k++) {
      // procura na fila a primeira que difere da última do dia anterior (e da já posta hoje)
      const jaHoje = new Set(porDia[d].map((x) => x.subjectId));
      let idx = fila.findIndex((f) => f.subjectId !== ultimaDoDiaAnterior && !jaHoje.has(f.subjectId));
      if (idx === -1) idx = fila.findIndex((f) => !jaHoje.has(f.subjectId));
      if (idx === -1) idx = 0;
      const escolhido = fila.splice(idx, 1)[0];
      porDia[d].push(escolhido);
    }
    if (porDia[d].length > 0) ultimaDoDiaAnterior = porDia[d][porDia[d].length - 1].subjectId;
  }

  // Sobras (se a fila ainda tem itens) entram nos dias com menos carga.
  while (fila.length > 0) {
    let menorDia = 0;
    for (let d = 1; d < porDia.length; d++) if (porDia[d].length < porDia[menorDia].length) menorDia = d;
    porDia[menorDia].push(fila.shift()!);
  }

  // Converte em itens da regra.
  for (let d = 0; d < diasSemana.length; d++) {
    porDia[d].forEach((slot, pos) => {
      items.push({
        subjectId: slot.subjectId,
        plannedMinutes: slot.minutes,
        weekday: diasSemana[d],
        position: pos,
      });
    });
  }

  return items;
}

export function GeneratorModal({ onClose, onGenerated, presetExamId }: Props) {
  const [exams, setExams] = useState<{ id: string; label: string }[]>([]);
  const [examId, setExamId] = useState(presetExamId ?? '');
  const [mode, setMode] = useState<RecurrenceMode>('ciclo');
  const [temData, setTemData] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [horasDia, setHorasDia] = useState('4');
  const [diasSemana, setDiasSemana] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]));
  const [materiasPorDia, setMateriasPorDia] = useState('3');

  const [preview, setPreview] = useState<GeneratorPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listTargetExams().then((list) => {
      setExams(list);
      if (!presetExamId && list[0]) setExamId(list[0].id);
    }).catch(() => {});
  }, [presetExamId]);

  const cargaMinutos = (Number(horasDia) || 0) * 60;

  const recalc = useCallback(async () => {
    if (!examId || cargaMinutos <= 0) { setPreview(null); return; }
    setLoading(true);
    try {
      setPreview(await buildPreview(examId, cargaMinutos));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular.');
    } finally {
      setLoading(false);
    }
  }, [examId, cargaMinutos]);

  useEffect(() => { recalc(); }, [recalc]);

  function toggleDia(weekday: number) {
    setDiasSemana((prev) => {
      const next = new Set(prev);
      next.has(weekday) ? next.delete(weekday) : next.add(weekday);
      return next;
    });
  }

  function diasUntil(): number | null {
    if (!temData || !examDate) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const prova = new Date(examDate + 'T12:00:00');
    const diff = Math.ceil((prova.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }

  async function handleGenerate() {
    if (!preview || preview.subjects.length === 0) { setError('Sem matérias com peso neste edital.'); return; }
    setSaving(true);
    setError('');

    const endDate = (temData && examDate) ? examDate : null;
    let items: RecurrenceItemInput[] = [];

    if (mode === 'ciclo') {
      preview.subjects.forEach((s, i) => {
        items.push({ subjectId: s.subjectId, plannedMinutes: s.minutesPerCycle, cycleOrder: i, position: i });
      });
    } else {
      const dias = Array.from(diasSemana).sort();
      if (dias.length === 0) { setError('Escolha ao menos um dia da semana.'); setSaving(false); return; }
      const mpd = Math.max(1, Number(materiasPorDia) || 1);
      items = distribuirDiaFixo(preview.subjects, dias, mpd);
    }

    try {
      await createRule({
        mode,
        endDate,
        cycleDailyMinutes: mode === 'ciclo' ? cargaMinutos : undefined,
        items,
      });
      onGenerated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar.');
      setSaving(false);
    }
  }

  const fmtH = (min: number) => {
    const h = Math.floor(min / 60); const m = min % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const dias = diasUntil();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>Gerar cronograma do edital</h2>
        <p style={styles.subtitle}>Distribui o tempo entre as matérias conforme o peso de cada uma na prova. Você pode editar depois.</p>

        <label style={styles.label}>Edital</label>
        <select value={examId} onChange={(e) => setExamId(e.target.value)} style={styles.input}>
          <option value="">Selecione…</option>
          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.label}</option>)}
        </select>

        <label style={styles.label}>Tipo de cronograma</label>
        <div style={styles.modeToggle}>
          <button onClick={() => setMode('ciclo')} style={{ ...styles.modeBtn, ...(mode === 'ciclo' ? styles.modeBtnOn : {}) }}>Ciclo</button>
          <button onClick={() => setMode('dia_fixo')} style={{ ...styles.modeBtn, ...(mode === 'dia_fixo' ? styles.modeBtnOn : {}) }}>Dia fixo</button>
        </div>
        <p style={styles.modeHint}>
          {mode === 'ciclo'
            ? 'As matérias formam uma fila que gira — naturalmente variado.'
            : 'As matérias são distribuídas pelos dias da semana conforme o peso, intercalando.'}
        </p>

        <label style={styles.checkRow}>
          <input type="checkbox" checked={temData} onChange={(e) => setTemData(e.target.checked)} style={styles.checkbox} />
          <span>Tenho data de prova marcada (reta final)</span>
        </label>
        {temData && (
          <>
            <input type="date" value={examDate} min={toLocalDateString()} onChange={(e) => setExamDate(e.target.value)} style={styles.input} />
            {dias !== null && <p style={styles.daysInfo}>Faltam <b>{dias} dias</b> para a prova. O cronograma terminará na véspera.</p>}
          </>
        )}

        <label style={styles.label}>{mode === 'ciclo' ? 'Carga de estudo por dia' : 'Tempo-base por dia'}</label>
        <div style={styles.durRow}>
          <input type="number" min="1" step="1" value={horasDia} onChange={(e) => setHorasDia(e.target.value)} style={styles.durInput} />
          <span style={styles.durUnit}>horas</span>
        </div>

        {mode === 'dia_fixo' && (
          <>
            <label style={styles.label}>Matérias por dia</label>
            <div style={styles.durRow}>
              <input type="number" min="1" max="6" value={materiasPorDia} onChange={(e) => setMateriasPorDia(e.target.value)} style={styles.durInput} />
              <span style={styles.durUnit}>matérias em cada dia</span>
            </div>

            <label style={styles.label}>Dias de estudo na semana</label>
            <div style={styles.daysRow}>
              {DIAS_FULL.map((d, i) => {
                const on = diasSemana.has(d.weekday);
                return <button key={i} onClick={() => toggleDia(d.weekday)} style={{ ...styles.dayBtn, ...(on ? styles.dayBtnOn : {}) }}>{d.label}</button>;
              })}
            </div>
          </>
        )}

        <label style={styles.label}>Prévia da distribuição (tempo por matéria)</label>
        {loading ? (
          <p style={styles.muted}>Calculando…</p>
        ) : !preview || preview.subjects.length === 0 ? (
          <p style={styles.muted}>Selecione um edital com matérias e pesos cadastrados.</p>
        ) : (
          <div style={styles.previewList}>
            {preview.subjects.map((s) => (
              <div key={s.subjectId} style={styles.previewRow}>
                <span style={{ ...styles.dot, background: s.subjectColor }} />
                <span style={styles.previewName}>{s.subjectName}</span>
                <span style={styles.previewBar}>
                  <span style={{ ...styles.previewFill, width: `${s.sharePct}%`, background: s.subjectColor }} />
                </span>
                <span style={styles.previewTime}>{fmtH(s.minutesPerCycle)}</span>
              </div>
            ))}
            {mode === 'dia_fixo' && <p style={styles.previewNote}>No dia-fixo, matérias com mais peso aparecem em mais dias e com sessões maiores.</p>}
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancel}>Cancelar</button>
          <button onClick={handleGenerate} disabled={saving || !preview || preview.subjects.length === 0} style={styles.save}>
            {saving ? 'Gerando…' : 'Gerar cronograma'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 },
  modal: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', fontFamily: theme.font },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 16px', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, margin: '14px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  modeToggle: { display: 'flex', gap: 4, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 4 },
  modeBtn: { flex: 1, padding: '9px 0', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  modeBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  modeHint: { fontSize: 12, color: theme.inkFaint, margin: '8px 0 0', lineHeight: 1.5 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: theme.ink, cursor: 'pointer', margin: '14px 0 8px' },
  checkbox: { width: 16, height: 16, accentColor: theme.teal, cursor: 'pointer' },
  daysInfo: { fontSize: 12.5, color: theme.tealDeep, background: theme.tealBg, padding: '8px 12px', borderRadius: theme.radiusSm, margin: '8px 0 0', lineHeight: 1.4 },
  durRow: { display: 'flex', alignItems: 'center', gap: 8 },
  durInput: { width: 70, padding: '9px 10px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  durUnit: { fontSize: 13, color: theme.inkSoft },
  daysRow: { display: 'flex', gap: 5 },
  dayBtn: { flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 600, padding: '8px 0', borderRadius: 6, borderWidth: 0, background: theme.muted, color: theme.inkFaint, cursor: 'pointer', fontFamily: 'inherit' },
  dayBtnOn: { background: theme.teal, color: '#fff' },
  muted: { color: theme.inkFaint, fontSize: 13 },
  previewList: { display: 'flex', flexDirection: 'column', gap: 8 },
  previewRow: { display: 'flex', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  previewName: { fontSize: 13, color: theme.ink, width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  previewBar: { flex: 1, height: 7, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  previewFill: { display: 'block', height: '100%', borderRadius: 999 },
  previewTime: { fontSize: 12.5, fontWeight: 600, color: theme.inkSoft, width: 56, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  previewNote: { fontSize: 11.5, color: theme.inkFaint, marginTop: 6, lineHeight: 1.4 },
  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  save: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
