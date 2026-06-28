// components/features/schedule/CycleView.tsx
// Visão de ciclo: donut bússola + lista de matérias. Cabeçalho adapta-se se o
// ciclo é ativo (arquivar/excluir/novo) ou arquivado (reativar/excluir/voltar).
// Inclui seção expansível de ciclos arquivados.
// No mobile o card do progresso (compass) ocupa largura total e fica centralizado.
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getCycleState, completeCycleSubject, undoLastCompletion,
  archiveCycle, deleteCycle, listArchivedCycles,
  type CycleState,
} from '@/services/cycleEngine.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { useConfirm } from '@/hooks/useConfirm';

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

interface ArchivedItem { id: string; createdAt: string }

export function CycleView({
  ruleId, isArchived,
  onNovoCiclo, onArquivado, onExcluido,
  onAbrirArquivado, onReativar, onVoltar,
}: Props) {
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();
  const [state, setState] = useState<CycleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [popupItem, setPopupItem] = useState<{ itemId: string; subjectId: string; planned: number } | null>(null);
  const [popupH, setPopupH] = useState('0');
  const [popupM, setPopupM] = useState('');

  // Arquivados
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<ArchivedItem[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await getCycleState(ruleId));
    } finally {
      setLoading(false);
    }
  }, [ruleId]);

  useEffect(() => { load(); }, [load]);

  const loadArchived = useCallback(async () => {
    setLoadingArchived(true);
    try {
      setArchived(await listArchivedCycles());
    } finally {
      setLoadingArchived(false);
    }
  }, []);

  function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next) loadArchived();
  }

  function openComplete(itemId: string, subjectId: string, planned: number) {
    setPopupItem({ itemId, subjectId, planned });
    setPopupH(String(Math.floor(planned / 60)));
    setPopupM(String(planned % 60));
  }

  async function confirmComplete() {
    if (!popupItem) return;
    setCompleting(popupItem.itemId);
    try {
      const totalMin = (Number(popupH) || 0) * 60 + (Number(popupM) || 0);
      await completeCycleSubject({
        ruleId,
        itemId: popupItem.itemId,
        subjectId: popupItem.subjectId,
        minutes: totalMin,
        source: 'manual',
      });
      setPopupItem(null);
      await load();
    } finally {
      setCompleting(null);
    }
  }

  async function handleUndo(subjectId: string) {
    await undoLastCompletion(ruleId, subjectId);
    await load();
  }

  async function handleArquivar() {
    if (!await confirm({ title: 'Arquivar este ciclo?', description: 'Ele sai do ativo, mas o histórico fica guardado.' })) return;
    try {
      await archiveCycle(ruleId);
      onArquivado();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao arquivar.');
    }
  }

  async function handleExcluir() {
    if (!await confirm({ title: 'Excluir este ciclo de vez?', description: 'O histórico de registros será apagado. Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true })) return;
    try {
      await deleteCycle(ruleId);
      onExcluido();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  function fmtData(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleExcluirArquivado(id: string) {
    if (!await confirm({ title: 'Excluir este ciclo arquivado de vez?', description: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true })) return;
    try {
      await deleteCycle(id);
      await loadArchived();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  if (loading) return <p style={styles.muted}>Carregando ciclo…</p>;
  if (!state) return <p style={styles.muted}>Ciclo não encontrado.</p>;

  const pct = state.dailyMinutes > 0 ? Math.min(100, Math.round((state.todayMinutes / state.dailyMinutes) * 100)) : 0;
  const R = 48;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;

  const fmtH = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  return (
    <>
    {dialog}
    <div>
      {/* Cabeçalho de ações — adapta-se a ativo vs arquivado */}
      <div style={styles.cycleHeader}>
        {isArchived ? (
          <>
            <button onClick={onVoltar} style={styles.novoBtn}>← Voltar aos arquivados</button>
            <div style={styles.cycleHeaderRight}>
              <span style={styles.archivedTag}>Arquivado</span>
              <button onClick={() => onReativar(ruleId)} style={styles.reativarBtn}>Reativar</button>
              <button onClick={handleExcluir} style={styles.excluirBtn}>Excluir</button>
            </div>
          </>
        ) : (
          <>
            <button onClick={onNovoCiclo} style={styles.novoBtn}>+ Novo ciclo</button>
            <div style={styles.cycleHeaderRight}>
              <button onClick={handleArquivar} style={styles.arquivarBtn}>Arquivar</button>
              <button onClick={handleExcluir} style={styles.excluirBtn}>Excluir</button>
            </div>
          </>
        )}
      </div>

      <div style={styles.wrap}>
        <div style={{
          ...styles.compass,
          ...(isMobile ? { flex: '1 1 100%', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' } : {}),
        }}>
          <svg viewBox="0 0 120 120" width="150" height="150" style={{ display: 'block', margin: '0 auto' }}>
            <circle cx="60" cy="60" r={R} fill="none" stroke={theme.muted} strokeWidth="14" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={theme.teal} strokeWidth="14"
              strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
            <text x="60" y="56" textAnchor="middle" fontSize="20" fontWeight="700" fill={theme.ink}>{fmtH(state.todayMinutes)}</text>
            <text x="60" y="76" textAnchor="middle" fontSize="11" fill={theme.inkSoft}>de {fmtH(state.dailyMinutes)}</text>
          </svg>
          <div style={styles.compassLabel}>Meta de hoje</div>
          <div style={styles.compassLap}>
            <span style={styles.lapNum}>{state.totalLaps + 1}ª</span> volta do ciclo
          </div>
        </div>

        <div style={styles.list}>
          {state.subjects.some((s) => s.isSuggested) && (
            <div style={styles.suggestedTag}>Próxima sugerida</div>
          )}
          {state.subjects.map((s) => {
            const isSug = s.isSuggested;
            const progPct = s.plannedMinutes > 0 ? Math.round((s.lapProgress / s.plannedMinutes) * 100) : 0;
            return (
              <div key={s.itemId} style={{ ...styles.row, ...(isSug ? styles.rowSuggested : {}) }}>
                <span style={{ ...styles.dot, background: s.subjectColor }} />
                <div style={styles.rowInfo}>
                  <div style={{ ...styles.rowName, ...(isSug ? { fontWeight: 700 } : {}) }}>
                    {s.subjectName}
                    {s.laps > 0 && <span style={styles.lapBadge}>{s.laps} {s.laps === 1 ? 'volta' : 'voltas'}</span>}
                  </div>
                  {/* progresso da volta atual */}
                  <div style={styles.progressLine}>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${progPct}%`, background: s.subjectColor }} />
                    </div>
                    <span style={styles.progressText}>{fmtH(s.lapProgress)} de {fmtH(s.plannedMinutes)}</span>
                  </div>
                  {!isArchived && s.totalMinutes > 0 && (
                    <button onClick={() => handleUndo(s.subjectId)} style={styles.undoBtn} title="Desfazer último registro">desfazer último</button>
                  )}
                </div>
                {!isArchived && (
                  <button
                    onClick={() => openComplete(s.itemId, s.subjectId, s.plannedMinutes)}
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

      {/* Seção de arquivados (só quando vendo o ciclo ativo) */}
      {!isArchived && (
        <div style={styles.archivedSection}>
          <button onClick={toggleArchived} style={styles.archivedToggle}>
            {showArchived ? '▾' : '▸'} Ciclos arquivados
          </button>
          {showArchived && (
            <div style={styles.archivedList}>
              {loadingArchived ? (
                <p style={styles.muted}>Carregando…</p>
              ) : archived.length === 0 ? (
                <p style={styles.archivedEmpty}>Nenhum ciclo arquivado ainda.</p>
              ) : (
                archived.map((a) => (
                  <div key={a.id} style={styles.archivedRow}>
                    <span style={styles.archivedDate}>Ciclo de {fmtData(a.createdAt)}</span>
                    <div style={styles.archivedActions}>
                      <button onClick={() => onAbrirArquivado(a.id)} style={styles.archivedActionBtn}>Abrir</button>
                      <button onClick={() => onReativar(a.id)} style={styles.archivedActionBtn}>Reativar</button>
                      <button onClick={() => handleExcluirArquivado(a.id)} style={styles.archivedActionDanger}>Excluir</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {popupItem && (
        <div style={styles.overlay} onClick={() => setPopupItem(null)}>
          <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.popupTitle}>Quanto você estudou?</h3>
            <div style={styles.popupDurRow}>
              <input type="number" min="0" value={popupH} autoFocus onChange={(e) => setPopupH(e.target.value)} style={styles.popupDurInput} />
              <span style={styles.popupDurUnit}>h</span>
              <input type="number" min="0" max="59" value={popupM} onChange={(e) => setPopupM(e.target.value)} style={styles.popupDurInput} />
              <span style={styles.popupDurUnit}>min</span>
            </div>
            <div style={styles.popupActions}>
              <button onClick={() => setPopupItem(null)} style={styles.popupCancel}>Cancelar</button>
              <button onClick={confirmComplete} style={styles.popupConfirm}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cycleHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  cycleHeaderRight: { display: 'flex', alignItems: 'center', gap: 8 },
  novoBtn: { padding: '8px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  arquivarBtn: { padding: '7px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reativarBtn: { padding: '7px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  excluirBtn: { padding: '7px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.danger, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  archivedTag: { fontSize: 11, fontWeight: 700, color: theme.inkSoft, background: 'rgba(15,23,42,.05)', padding: '4px 10px', borderRadius: 999, letterSpacing: 0.3 },
  wrap: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  muted: { color: theme.inkFaint, fontSize: 14 },
  compass: { flex: '0 0 200px', background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 20, textAlign: 'center' },
  compassLabel: { marginTop: 12, fontSize: 13, color: theme.inkSoft },
  compassLap: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line, fontSize: 13, color: theme.inkSoft },
  lapNum: { fontSize: 20, fontWeight: 700, color: theme.ink },
  list: { flex: 1, minWidth: 0 },
  suggestedTag: { display: 'inline-block', fontSize: 12, fontWeight: 600, color: theme.tealDeep, background: theme.tealBg, padding: '4px 10px', borderRadius: theme.radiusSm, marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radius, marginBottom: 8, background: theme.card, minWidth: 0 },
  rowSuggested: { borderWidth: 2, borderColor: theme.teal },
  dot: { width: 12, height: 12, borderRadius: 3, flexShrink: 0, alignSelf: 'flex-start', marginTop: 3 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, color: theme.ink, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lapBadge: { fontSize: 11, fontWeight: 600, color: theme.tealDeep, background: theme.tealBg, padding: '2px 7px', borderRadius: 6 },
  progressLine: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 },
  progressTrack: { flex: 1, height: 5, background: theme.muted, borderRadius: 999, overflow: 'hidden', maxWidth: 160 },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width .4s ease' },
  progressText: { fontSize: 11, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  undoBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: 4, fontFamily: 'inherit' },
  completeBtn: { padding: '7px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, alignSelf: 'flex-start' },
  completeBtnPrimary: { background: theme.teal, color: '#fff', borderWidth: 0 },
  archivedSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line },
  archivedToggle: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  archivedList: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  archivedEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  archivedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, background: theme.card, flexWrap: 'wrap' },
  archivedDate: { fontSize: 13.5, color: theme.ink, fontWeight: 500 },
  archivedActions: { display: 'flex', alignItems: 'center', gap: 6 },
  archivedActionBtn: { padding: '5px 11px', borderRadius: 7, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  archivedActionDanger: { padding: '5px 11px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.danger, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,28,24,0.4)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 20 },
  popup: { background: theme.card, borderRadius: theme.radius, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24, width: '100%', maxWidth: 340, fontFamily: theme.font },
  popupTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 16px' },
  popupDurRow: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' },
  popupDurInput: { width: 70, boxSizing: 'border-box', padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 16, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  popupDurUnit: { fontSize: 13, color: theme.inkSoft },
  popupActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
  popupCancel: { padding: '9px 16px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  popupConfirm: { padding: '9px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};