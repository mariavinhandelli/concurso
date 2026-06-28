// app/(app)/targets/page.tsx
// Concursos-alvo: cadastrar (com fase pré/pós-edital), marcar foco, promover
// pré→pós. A banca é selecionada da lista estruturada (exam_boards), com opção
// de cadastrar uma nova na hora.
'use client';

import { useEffect, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import {
  listTargetExams, createTargetExam, setPrimaryTargetExam,
  deleteTargetExam, promoteToPos, updateTargetExamDate, type TargetExam,
} from '@/services/targetExams.service';
import { listAllBoards, createBoard, type Board } from '@/services/boards.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

export default function TargetsPage() {
  const router = useRouter();
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const [targets, setTargets] = useState<TargetExam[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  // Form de novo alvo
  const [boardId, setBoardId] = useState('');
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [ano, setAno] = useState('');
  const [examDate, setExamDate] = useState('');
  const [phase, setPhase] = useState<'pre' | 'pos'>('pre');

  // Edição inline de data
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState('');

  // Modal de promoção pré→pós
  const [promotingTarget, setPromotingTarget] = useState<TargetExam | null>(null);
  const [promoteBoardId, setPromoteBoardId] = useState('');

  // Cadastro inline de nova banca
  const [addingBoard, setAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  async function load() {
    try {
      const [t, b] = await Promise.all([listTargetExams(), listAllBoards()]);
      setTargets(t);
      setBoards(b);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar concursos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreateBoardInline() {
    if (!newBoardName.trim()) return;
    try {
      await createBoard(newBoardName);
      const updated = await listAllBoards();
      setBoards(updated);
      const nova = updated.find((b) => b.name === newBoardName.trim());
      if (nova) setBoardId(nova.id);
      setNewBoardName('');
      setAddingBoard(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar banca.');
    }
  }

  async function handleCreate() {
    if (phase === 'pos' && !boardId) {
      toast.error('Na fase pós-edital, a banca é obrigatória.');
      return;
    }
    try {
      const novo = await createTargetExam({
        board_id: boardId || null,
        orgao: orgao || null,
        cargo: cargo || null,
        ano_alvo: ano ? Number(ano) : null,
        exam_date: examDate || null,
        phase,
      });
      setBoardId(''); setOrgao(''); setCargo(''); setAno(''); setExamDate(''); setPhase('pre');
      await load();
      router.push(`/targets/${novo.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar concurso.');
    }
  }

  async function handleSetPrimary(id: string, jaEhFoco: boolean) {
    if (jaEhFoco) return;
    try {
      await setPrimaryTargetExam(id);
      toast.success('Concurso definido como foco.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao definir foco.');
    }
  }

  async function handlePromote(t: TargetExam) {
    if (!t.board_id) {
      if (boards.length === 0) {
        toast.error('Cadastre uma banca antes de promover.');
        return;
      }
      setPromotingTarget(t);
      setPromoteBoardId(boards[0]?.id ?? '');
      return;
    }
    try {
      await promoteToPos(t.id);
      toast.success('Concurso promovido para pós-edital.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao promover.');
    }
  }

  async function handleConfirmPromote() {
    if (!promotingTarget || !promoteBoardId) return;
    try {
      await promoteToPos(promotingTarget.id, promoteBoardId);
      setPromotingTarget(null);
      setPromoteBoardId('');
      toast.success('Concurso promovido para pós-edital.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao promover.');
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ title: 'Apagar este concurso-alvo?', description: 'Os pesos e configurações definidos nele também serão apagados.', confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteTargetExam(id);
      toast.success('Concurso apagado.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar.');
    }
  }

  async function handleSaveDate(id: string) {
    try {
      await updateTargetExamDate(id, editingDateValue || null);
      setEditingDateId(null);
      toast.success(editingDateValue ? 'Data da prova salva.' : 'Data removida.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar data.');
    }
  }

  function rotulo(t: TargetExam): string {
    const bancaVis = t.boardName ?? 'Banca a definir';
    return [bancaVis, t.orgao, t.cargo, t.ano_alvo].filter(Boolean).join(' · ');
  }

  const bancaObrigatoria = phase === 'pos';

  return (
    <>
    {dialog}
    <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Concursos-alvo</h1>
        <p style={styles.sub}>Cadastre o concurso e abra para montar o edital e definir os pesos.</p>
      </div>

      {/* Form de novo alvo */}
      <div style={styles.createCard}>
        <div style={styles.phaseToggle}>
          <button onClick={() => setPhase('pre')} style={{ ...styles.phaseBtn, ...(phase === 'pre' ? styles.phaseBtnOn : {}) }}>
            Pré-edital
          </button>
          <button onClick={() => setPhase('pos')} style={{ ...styles.phaseBtn, ...(phase === 'pos' ? styles.phaseBtnOn : {}) }}>
            Pós-edital
          </button>
        </div>
        <p style={styles.phaseHint}>
          {phase === 'pre'
            ? 'Edital ainda não saiu — a banca é opcional, você define depois.'
            : 'Edital publicado — informe a banca definida.'}
        </p>

        <div style={styles.formGrid}>
          {addingBoard ? (
            <div style={styles.inlineBoard}>
              <input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBoardInline()}
                placeholder="Nome da nova banca"
                autoFocus
                style={styles.input}
              />
              <button onClick={handleCreateBoardInline} style={styles.miniBtn}>Salvar</button>
              <button onClick={() => { setAddingBoard(false); setNewBoardName(''); }} style={styles.miniBtnGhost}>Cancelar</button>
            </div>
          ) : (
            <div style={{ ...styles.selectWrap, flexBasis: isMobile ? '100%' : undefined }}>
              <select
                value={boardId}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setAddingBoard(true); return; }
                  setBoardId(e.target.value);
                }}
                style={{ ...styles.input, ...(bancaObrigatoria && !boardId ? styles.inputAlert : {}) }}
              >
                <option value="">{bancaObrigatoria ? 'Banca (obrigatória)' : 'Banca (opcional)'}</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
                <option value="__new__">+ Nova banca…</option>
              </select>
            </div>
          )}

          <input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Órgão (ex: TCE-GO)" style={{ ...styles.input, flexBasis: isMobile ? '100%' : undefined }} />
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (ex: Auditor)" style={{ ...styles.input, flexBasis: isMobile ? '100%' : undefined }} />
          <input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="Ano" type="number" style={{ ...styles.input, maxWidth: isMobile ? '100%' : 90, flexBasis: isMobile ? '100%' : undefined }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexBasis: isMobile ? '100%' : undefined }}>
            <label style={styles.dateLabel}>Data da prova (opcional)</label>
            <input value={examDate} onChange={(e) => setExamDate(e.target.value)} type="date" style={{ ...styles.input }} />
          </div>
        </div>
        <button onClick={handleCreate} style={{ ...styles.addBtn, width: isMobile ? '100%' : undefined }}>Adicionar concurso</button>
      </div>

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : targets.length === 0 ? (
        <p style={styles.muted}>Nenhum concurso-alvo ainda. Cadastre o primeiro acima.</p>
      ) : (
        <div style={styles.list}>
          {targets.map((t) => (
            <div key={t.id} style={{ ...styles.targetRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {/* Estrela de foco */}
              <button
                onClick={() => handleSetPrimary(t.id, t.is_primary)}
                style={styles.starBtn}
                title={t.is_primary ? 'Este é o concurso em foco' : 'Definir como foco'}
                aria-label={t.is_primary ? 'Concurso em foco' : 'Definir como foco'}
              >
                <svg
                  width="19" height="19" viewBox="0 0 24 24"
                  fill={t.is_primary ? theme.teal : 'none'}
                  stroke={t.is_primary ? theme.teal : theme.inkFaint}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                </svg>
              </button>

              {/* Conteúdo clicável → abre o edital */}
              <div style={styles.targetMain} onClick={() => router.push(`/targets/${t.id}`)}>
                <span style={styles.targetLabel}>{rotulo(t)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...styles.phaseTag, ...(t.phase === 'pos' ? styles.phaseTagPos : styles.phaseTagPre) }}>
                    {t.phase === 'pos' ? 'Pós-edital' : 'Pré-edital'}
                  </span>
                  {editingDateId === t.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={editingDateValue}
                        onChange={(e) => setEditingDateValue(e.target.value)}
                        autoFocus
                        style={styles.dateInput}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDate(t.id); if (e.key === 'Escape') setEditingDateId(null); }}
                      />
                      <button onClick={() => handleSaveDate(t.id)} style={styles.dateSaveBtn}>✓</button>
                      <button onClick={() => setEditingDateId(null)} style={styles.dateCancelBtn}>✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingDateId(t.id); setEditingDateValue(t.exam_date ?? ''); }}
                      style={styles.dateBtn}
                      title="Definir data da prova"
                    >
                      {t.exam_date
                        ? `📅 ${new Date(t.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')}`
                        : '+ data da prova'}
                    </button>
                  )}
                </div>
              </div>

              {/* Ações à direita — quebram pra 2ª linha no mobile */}
              <div style={{ ...styles.targetActions, ...(isMobile ? { width: '100%', justifyContent: 'flex-end', marginTop: 4 } : {}) }}>
                {t.phase === 'pre' && (
                  <button onClick={() => handlePromote(t)} style={styles.promoteBtn}>
                    Edital saiu →
                  </button>
                )}
                <button onClick={() => router.push(`/targets/${t.id}`)} style={styles.iconBtn} title="Abrir edital" aria-label="Abrir edital">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <path d="M15 3h6v6M10 14L21 3" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(t.id)} style={styles.iconBtn} title="Apagar" aria-label="Apagar concurso">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Modal de promoção pré → pós */}
    {promotingTarget && (
      <div style={styles.promoteOverlay} onClick={() => setPromotingTarget(null)}>
        <div style={styles.promoteModal} onClick={(e) => e.stopPropagation()}>
          <h3 style={styles.promoteTitle}>Edital saiu! Qual é a banca?</h3>
          <p style={styles.promoteSub}>Selecione a banca definida para <strong>{rotulo(promotingTarget)}</strong>.</p>
          <select
            value={promoteBoardId}
            onChange={(e) => setPromoteBoardId(e.target.value)}
            style={styles.input}
            autoFocus
          >
            {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setPromotingTarget(null)} style={styles.miniBtnGhost}>Cancelar</button>
            <button onClick={handleConfirmPromote} disabled={!promoteBoardId} style={styles.addBtn}>
              Promover para pós-edital
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 720, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 22 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  createCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 20 },
  phaseToggle: { display: 'inline-flex', gap: 0, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 3, marginBottom: 8 },
  phaseBtn: { padding: '7px 16px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  phaseBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  phaseHint: { fontSize: 12.5, color: theme.inkFaint, margin: '0 0 14px' },
  formGrid: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  selectWrap: { flex: 1, minWidth: 160 },
  inlineBoard: { display: 'flex', gap: 8, flexBasis: '100%', alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  inputAlert: { border: `1.5px solid ${theme.danger}` },
  miniBtn: { padding: '9px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  miniBtnGhost: { padding: '9px 10px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  targetRow: { display: 'flex', alignItems: 'center', gap: 12, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: '12px 14px', transition: 'border-color .15s', minWidth: 0 },
  starBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },
  targetMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', minWidth: 0 },
  targetLabel: { fontSize: 15, color: theme.ink, fontWeight: 500 },
  phaseTag: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', flexShrink: 0 },
  phaseTagPre: { color: theme.inkSoft, background: 'rgba(15,23,42,.06)' },
  phaseTagPos: { color: '#fff', background: theme.teal },
  targetActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  promoteBtn: { border: `0.5px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' },
  iconBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', borderRadius: 8, opacity: 0.75 },
  dateLabel: { fontSize: 11.5, color: theme.inkFaint, fontWeight: 500 },
  dateBtn: { fontSize: 12, color: theme.teal, border: `0.5px dashed ${theme.teal}`, background: 'transparent', borderRadius: 999, padding: '2px 9px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: 0.8 },
  dateInput: { padding: '4px 8px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  dateSaveBtn: { border: 'none', background: theme.teal, color: '#fff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  dateCancelBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  promoteOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 },
  promoteModal: { background: theme.card, borderRadius: 16, padding: '24px', width: 'min(400px, 94vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: theme.font },
  promoteTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  promoteSub: { fontSize: 13.5, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
};