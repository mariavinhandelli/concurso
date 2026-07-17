// components/features/schedule/CycleView.tsx
// Visão de ciclo: donut bússola + lista de matérias + ações de ciclo.
// Seção de arquivados → ArchivedCycles.tsx
// Popup de registro    → CompletionPopup.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getCycleState, completeCycleSubject, undoLastCompletion,
  archiveCycle, deleteCycle, type CycleState,
} from '@/services/cycleEngine.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { useConfirm } from '@/hooks/useConfirm';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArchivedCycles } from './ArchivedCycles';
import { CompletionPopup } from './CompletionPopup';

interface Props {
  ruleId: string;
  isArchived: boolean;
  onNovoCiclo: () => void;
  onArquivado: () => void;
  onExcluido: () => void;
  onAbrirArquivado: (ruleId: string) => void;
  onReativar: (ruleId: string) => void;
  onVoltar: () => void;
}

function fmtH(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function CycleView({
  ruleId, isArchived,
  onNovoCiclo, onArquivado, onExcluido,
  onAbrirArquivado, onReativar, onVoltar,
}: Props) {
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();

  const [state, setState] = useState<CycleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState<string | null>(null);
  const [popupItem, setPopupItem] = useState<{ itemId: string; subjectId: string; planned: number } | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setState(await getCycleState(ruleId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erro ao carregar ciclo.');
    } finally {
      setLoading(false);
    }
  }, [ruleId]);

  useEffect(() => { load(); }, [load]);

  async function confirmComplete(minutes: number) {
    if (!popupItem) return;
    setCompleting(popupItem.itemId);
    setError('');
    try {
      await completeCycleSubject({
        ruleId, itemId: popupItem.itemId, subjectId: popupItem.subjectId,
        minutes, source: 'manual',
      });
      setPopupItem(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar.');
    } finally {
      setCompleting(null);
    }
  }

  async function handleUndo(subjectId: string) {
    setError('');
    try {
      await undoLastCompletion(ruleId, subjectId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao desfazer.');
    }
  }

  async function handleArquivar() {
    if (!await confirm({ title: 'Arquivar este ciclo?', description: 'Ele sai do ativo, mas o histórico fica guardado.' })) return;
    try {
      await archiveCycle(ruleId);
      onArquivado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao arquivar.');
    }
  }

  async function handleExcluir() {
    if (!await confirm({ title: 'Excluir este ciclo de vez?', description: 'O histórico de registros será apagado. Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true })) return;
    try {
      await deleteCycle(ruleId);
      onExcluido();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  if (loading) return <p style={styles.muted}>Carregando ciclo…</p>;
  if (loadError) return <p style={styles.loadErr}>Erro ao carregar: {loadError}</p>;
  if (!state) return <p style={styles.muted}>Ciclo não encontrado.</p>;

  const pct = state.dailyMinutes > 0 ? Math.min(100, Math.round((state.todayMinutes / state.dailyMinutes) * 100)) : 0;
  const R = 48;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  return (
    <>
      {dialog}
      <div>
        {/* Cabeçalho adapta-se a ativo vs arquivado */}
        <div style={styles.cycleHeader}>
          {isArchived ? (
            <>
              <Button variant="outline" size="sm" style={{ borderColor: theme.teal, color: theme.teal }} onClick={onVoltar}>← Voltar aos arquivados</Button>
              <div style={styles.cycleHeaderRight}>
                <Badge variant="neutral">Arquivado</Badge>
                <Button size="sm" onClick={() => onReativar(ruleId)}>Reativar</Button>
                <Button variant="ghost" size="sm" style={{ color: theme.danger }} onClick={handleExcluir}>Excluir</Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" style={{ borderColor: theme.teal, color: theme.teal }} onClick={onNovoCiclo}>+ Novo ciclo</Button>
              <div style={styles.cycleHeaderRight}>
                <Button variant="ghost" size="sm" onClick={handleArquivar}>Arquivar</Button>
                <Button variant="ghost" size="sm" style={{ color: theme.danger }} onClick={handleExcluir}>Excluir</Button>
              </div>
            </>
          )}
        </div>

        {error && <p style={styles.inlineErr}>{error}</p>}

        <div style={styles.wrap}>
          {/* Donut / bússola */}
          <div style={{ ...styles.compass, ...(isMobile ? { flex: '1 1 100%', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' } : {}) }}>
            <svg viewBox="0 0 120 120" width="150" height="150" style={{ display: 'block', margin: '0 auto' }}>
              <circle cx="60" cy="60" r={R} fill="none" stroke={theme.muted} strokeWidth="14" />
              <circle cx="60" cy="60" r={R} fill="none" stroke={theme.teal} strokeWidth="14"
                strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
              <text x="60" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fontFamily="inherit" fill={theme.ink}>{fmtH(state.todayMinutes)}</text>
              <text x="60" y="76" textAnchor="middle" fontSize="11" fontFamily="inherit" fill={theme.inkSoft}>de {fmtH(state.dailyMinutes)}</text>
            </svg>
            <div style={styles.compassLabel}>Meta de hoje</div>
            <div style={styles.compassLap}>
              <span style={styles.lapNum}>{state.totalLaps + 1}ª</span> volta do ciclo
            </div>
          </div>

          {/* Lista de matérias */}
          <div style={styles.list}>
            {state.subjects.map((s) => {
              const isSug = s.isSuggested;
              const progPct = s.plannedMinutes > 0 ? Math.round((s.lapProgress / s.plannedMinutes) * 100) : 0;
              return (
                <div key={s.itemId} style={{ ...styles.row, ...(isSug ? styles.rowSuggested : {}) }}>
                  <span style={{ ...styles.dot, background: s.subjectColor }} />
                  <div style={styles.rowInfo}>
                    <div style={{ ...styles.rowName, ...(isSug ? { fontWeight: 700 } : {}) }}>
                      {s.subjectName}
                      {isSug && <span style={styles.suggestedTag}>→ agora</span>}
                      {s.laps > 0 && <span style={styles.lapBadge}>{s.laps} {s.laps === 1 ? 'volta' : 'voltas'}</span>}
                    </div>
                    <div style={styles.progressLine}>
                      <div style={styles.progressTrack}>
                        <div style={{ ...styles.progressFill, width: `${progPct}%`, background: s.subjectColor }} />
                      </div>
                      <span style={styles.progressText}>{fmtH(s.lapProgress)} de {fmtH(s.plannedMinutes)}</span>
                    </div>
                    {!isArchived && s.totalMinutes > 0 && (
                      <button onClick={() => handleUndo(s.subjectId)} style={styles.undoBtn} title="Desfazer último registro">
                        ↩ desfazer
                      </button>
                    )}
                  </div>
                  {!isArchived && (
                    <button
                      onClick={() => setPopupItem({ itemId: s.itemId, subjectId: s.subjectId, planned: s.plannedMinutes })}
                      disabled={completing === s.itemId}
                      style={{ ...styles.completeBtn, ...(isSug ? styles.completeBtnPrimary : {}) }}
                    >
                      Registrar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Ciclos arquivados — componente autônomo com seu próprio fetch */}
        {!isArchived && (
          <ArchivedCycles
            onAbrirArquivado={onAbrirArquivado}
            onReativar={onReativar}
          />
        )}

        {popupItem && (
          <CompletionPopup
            plannedMinutes={popupItem.planned}
            saving={completing === popupItem.itemId}
            onConfirm={confirmComplete}
            onClose={() => setPopupItem(null)}
          />
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadErr: { color: theme.danger, fontSize: 13 },
  inlineErr: { color: theme.danger, fontSize: 13, margin: '0 0 12px' },
  muted: { color: theme.inkFaint, fontSize: 14 },
  cycleHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  cycleHeaderRight: { display: 'flex', alignItems: 'center', gap: 8 },
  novoBtn: { padding: '8px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  arquivarBtn: { padding: '7px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reativarBtn: { padding: '7px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onPrimary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  excluirBtn: { padding: '7px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  wrap: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  compass: { flex: '0 0 200px', background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 20, textAlign: 'center' },
  compassLabel: { marginTop: 12, fontSize: 13, color: theme.inkSoft },
  compassLap: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line, fontSize: 13, color: theme.inkSoft },
  lapNum: { fontSize: 20, fontWeight: 700, color: theme.ink },
  list: { flex: 1, minWidth: 0 },
  suggestedTag: { display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: theme.tealDeep, background: theme.tealBg, padding: '2px 7px', borderRadius: 6, letterSpacing: '0.02em' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radius, marginBottom: 8, background: theme.card, minWidth: 0 },
  rowSuggested: { background: theme.tealBg, borderColor: theme.teal },
  dot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0, alignSelf: 'flex-start', marginTop: 3 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, color: theme.ink, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lapBadge: { fontSize: 11, fontWeight: 600, color: theme.tealDeep, background: theme.tealBg, padding: '2px 7px', borderRadius: 6 },
  progressLine: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  progressTrack: { flex: 1, height: 7, background: 'rgba(15,23,42,.08)', borderRadius: theme.radiusPill, overflow: 'hidden', maxWidth: 160 },
  progressFill: { height: '100%', borderRadius: theme.radiusPill, transition: 'width .4s ease' },
  progressText: { fontSize: 11, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  undoBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 11, cursor: 'pointer', padding: 0, marginTop: 4, fontFamily: 'inherit', opacity: 0.8 },
  completeBtn: { padding: '7px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, alignSelf: 'flex-start' },
  completeBtnPrimary: { background: theme.teal, color: theme.onTeal, borderWidth: 0 },
};
