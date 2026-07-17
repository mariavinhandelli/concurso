// components/features/schedule/RecurrencePanel.tsx
// Painel de gestão das recorrências ativas. Distingue dia-fixo (matérias + dias)
// de ciclo (sequência + meta/dia). Ações: editar, parar, apagar.
'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listRuleSummaries, stopRule, deleteRule, type RuleSummary,
} from '@/services/recurrence.service';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { Overlay } from '@/components/ui/Overlay';

interface Props {
  onClose: () => void;
  onChanged: () => void;
  onEdit: (ruleId: string) => void;
}

const DIA_NOME = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function RecurrencePanel({ onClose, onChanged, onEdit }: Props) {
  const { confirm, dialog } = useConfirm();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Compartilha o mesmo cache de 'schedule-rules' do useSchedulePage — zero fetch duplicado.
  const { data: rules, isPending } = useQuery({
    queryKey: ['schedule-rules'],
    queryFn: listRuleSummaries,
    staleTime: 5 * 60_000,
  });

  async function handleStop(id: string) {
    if (!await confirm({
      title: 'Parar esta recorrência?',
      description: 'Blocos futuros serão removidos a partir de hoje. O histórico passado é mantido.',
      confirmLabel: 'Parar',
    })) return;
    setBusy(id);
    try {
      await stopRule(id);
      queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
      onChanged();
    } catch {
      setError('Erro ao parar a regra. Tente novamente.');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({
      title: 'Apagar esta recorrência?',
      description: 'O histórico passado também será removido. Esta ação não pode ser desfeita.',
      confirmLabel: 'Apagar',
      danger: true,
    })) return;
    setBusy(id);
    try {
      await deleteRule(id);
      queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
      onChanged();
    } catch {
      setError('Erro ao apagar a regra. Tente novamente.');
    } finally {
      setBusy(null);
    }
  }

  function diasLabel(weekdays: number[]): string {
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    return ordem.filter((w) => weekdays.includes(w)).map((w) => DIA_NOME[w]).join(', ');
  }

  function fmtMeta(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  return (
    <>
    {dialog}
    <Overlay onClose={onClose} maxWidth={460} labelledBy="recurrence-panel-title">
      <h2 id="recurrence-panel-title" style={{ ...styles.h2, marginBottom: 16 }}>Minhas recorrências</h2>
        {error && <p style={styles.errorMsg}>{error}</p>}

        {isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton height={64} borderRadius={theme.radiusSm} />
            <Skeleton height={64} borderRadius={theme.radiusSm} />
          </div>
        ) : !rules || rules.length === 0 ? (
          <p style={styles.empty}>Nenhuma recorrência ativa. Crie uma para automatizar seu cronograma.</p>
        ) : (
          <div style={styles.list}>
            {rules.map((r) => {
              const isCiclo = r.mode === 'ciclo';
              return (
                <div key={r.id} style={styles.ruleCard}>
                  {/* Tipo da regra */}
                  <div style={styles.ruleType}>
                    <span style={{ ...styles.typeBadge, ...(isCiclo ? styles.typeBadgeCiclo : {}) }}>
                      {isCiclo ? 'Ciclo' : 'Dia fixo'}
                    </span>
                    {isCiclo && <span style={styles.metaInfo}>meta {fmtMeta(r.cycleDailyMinutes)}/dia</span>}
                  </div>

                  <div style={styles.ruleMaterias}>
                    {isCiclo ? (
                      // Ciclo: sequência numerada
                      r.materias.map((m, i) => (
                        <div key={m.subjectId} style={styles.materiaRow}>
                          <span style={styles.seqNum}>{i + 1}</span>
                          <span style={{ ...styles.dot, background: m.subjectColor }} />
                          <span style={styles.materiaName}>{m.subjectName}</span>
                          <span style={styles.materiaDias}>{fmtMeta(m.minutes)}</span>
                        </div>
                      ))
                    ) : (
                      // Dia-fixo: matéria + dias
                      r.materias.map((m) => (
                        <div key={m.subjectId} style={styles.materiaRow}>
                          <span style={{ ...styles.dot, background: m.subjectColor }} />
                          <span style={styles.materiaName}>{m.subjectName}</span>
                          <span style={styles.materiaDias}>{diasLabel(m.weekdays)} · {fmtMeta(m.minutes)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={styles.ruleFooter}>
                    <span style={styles.prazo}>
                      {r.endDate ? `até ${new Date(r.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'sem prazo'}
                    </span>
                    <div style={styles.ruleActions}>
                      <button onClick={() => onEdit(r.id)} style={styles.editBtn} disabled={busy === r.id}>Editar</button>
                      <button onClick={() => handleStop(r.id)} style={styles.stopBtn} disabled={busy === r.id}>Parar</button>
                      <button onClick={() => handleDelete(r.id)} style={styles.delBtn} disabled={busy === r.id} title="Apagar (some do passado também)">Apagar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={styles.hint}>”Parar” encerra a recorrência a partir de hoje (o histórico fica). “Apagar” remove tudo, inclusive o passado.</p>
    </Overlay>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  errorMsg: { color: theme.danger, fontSize: 13, margin: '0 0 12px' },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  empty: { color: theme.inkSoft, fontSize: 14, lineHeight: 1.5, padding: '12px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  ruleCard: { borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, padding: 14 },
  ruleType: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeBadge: { fontSize: 11, fontWeight: 700, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '3px 9px', borderRadius: 6, letterSpacing: 0.3 },
  typeBadgeCiclo: { color: theme.tealDeep, background: theme.tealBg },
  metaInfo: { fontSize: 12, color: theme.inkSoft },
  ruleMaterias: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 },
  materiaRow: { display: 'flex', alignItems: 'center', gap: 8 },
  seqNum: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, width: 16, textAlign: 'center', flexShrink: 0 },
  dot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  materiaName: { fontSize: 14, fontWeight: 600, color: theme.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  materiaDias: { fontSize: 12, color: theme.inkSoft, whiteSpace: 'nowrap' },
  ruleFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line, paddingTop: 10 },
  prazo: { fontSize: 12, color: theme.inkFaint },
  ruleActions: { display: 'flex', gap: 8 },
  editBtn: { padding: '6px 12px', borderRadius: 7, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  stopBtn: { padding: '6px 12px', borderRadius: 7, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  delBtn: { padding: '6px 12px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  hint: { fontSize: 12, color: theme.inkFaint, marginTop: 16, lineHeight: 1.5 },
};