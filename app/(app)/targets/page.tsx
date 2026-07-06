// app/(app)/targets/page.tsx
// Central de concursos: "Meus concursos" (alvos ativos, com countdown e
// progresso de montagem) e "Banco de editais" (catálogo navegável com
// detalhes antes de ativar). Criação manual fica recolhida atrás de um botão.
'use client';

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useTargetList } from '@/hooks/useTargetList';
import { formatTargetLabel, daysUntilExam, countdownInfo } from '@/lib/targets';
import { type TargetExam } from '@/services/targetExams.service';
import { BancoEditaisTab } from '@/components/features/targets/BancoEditaisTab';
import { ImportarEditalModal } from '@/components/features/targets/ImportarEditalModal';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type Tab = 'meus' | 'banco';

function savedTab(): Tab {
  if (typeof window === 'undefined') return 'meus';
  return localStorage.getItem('targets_tab') === 'banco' ? 'banco' : 'meus';
}

function ChevronSmall({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function TargetsPage() {
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useUI();
  const {
    targets, boards, topicCounts, loading, promoting,
    dialog, load,
    createTarget, setPrimary, promote, deleteTarget, saveDate, addBoard,
  } = useTargetList();

  const [tab, setTab] = useState<Tab>(savedTab);
  const [showCreate, setShowCreate] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);

  const [boardId, setBoardId] = useState('');
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [ano, setAno] = useState('');
  const [phase, setPhase] = useState<'pre' | 'pos'>('pre');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addingBoard, setAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  const [promotingTarget, setPromotingTarget] = useState<TargetExam | null>(null);
  const [promoteBoardId, setPromoteBoardId] = useState('');

  useEffect(() => { load(); }, [load]);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    localStorage.setItem('targets_tab', t);
  }, []);

  async function handleCreateBoard() {
    if (!newBoardName.trim()) return;
    try {
      const nova = await addBoard(newBoardName.trim());
      setBoardId(nova.id);
      setNewBoardName('');
      setAddingBoard(false);
    } catch {
      // addBoard shows toast
    }
  }

  async function handleCreate() {
    if (phase === 'pos' && !boardId) {
      toast.error('Na fase pós-edital, a banca é obrigatória.');
      return;
    }
    if (!boardId && !orgao.trim() && !cargo.trim() && !ano.trim()) {
      toast.error('Informe ao menos um campo para identificar o concurso.');
      return;
    }
    try {
      const novo = await createTarget({
        board_id: boardId || null,
        orgao: orgao || null,
        cargo: cargo || null,
        ano_alvo: ano && Number.isFinite(Number(ano)) ? Number(ano) : null,
        exam_date: null,
        phase,
      });
      setBoardId(''); setOrgao(''); setCargo(''); setAno(''); setPhase('pre'); setShowAdvanced(false);
      setShowCreate(false);
      router.push(`/targets/${novo.id}`);
    } catch {
      // createTarget shows toast
    }
  }

  async function handlePromote(t: TargetExam) {
    if (!t.board_id) {
      if (boards.length === 0) {
        toast.error('Cadastre uma banca antes de promover para pós-edital.');
        return;
      }
      setPromotingTarget(t);
      setPromoteBoardId(boards[0].id);
      return;
    }
    try {
      await promote(t.id);
    } catch {
      // promote shows toast
    }
  }

  async function handleConfirmPromote() {
    if (!promotingTarget || !promoteBoardId) return;
    try {
      await promote(promotingTarget.id, promoteBoardId);
      setPromotingTarget(null);
      setPromoteBoardId('');
    } catch {
      // promote shows toast
    }
  }

  const bancaObrigatoria = phase === 'pos';

  return (
    <>
      {dialog}
      <div style={{ ...s.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
        <div style={s.header}>
          <h1 style={{ ...s.h1, fontSize: isMobile ? 22 : 28 }}>Concursos</h1>
          <p style={s.sub}>Acompanhe seus concursos e explore editais prontos para começar em um clique.</p>
        </div>

        {/* Abas */}
        <div style={s.tabs}>
          <button onClick={() => handleTabChange('meus')} style={{ ...s.tab, ...(tab === 'meus' ? s.tabOn : {}) }}>
            Meus concursos{targets.length > 0 ? ` (${targets.length})` : ''}
          </button>
          <button onClick={() => handleTabChange('banco')} style={{ ...s.tab, ...(tab === 'banco' ? s.tabOn : {}) }}>
            Banco de editais
          </button>
        </div>

        {tab === 'banco' && (
          <BancoEditaisTab
            isMobile={isMobile}
            onActivated={(targetId) => router.push(`/targets/${targetId}`)}
            onImportar={() => setImportarOpen(true)}
          />
        )}

        {tab === 'meus' && (
          <>
            {/* Ações da aba */}
            <div style={s.actionsRow}>
              <button onClick={() => setShowCreate((v) => !v)} style={s.newBtn}>
                {showCreate ? '– Fechar' : '+ Novo concurso'}
              </button>
              <button onClick={() => setImportarOpen(true)} style={s.importarLink}>
                importar edital colado →
              </button>
            </div>

            {/* Formulário de criação — recolhido por padrão */}
            {showCreate && (
              <div style={{ ...s.createCard, animation: 'focali-slide-down 0.18s ease' }}>
                <div style={s.phaseToggle}>
                  <button onClick={() => setPhase('pre')} style={{ ...s.phaseBtn, ...(phase === 'pre' ? s.phaseBtnOn : {}) }}>Pré-edital</button>
                  <button onClick={() => setPhase('pos')} style={{ ...s.phaseBtn, ...(phase === 'pos' ? s.phaseBtnOn : {}) }}>Pós-edital</button>
                </div>
                <p style={s.phaseHint}>
                  {phase === 'pre'
                    ? 'Edital ainda não saiu — a banca é opcional, você define depois.'
                    : 'Edital publicado — informe a banca definida.'}
                </p>

                <div style={s.formGrid}>
                  <input
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Cargo (ex: Auditor Fiscal)"
                    style={{ ...s.input, flexBasis: isMobile ? '100%' : undefined }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />

                  {addingBoard ? (
                    <div style={{ ...s.inlineBoard, flexBasis: '100%' }}>
                      <input
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                        placeholder="Nome da nova banca"
                        autoFocus
                        style={s.input}
                      />
                      <button onClick={handleCreateBoard} style={s.btnPrimary}>Salvar</button>
                      <button onClick={() => { setAddingBoard(false); setNewBoardName(''); }} style={s.btnGhost}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ ...s.selectWrap, flexBasis: isMobile ? '100%' : undefined }}>
                      <select
                        value={boardId}
                        onChange={(e) => {
                          if (e.target.value === '__new__') { setAddingBoard(true); return; }
                          setBoardId(e.target.value);
                        }}
                        style={{ ...s.input, ...(bancaObrigatoria && !boardId ? s.inputAlert : {}) }}
                      >
                        <option value="">{bancaObrigatoria ? 'Banca (obrigatória)' : 'Banca (opcional)'}</option>
                        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        <option value="__new__">+ Nova banca…</option>
                      </select>
                    </div>
                  )}
                </div>

                {showAdvanced && (
                  <div style={{ ...s.formGrid, marginTop: 0, animation: 'focali-slide-down 0.18s ease' }}>
                    <input
                      value={orgao}
                      onChange={(e) => setOrgao(e.target.value)}
                      placeholder="Órgão (ex: TCE-GO)"
                      style={{ ...s.input, flexBasis: isMobile ? '100%' : undefined }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexBasis: isMobile ? '100%' : 'auto' }}>
                      <label style={s.fieldLabel}>Ano previsto</label>
                      <input
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        placeholder="ex: 2026"
                        type="number"
                        min="2000"
                        max="2100"
                        style={{ ...s.input, maxWidth: isMobile ? '100%' : 110 }}
                      />
                    </div>
                  </div>
                )}

                <div style={s.formFooter}>
                  <button onClick={() => setShowAdvanced((v) => !v)} style={s.btnAdvanced}>
                    <ChevronSmall open={showAdvanced} />
                    {showAdvanced ? 'Menos detalhes' : 'Mais detalhes'}
                  </button>
                  <button onClick={handleCreate} style={{ ...s.btnPrimary, padding: '11px 24px', fontSize: 14, width: isMobile ? '100%' : undefined }}>
                    Adicionar concurso
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div style={s.skeletonList}>
                {[1, 2, 3].map((i) => <div key={i} style={{ ...s.skeletonRow, animationDelay: `${i * 0.1}s` }} />)}
              </div>
            ) : targets.length === 0 ? (
              <div style={s.emptyState}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                </svg>
                <p style={s.emptyTitle}>Ainda sem concursos</p>
                <p style={s.emptyHint}>Explore o banco de editais para ativar um concurso pronto em um clique — ou crie o seu manualmente.</p>
                <button onClick={() => handleTabChange('banco')} style={s.emptyCta}>Explorar banco de editais →</button>
              </div>
            ) : (
              <div style={s.list}>
                {targets.map((t) => (
                  <TargetRow
                    key={t.id}
                    target={t}
                    topicCount={topicCounts[t.id] ?? 0}
                    isMobile={isMobile}
                    onSetPrimary={() => setPrimary(t.id, t.is_primary)}
                    onOpen={() => router.push(`/targets/${t.id}`)}
                    onPromote={() => handlePromote(t)}
                    onDelete={() => deleteTarget(t.id)}
                    onSaveDate={(date) => saveDate(t.id, date)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {importarOpen && (
        <ImportarEditalModal
          onClose={() => setImportarOpen(false)}
          onImported={(targetId) => { setImportarOpen(false); router.push(`/targets/${targetId}`); }}
        />
      )}

      {promotingTarget && (
        <div style={s.promoteOverlay} onClick={() => setPromotingTarget(null)}>
          <div style={s.promoteModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.promoteTitle}>Edital publicado! Qual é a banca?</h3>
            <p style={s.promoteSub}>Selecione a banca definida para <strong>{formatTargetLabel(promotingTarget)}</strong>.</p>
            <select value={promoteBoardId} onChange={(e) => setPromoteBoardId(e.target.value)} style={s.input} autoFocus>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setPromotingTarget(null)} style={s.btnGhost}>Cancelar</button>
              <button onClick={handleConfirmPromote} disabled={!promoteBoardId || promoting} style={s.btnPrimary}>
                {promoting ? 'Promovendo…' : 'Promover para pós-edital'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface TargetRowProps {
  target: TargetExam;
  topicCount: number;
  isMobile: boolean;
  onSetPrimary: () => void;
  onOpen: () => void;
  onPromote: () => void;
  onDelete: () => void;
  onSaveDate: (date: string | null) => Promise<void>;
}

const TargetRow = memo(function TargetRow({
  target: t, topicCount, isMobile, onSetPrimary, onOpen, onPromote, onDelete, onSaveDate,
}: TargetRowProps) {
  const days = t.exam_date ? daysUntilExam(t.exam_date) : null;
  const cd = days !== null ? countdownInfo(days) : null;
  const cdStyle = cd ? {
    danger: { color: theme.danger, background: theme.dangerBg },
    warn: { color: theme.warn, background: theme.warnBg },
    ok: { color: theme.teal, background: theme.tealBg },
    past: { color: theme.inkFaint, background: theme.muted },
  }[cd.tone] : null;
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [hovered, setHovered] = useState(false);
  const [iconHover, setIconHover] = useState<string | null>(null);
  const [starBounce, setStarBounce] = useState(false);
  const starBounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (starBounceTimer.current) clearTimeout(starBounceTimer.current); }, []);

  function handleEditDate() { setDateValue(t.exam_date ?? ''); setEditing(true); }

  async function handleSaveDate() {
    try { await onSaveDate(dateValue || null); setEditing(false); }
    catch { /* hook shows toast; keep editor open */ }
  }

  function handleSetPrimary() {
    if (!t.is_primary) {
      if (starBounceTimer.current) clearTimeout(starBounceTimer.current);
      setStarBounce(true);
      starBounceTimer.current = setTimeout(() => setStarBounce(false), 500);
    }
    onSetPrimary();
  }

  return (
    <div
      style={{
        ...s.targetRow,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        borderColor: hovered ? theme.teal : theme.line,
        boxShadow: hovered ? theme.shadowHover : theme.shadow,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={handleSetPrimary}
        style={{ ...s.starBtn, animation: starBounce ? 'focali-star-pop 0.45s ease' : undefined }}
        title={t.is_primary ? 'Este é o concurso em foco' : 'Definir como foco'}
        aria-label={t.is_primary ? 'Concurso em foco' : 'Definir como foco'}
      >
        <svg width="19" height="19" viewBox="0 0 24 24"
          fill={t.is_primary ? theme.teal : 'none'}
          stroke={t.is_primary ? theme.teal : theme.inkFaint}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
        </svg>
      </button>

      <div style={s.targetMain} onClick={onOpen}>
        <span style={s.targetLabel}>
          {formatTargetLabel(t)}
          {!t.board_id && (
            <span title="Banca não definida" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.warn} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...s.phaseTag, ...(t.phase === 'pos' ? s.phaseTagPos : s.phaseTagPre) }}>
            {t.phase === 'pos' ? 'Pós-edital' : 'Pré-edital'}
          </span>
          {cd && cdStyle && (
            <span style={{ ...s.countdownTag, ...cdStyle }}>{cd.label}</span>
          )}
          <span style={s.topicCountTag}>
            {topicCount > 0 ? `${topicCount} tópico${topicCount === 1 ? '' : 's'}` : 'edital vazio'}
          </span>
          {editing ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                autoFocus
                style={s.dateInput}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDate(); if (e.key === 'Escape') setEditing(false); }}
              />
              <button onClick={handleSaveDate} style={s.dateSaveBtn}>✓</button>
              <button onClick={() => setEditing(false)} style={s.dateCancelBtn}>✕</button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleEditDate(); }}
              style={s.dateBtn}
              title="Definir data da prova"
            >
              {t.exam_date
                ? `📅 ${new Date(t.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')}`
                : '+ data da prova'}
            </button>
          )}
        </div>
      </div>

      <div style={{ ...s.targetActions, ...(isMobile ? { width: '100%', justifyContent: 'flex-end', marginTop: 4 } : {}) }}>
        {t.phase === 'pre' && (
          <button onClick={onPromote} style={s.btnSecondary}>Edital publicado?</button>
        )}
        <button
          onClick={onOpen}
          style={{ ...s.iconBtn, background: iconHover === 'open' ? theme.muted : 'transparent' }}
          onMouseEnter={() => setIconHover('open')}
          onMouseLeave={() => setIconHover(null)}
          title="Abrir concurso"
          aria-label="Abrir concurso"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <path d="M15 3h6v6M10 14L21 3" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          style={{ ...s.iconBtn, background: iconHover === 'del' ? theme.dangerBg : 'transparent' }}
          onMouseEnter={() => setIconHover('del')}
          onMouseLeave={() => setIconHover(null)}
          title="Apagar"
          aria-label="Apagar concurso"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconHover === 'del' ? theme.danger : theme.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
});

const s: Record<string, CSSProperties> = {
  container: { maxWidth: 720, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 20 },
  h1: { fontWeight: 700, color: theme.ink, letterSpacing: -0.4, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 400 },

  // Abas — mesmo padrão da página de Matérias
  tabs: { display: 'flex', gap: 4, marginBottom: 20, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, width: 'fit-content' },
  tab: { padding: '8px 18px', borderRadius: theme.radiusXs, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' },
  tabOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },

  actionsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  newBtn: { padding: '9px 18px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  importarLink: { background: 'transparent', border: 'none', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0, whiteSpace: 'nowrap' },

  // Card de criação
  createCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 20, marginBottom: 20 },

  phaseToggle: { display: 'inline-flex', gap: 0, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 3, marginBottom: 8 },
  phaseBtn: { padding: '7px 18px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusXs },
  phaseBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  phaseHint: { fontSize: 12, color: theme.inkFaint, margin: '0 0 16px' },

  formGrid: { display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  selectWrap: { flex: 1, minWidth: 160 },
  inlineBoard: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.lineStrong}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  // border completo (não borderColor/borderWidth): misturar shorthand com
  // propriedades individuais dispara warning do React ao alternar Pré/Pós.
  inputAlert: { border: `1.5px solid ${theme.danger}` },
  fieldLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  formFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 },

  btnPrimary: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSecondary: { padding: '6px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnGhost: { padding: '10px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnAdvanced: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' },
  iconBtn: { border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', borderRadius: theme.radiusSm, transition: 'background .12s', flexShrink: 0 },

  skeletonList: { display: 'flex', flexDirection: 'column', gap: 8 },
  skeletonRow: { height: 68, borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', color: theme.inkFaint, textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 340, lineHeight: 1.6, margin: '0 0 16px' },
  emptyCta: { padding: '10px 20px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  targetRow: { display: 'flex', alignItems: 'center', gap: 12, background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, padding: '12px 14px', transition: 'border-color .15s, box-shadow .15s', minWidth: 0 },
  starBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },
  targetMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', minWidth: 0 },
  targetLabel: { fontSize: 15, color: theme.ink, fontWeight: 600 },
  phaseTag: { fontSize: 11, fontWeight: 600, borderRadius: theme.radiusXs, padding: '3px 8px', flexShrink: 0 },
  phaseTagPre: { color: theme.inkSoft, background: theme.muted },
  phaseTagPos: { color: '#fff', background: theme.teal },
  countdownTag: { fontSize: 11, fontWeight: 600, borderRadius: theme.radiusXs, padding: '3px 8px', flexShrink: 0 },
  topicCountTag: { fontSize: 11.5, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  targetActions: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  dateBtn: { fontSize: 12, color: theme.teal, border: `1px dashed ${theme.teal}`, background: 'transparent', borderRadius: theme.radiusXs, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  dateInput: { padding: '4px 8px', borderRadius: theme.radiusXs, border: `1px solid ${theme.lineStrong}`, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  dateSaveBtn: { border: 'none', background: theme.primary, color: '#fff', borderRadius: theme.radiusXs, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  dateCancelBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, borderRadius: theme.radiusXs, padding: '4px 6px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },

  promoteOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 },
  promoteModal: { background: theme.card, borderRadius: theme.radius, padding: '24px', width: 'min(400px, 94vw)', boxShadow: theme.shadowModal, fontFamily: theme.font },
  promoteTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  promoteSub: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
};
