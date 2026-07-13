// app/(app)/targets/page.tsx
// Central de concursos: "Meus concursos" (alvos ativos, com countdown e
// progresso de montagem) e "Banco de editais" (catálogo navegável com
// detalhes antes de ativar). Criação manual fica recolhida atrás de um botão.
'use client';

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Star, Trash2, TriangleAlert, ExternalLink, Archive, Check, X, Calendar } from 'lucide-react';
import { useTargetList } from '@/hooks/useTargetList';
import { usePersistedState } from '@/hooks/usePersistedState';
import { formatTargetLabel, daysUntilExam, countdownInfo } from '@/lib/targets';
import { type TargetExam, listArchivedTargetExams } from '@/services/targetExams.service';
import { unarchiveConcurso } from '@/services/concursoArchive.service';
import { BancoEditaisTab } from '@/components/features/targets/BancoEditaisTab';
import { ImportarEditalModal } from '@/components/features/targets/ImportarEditalModal';
import { ArquivarConcursoModal } from '@/components/features/targets/ArquivarConcursoModal';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { useUI } from '@/components/layout/UIContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageContainer, PageHeader } from '@/components/ui/Page';

type Tab = 'meus' | 'banco';

const parseTab = (v: string | null): Tab => (v === 'banco' ? 'banco' : 'meus');

