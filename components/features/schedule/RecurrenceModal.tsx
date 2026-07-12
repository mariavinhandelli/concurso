// components/features/schedule/RecurrenceModal.tsx
// Shell do modal de recorrência. Estado de cada modo fica isolado em:
//   DiaFixoForm.tsx  → diaItems + validação do modo dia-fixo
//   CicloForm.tsx    → cicloItems + meta + validação do modo ciclo
'use client';

import { useEffect, useRef, useState } from 'react';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { useToast } from '@/components/ui/ToastProvider';
import { createRule, editRuleVersioned, type RuleSummary, type RecurrenceMode } from '@/services/recurrence.service';
import { theme } from '@/lib/theme';
import { toLocalDateString } from '@/lib/local-date';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DiaFixoForm, type DiaFixoFormRef } from './DiaFixoForm';
import { CicloForm, type CicloFormRef } from './CicloForm';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  editRule?: RuleSummary | null;
  modoInicial?: RecurrenceMode;
}

export function RecurrenceModal({ onClose, onCreated, editRule = null, modoInicial = 'dia_fixo' }: Props) {
  const isEdit = !!editRule;
  const toast = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mode, setMode] = useState<RecurrenceMode>(editRule?.mode ?? modoInicial);
  const [indeterminado, setIndeterminado] = useState(() => editRule ? !editRule.endDate : true);
  const [endDate, setEndDate] = useState(() => editRule?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const diaRef = useRef<DiaFixoFormRef>(null);
  const cicloRef = useRef<CicloFormRef>(null);

  useEffect(() => {
    listSubjects()
      .then(setSubjects)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar matérias.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setError('');
    if (!indeterminado && !endDate) { setError('Defina a data final ou marque "indeterminado".'); return; }

    let items;
    let cycleDailyMinutes: number | undefined;

    if (mode === 'dia_fixo') {
      const result = diaRef.current?.getItems();
      if (result === null || result === undefined) return; // validação falhou no sub-form
      items = result;
    } else {
      const result = cicloRef.current?.getItems();
      if (result === null || result === undefined) return;
      items = result.items;
      cycleDailyMinutes = result.cycleDailyMinutes;
    }

    setSaving(true);
    try {
      const payload = { mode, endDate: indeterminado ? null : endDate, cycleDailyMinutes, items };
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
    <Overlay onClose={onClose} maxWidth={480} labelledBy="recurrence-modal-title">
      <h2 id="recurrence-modal-title" style={styles.h2}>{isEdit ? 'Editar recorrência' : 'Nova recorrência'}</h2>
        <p style={styles.subtitle}>
          {isEdit
            ? 'As mudanças valem a partir de hoje. As semanas passadas ficam como estavam.'
            : 'Defina um padrão que se repete sozinho.'}
        </p>

        {!isEdit && (
          <div style={{ marginBottom: 8 }}>
            <SegmentedControl
              options={[{ value: 'dia_fixo', label: 'Dia fixo' }, { value: 'ciclo', label: 'Ciclo' }]}
              value={mode}
              onChange={setMode}
            />
          </div>
        )}
        <p style={styles.modeHint}>
          {mode === 'dia_fixo'
            ? 'Cada matéria se repete nos dias da semana que você marcar.'
            : 'As matérias formam uma fila que gira: você estuda a próxima sugerida e a roda avança.'}
        </p>

        {/* Sub-forms: cada um monta seu próprio estado isolado */}
        {mode === 'dia_fixo'
          ? <DiaFixoForm ref={diaRef} subjects={subjects} editRule={editRule} />
          : <CicloForm ref={cicloRef} subjects={subjects} editRule={editRule} />
        }

        <label style={styles.sectionLabel}>Prazo</label>
        <label style={styles.checkRow}>
          <input type="checkbox" checked={indeterminado} onChange={(e) => setIndeterminado(e.target.checked)} style={styles.checkbox} />
          <span>Indeterminado</span>
        </label>
        {!indeterminado && (
          <Input type="date" value={endDate} min={toLocalDateString()} onChange={(e) => setEndDate(e.target.value)} style={{ marginTop: 10 }} />
        )}

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar recorrência')}
          </Button>
        </div>
    </Overlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 16px', lineHeight: 1.5 },
  modeHint: { fontSize: 12, color: theme.inkFaint, margin: '0 0 8px', lineHeight: 1.5 },
  sectionLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: theme.inkSoft, margin: '16px 0 8px', letterSpacing: 0.3 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: theme.ink, cursor: 'pointer' },
  checkbox: { width: 16, height: 16, accentColor: theme.teal, cursor: 'pointer' },
  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  save: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