function ChevronSmall({ open }: { open: boolean }) {
  return (
    <ChevronDown size={14} strokeWidth={2.5}
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }} />
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

  // Aba persistida de forma SSR-safe (sem mismatch de hidratação).
  const [tab, setTab] = usePersistedState<Tab>('targets_tab', 'meus', parseTab);
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

  // ── M11: arquivamento de concurso ──
  const queryClient = useQueryClient();
  const [archivingTarget, setArchivingTarget] = useState<TargetExam | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { data: archivedList = [] } = useQuery<TargetExam[]>({
    queryKey: ['target-exams-archived'],
    queryFn: listArchivedTargetExams,
  });

  const refreshTargetViews = useCallback(() => {
    load(); // recarrega os ativos (useTargetList)
    for (const key of [['target-exams'], ['target-exams-archived'], ['edital-coverage'], ['raiox']]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [load, queryClient]);

  async function handleRestore(t: TargetExam) {
    try {
      await unarchiveConcurso(t.id); // reativa também as matérias exclusivas arquivadas
      refreshTargetViews();
      toast.success('Concurso restaurado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao restaurar concurso.');
    }
  }

  useEffect(() => { load(); }, [load]);

  const handleTabChange = useCallback((t: Tab) => { setTab(t); }, [setTab]);

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
      <PageContainer width="narrow">
        <PageHeader title="Concursos" subtitle="Acompanhe seus concursos e explore editais prontos para começar em um clique." />

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
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }}
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? '– Fechar' : '+ Novo concurso'}
              </Button>
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
                  <Input
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Cargo (ex: Auditor Fiscal)"
                    style={{ flex: 1, minWidth: 120, flexBasis: isMobile ? '100%' : undefined }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />

                  {addingBoard ? (
                    <div style={{ ...s.inlineBoard, flexBasis: '100%' }}>
                      <Input
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                        placeholder="Nome da nova banca"
                        autoFocus
                        style={{ flex: 1, minWidth: 120 }}
                      />
                      <Button onClick={handleCreateBoard}>Salvar</Button>
                      <Button variant="ghost" onClick={() => { setAddingBoard(false); setNewBoardName(''); }}>Cancelar</Button>
                    </div>
                  ) : (
                    <div style={{ ...s.selectWrap, flexBasis: isMobile ? '100%' : undefined }}>
                      <Select
                        value={boardId}
                        onChange={(e) => {
                          if (e.target.value === '__new__') { setAddingBoard(true); return; }
                          setBoardId(e.target.value);
                        }}
                        style={bancaObrigatoria && !boardId ? { border: `1.5px solid ${theme.danger}` } : undefined}
                      >
                        <option value="">{bancaObrigatoria ? 'Banca (obrigatória)' : 'Banca (opcional)'}</option>
                        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        <option value="__new__">+ Nova banca…</option>
                      </Select>
                    </div>
                  )}
                </div>

                {showAdvanced && (
                  <div style={{ ...s.formGrid, marginTop: 0, animation: 'focali-slide-down 0.18s ease' }}>
                    <Input
                      value={orgao}
                      onChange={(e) => setOrgao(e.target.value)}
                      placeholder="Órgão (ex: TCE-GO)"
                      style={{ flex: 1, minWidth: 120, flexBasis: isMobile ? '100%' : undefined }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexBasis: isMobile ? '100%' : 'auto' }}>
                      <label style={s.fieldLabel}>Ano previsto</label>
                      <Input
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        placeholder="ex: 2026"
                        type="number"
                        min="2000"
                        max="2100"
                        style={{ maxWidth: isMobile ? '100%' : 110 }}
                      />
                    </div>
                  </div>
                )}

                <div style={s.formFooter}>
                  <button onClick={() => setShowAdvanced((v) => !v)} style={s.btnAdvanced}>
                    <ChevronSmall open={showAdvanced} />
                    {showAdvanced ? 'Menos detalhes' : 'Mais detalhes'}
                  </button>
                  <Button onClick={handleCreate} style={{ width: isMobile ? '100%' : undefined }}>
                    Adicionar concurso
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div style={s.skeletonList}>
                {[1, 2, 3].map((i) => <div key={i} style={{ ...s.skeletonRow, animationDelay: `${i * 0.1}s` }} />)}
              </div>
            ) : targets.length === 0 ? (
              <div style={s.emptyState}>
                <Star size={40} color={theme.inkFaint} strokeWidth={1.2} style={{ marginBottom: 12 }} />
                <p style={s.emptyTitle}>Ainda sem concursos</p>
                <p style={s.emptyHint}>Explore o banco de editais para ativar um concurso pronto em um clique — ou crie o seu manualmente.</p>
                <Button variant="outline" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={() => handleTabChange('banco')}>Explorar banco de editais →</Button>
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
                    onArchive={() => setArchivingTarget(t)}
                    onDelete={() => deleteTarget(t.id)}
                    onSaveDate={(date) => saveDate(t.id, date)}
                  />
                ))}
              </div>
            )}

            {archivedList.length > 0 && (
              <div style={s.archivedWrap}>
                <button onClick={() => setShowArchived((v) => !v)} style={s.archivedToggle}>
                  <ChevronSmall open={showArchived} />
                  Arquivados ({archivedList.length})
                </button>
                {showArchived && (
                  <div style={s.archivedList}>
                    {archivedList.map((t) => (
                      <div key={t.id} style={s.archivedRow}>
                        <span style={s.archivedName}>{formatTargetLabel(t)}</span>
                        <Button variant="outline" size="sm" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={() => handleRestore(t)}>Restaurar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </PageContainer>

      {archivingTarget && (
        <ArquivarConcursoModal
          target={{ id: archivingTarget.id, label: formatTargetLabel(archivingTarget) }}
          onClose={() => setArchivingTarget(null)}
          onArchived={() => { setArchivingTarget(null); refreshTargetViews(); }}
        />
      )}

      {importarOpen && (
        <ImportarEditalModal
          onClose={() => setImportarOpen(false)}
          onImported={(targetId) => { setImportarOpen(false); router.push(`/targets/${targetId}`); }}
        />
      )}

      {promotingTarget && (
        <Overlay onClose={() => setPromotingTarget(null)} maxWidth={400} labelledBy="promote-target-title">
          <h3 id="promote-target-title" style={s.promoteTitle}>Edital publicado! Qual é a banca?</h3>
          <p style={s.promoteSub}>Selecione a banca definida para <strong>{formatTargetLabel(promotingTarget)}</strong>.</p>
          <Select value={promoteBoardId} onChange={(e) => setPromoteBoardId(e.target.value)} autoFocus>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="ghost" onClick={() => setPromotingTarget(null)}>Cancelar</Button>
            <Button onClick={handleConfirmPromote} disabled={!promoteBoardId || promoting}>
              {promoting ? 'Promovendo…' : 'Promover para pós-edital'}
            </Button>
          </div>
        </Overlay>
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
  onArchive: () => void;
  onDelete: () => void;
  onSaveDate: (date: string | null) => Promise<void>;
}

const TargetRow = memo(function TargetRow({
  target: t, topicCount, isMobile, onSetPrimary, onOpen, onPromote, onArchive, onDelete, onSaveDate,
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
        <Star size={19}
          fill={t.is_primary ? theme.teal : 'none'}
          color={t.is_primary ? theme.teal : theme.inkFaint}
          strokeWidth={1.8} />
      </button>

      <div style={s.targetMain} onClick={onOpen}>
        <span style={s.targetLabel}>
          {formatTargetLabel(t)}
          {!t.board_id && (
            <span title="Banca não definida" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
              <TriangleAlert size={13} color={theme.warn} strokeWidth={2} />
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
              <button onClick={handleSaveDate} style={s.dateSaveBtn}><Check size={14} strokeWidth={2.2} /></button>
              <button onClick={() => setEditing(false)} style={s.dateCancelBtn}><X size={14} strokeWidth={2} /></button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleEditDate(); }}
              style={s.dateBtn}
              title="Definir data da prova"
            >
              {t.exam_date
                ? <><Calendar size={13} strokeWidth={2} style={{ marginRight: 5, verticalAlign: -2 }} />{new Date(t.exam_date + 'T00:00:00').toLocaleDateString('pt-BR')}</>
                : '+ data da prova'}
            </button>
          )}
        </div>
      </div>

      <div style={{ ...s.targetActions, ...(isMobile ? { width: '100%', justifyContent: 'flex-end', marginTop: 4 } : {}) }}>
        {t.phase === 'pre' && (
          <Button variant="outline" size="sm" style={{ padding: '6px 14px', fontSize: 13, borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onPromote}>Edital publicado?</Button>
        )}
        <button
          onClick={onOpen}
          style={{ ...s.iconBtn, background: iconHover === 'open' ? theme.muted : 'transparent' }}
          onMouseEnter={() => setIconHover('open')}
          onMouseLeave={() => setIconHover(null)}
          title="Abrir concurso"
          aria-label="Abrir concurso"
        >
          <ExternalLink size={16} color={theme.inkSoft} strokeWidth={1.8} />
        </button>
        <button
          onClick={onArchive}
          style={{ ...s.iconBtn, background: iconHover === 'arch' ? theme.muted : 'transparent' }}
          onMouseEnter={() => setIconHover('arch')}
          onMouseLeave={() => setIconHover(null)}
          title="Arquivar concurso"
          aria-label="Arquivar concurso"
        >
          <Archive size={16} color={theme.inkSoft} strokeWidth={1.8} />
        </button>
        <button
          onClick={onDelete}
          style={{ ...s.iconBtn, background: iconHover === 'del' ? theme.dangerBg : 'transparent' }}
          onMouseEnter={() => setIconHover('del')}
          onMouseLeave={() => setIconHover(null)}
          title="Apagar"
          aria-label="Apagar concurso"
        >
          <Trash2 size={16} color={iconHover === 'del' ? theme.danger : theme.inkFaint} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
});

const s: Record<string, CSSProperties> = {

  // Abas — mesmo padrão da página de Matérias
  tabs: { display: 'flex', gap: 4, marginBottom: 20, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, width: 'fit-content' },
  tab: { padding: '8px 18px', borderRadius: theme.radiusXs, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' },
  tabOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },

  actionsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  newBtn: { padding: '9px 18px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
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
  fieldLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  formFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 },

  btnPrimary: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSecondary: { padding: '6px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnGhost: { padding: '10px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnAdvanced: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' },
  iconBtn: { border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', borderRadius: theme.radiusSm, transition: 'background .12s', flexShrink: 0 },

  skeletonList: { display: 'flex', flexDirection: 'column', gap: 8 },
  skeletonRow: { height: 68, borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', color: theme.inkFaint, textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 340, lineHeight: 1.6, margin: '0 0 16px' },
  emptyCta: { padding: '10px 20px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },

  archivedWrap: { marginTop: 20, paddingTop: 14, borderTop: `0.5px solid ${theme.line}` },
  archivedToggle: { display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0' },
  archivedList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 },
  archivedRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  archivedName: { fontSize: 14, color: theme.inkSoft, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  restoreBtn: { flexShrink: 0, padding: '6px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  targetRow: { display: 'flex', alignItems: 'center', gap: 12, background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, padding: '12px 14px', transition: 'border-color .15s, box-shadow .15s', minWidth: 0 },
  starBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },
  targetMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', minWidth: 0 },
  targetLabel: { fontSize: 15, color: theme.ink, fontWeight: 600 },
  phaseTag: { fontSize: 11, fontWeight: 600, borderRadius: theme.radiusXs, padding: '3px 8px', flexShrink: 0 },
  phaseTagPre: { color: theme.inkSoft, background: theme.muted },
  phaseTagPos: { color: theme.onTeal, background: theme.teal },
  countdownTag: { fontSize: 11, fontWeight: 600, borderRadius: theme.radiusXs, padding: '3px 8px', flexShrink: 0 },
  topicCountTag: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  targetActions: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  dateBtn: { fontSize: 12, color: theme.teal, border: `1px dashed ${theme.teal}`, background: 'transparent', borderRadius: theme.radiusXs, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  dateInput: { padding: '4px 8px', borderRadius: theme.radiusXs, border: `1px solid ${theme.lineStrong}`, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  dateSaveBtn: { border: 'none', background: theme.primary, color: theme.onTeal, borderRadius: theme.radiusXs, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  dateCancelBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, borderRadius: theme.radiusXs, padding: '4px 6px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },

  promoteTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  promoteSub: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
};
