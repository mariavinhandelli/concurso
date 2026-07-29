// app/(app)/targets/[id]/page.tsx
// Hub do concurso: visão geral (status, countdown, preparação), montagem do
// edital e progresso verticalizado.
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Sparkles, Pencil } from 'lucide-react';
import { useTargetDetail } from '@/hooks/useTargetDetail';
import { formatTargetLabel } from '@/lib/targets';
import { updateTargetExamDate, promoteToPos, updateTargetExam, demoteToPre, updateTargetPrepChecklist } from '@/services/targetExams.service';
import { listAllBoards, type Board } from '@/services/boards.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { useUI } from '@/components/layout/UIContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageContainer } from '@/components/ui/Page';

const HubOverviewTab = dynamic(
  () => import('@/components/features/targets/HubOverviewTab').then((m) => ({ default: m.HubOverviewTab })),
  { ssr: false, loading: () => <SkeletonList /> },
);
const MontarEditalTab = dynamic(
  () => import('@/components/features/targets/MontarEditalTab').then((m) => ({ default: m.MontarEditalTab })),
  { ssr: false, loading: () => <SkeletonList /> },
);
const VerticalizadoTab = dynamic(
  () => import('@/components/features/targets/VerticalizadoTab').then((m) => ({ default: m.VerticalizadoTab })),
  { ssr: false, loading: () => <SkeletonList /> },
);
const GeneratorModal = dynamic(
  () => import('@/components/features/schedule/GeneratorModal').then((m) => ({ default: m.GeneratorModal })),
  { ssr: false },
);
const ArquivarConcursoModal = dynamic(
  () => import('@/components/features/targets/ArquivarConcursoModal').then((m) => ({ default: m.ArquivarConcursoModal })),
  { ssr: false },
);

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          height: 52,
          borderRadius: theme.radiusSm,
          background: theme.muted,
          animation: 'focali-pulse 1.4s ease infinite',
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );
}

type Tab = 'visao' | 'montar' | 'vertical';

export default function TargetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useUI();
  const targetId = params.id as string;

  const {
    target, catalogInfo, updates, tree, linked, saudeMap, incidencias, topicWeights, subjectWeights, blueprints, nQInputs,
    loading, error, inFlightTopics,
    load, toggleTopic, toggleAllOfSubject, changeTopicWeight, changeSubjectWeight, setNQInputs,
  } = useTargetDetail(targetId);

  const queryClient = useQueryClient();
  // Home (ExamCountdown, CoberturaEdital, Raio-X) lê estes caches; sem invalidar,
  // data/fase alteradas aqui não refletem lá até um refetch por acaso.
  const invalidateHomeCaches = () => {
    for (const key of [['target-exams'], ['edital-coverage'], ['raiox'], ['catalog-editais']]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const [tab, setTab] = useState<Tab>('visao');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteBoards, setPromoteBoards] = useState<Board[]>([]);
  const [promoteBoardId, setPromoteBoardId] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // ── Edição do concurso (cargo/órgão/ano/banca + voltar para pré) ──
  const [editOpen, setEditOpen] = useState(false);
  const [editBoards, setEditBoards] = useState<Board[]>([]);
  const [editCargo, setEditCargo] = useState('');
  const [editOrgao, setEditOrgao] = useState('');
  const [editAno, setEditAno] = useState('');
  const [editBoardId, setEditBoardId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [demoting, setDemoting] = useState(false);

  useEffect(() => { load(); }, [load]);

  // Progresso do concurso = tópicos concluídos entre os VINCULADOS a este edital
  // (mesma régua do card "Progresso do edital"). O total da biblioteca não entra:
  // tópicos de outros concursos não dizem nada sobre este.
  const linkedDone = useMemo(
    () => tree.reduce((acc, n) => acc + n.topics.filter((t) => linked.has(t.id) && t.is_completed).length, 0),
    [tree, linked],
  );
  const progressPct = linked.size > 0 ? Math.round((linkedDone / linked.size) * 100) : 0;
  const canGenerate = linked.size > 0;

  async function handleSaveDate(date: string | null) {
    await updateTargetExamDate(targetId, date);
    toast.success(date ? 'Data da prova salva.' : 'Data removida.');
    invalidateHomeCaches();
    load();
  }

  async function handlePromote() {
    if (!target) return;
    if (target.board_id) {
      setPromoting(true);
      try {
        await promoteToPos(targetId);
        toast.success('Concurso promovido para pós-edital.');
        invalidateHomeCaches();
        load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao promover.');
      } finally {
        setPromoting(false);
      }
      return;
    }
    try {
      const boards = await listAllBoards();
      if (boards.length === 0) {
        toast.error('Cadastre uma banca antes de promover para pós-edital.');
        return;
      }
      setPromoteBoards(boards);
      setPromoteBoardId(boards[0].id);
      setPromoteOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar bancas.');
    }
  }

  async function handleOpenEdit() {
    if (!target) return;
    try {
      const boards = await listAllBoards();
      setEditBoards(boards);
      setEditCargo(target.cargo ?? '');
      setEditOrgao(target.orgao ?? '');
      setEditAno(target.ano_alvo?.toString() ?? '');
      setEditBoardId(target.board_id ?? '');
      setEditOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar bancas.');
    }
  }

  async function handleSaveEdit() {
    if (!target) return;
    if (!editCargo.trim() && !editOrgao.trim() && !editBoardId && !editAno.trim()) {
      toast.error('Informe ao menos um campo para identificar o concurso.');
      return;
    }
    setSavingEdit(true);
    try {
      const ano = editAno && Number.isFinite(Number(editAno)) ? Number(editAno) : null;
      await updateTargetExam(targetId, {
        cargo: editCargo.trim() || null,
        orgao: editOrgao.trim() || null,
        ano_alvo: ano,
        board_id: editBoardId || null,
      });
      toast.success('Concurso atualizado.');
      setEditOpen(false);
      invalidateHomeCaches();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao editar concurso.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDemote() {
    setDemoting(true);
    try {
      await demoteToPre(targetId);
      toast.success('Concurso voltou para pré-edital.');
      setEditOpen(false);
      invalidateHomeCaches();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao voltar para pré-edital.');
    } finally {
      setDemoting(false);
    }
  }

  async function handleConfirmPromote() {
    if (!promoteBoardId) return;
    setPromoting(true);
    try {
      await promoteToPos(targetId, promoteBoardId);
      toast.success('Concurso promovido para pós-edital.');
      setPromoteOpen(false);
      invalidateHomeCaches();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao promover.');
    } finally {
      setPromoting(false);
    }
  }

  if (loading) return (
    <PageContainer width="narrow">
      <div style={{ height: 16, width: 88, borderRadius: theme.radiusXs, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite', marginBottom: 20 }} />
      <div style={{ height: 34, width: '55%', borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite', marginBottom: 8 }} />
      <div style={{ height: 12, width: '35%', borderRadius: theme.radiusXs, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite', marginBottom: 28 }} />
      <SkeletonList />
    </PageContainer>
  );

  if (!target) return (
    <PageContainer width="narrow">
      <button onClick={() => router.push('/targets')} style={s.back}>← Concursos</button>
      <p style={{ color: theme.inkFaint, fontSize: 14 }}>Concurso não encontrado.</p>
    </PageContainer>
  );

  return (
    <PageContainer width="narrow">
      <button onClick={() => router.push('/targets')} style={s.back}>← Concursos</button>

      <div style={s.headerRow}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : 28 }}>{formatTargetLabel(target)}</h1>
          <div style={s.coverageRow}>
            <div style={s.coverageTrack}>
              <div style={{ ...s.coverageFill, width: `${progressPct}%` }} />
            </div>
            <span style={s.coverageLabel}>
              {linked.size === 0
                ? 'nenhum tópico vinculado'
                : <>{linkedDone}/{linked.size} tópicos concluídos<span style={{ marginLeft: 5, color: theme.teal, fontWeight: 700 }}>{progressPct}%</span></>}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleOpenEdit}
            style={s.editBtn}
            title="Editar concurso"
            aria-label="Editar concurso (cargo, órgão, ano, banca)"
          >
            <Pencil size={15} color={theme.inkSoft} strokeWidth={1.8} />
          </button>
          <div title={!canGenerate ? 'Vincule ao menos um tópico para gerar o cronograma' : undefined}>
            <button
              onClick={() => canGenerate && setGeneratorOpen(true)}
              style={{ ...s.genBtn, ...(canGenerate ? {} : s.genBtnDisabled) }}
              aria-disabled={!canGenerate}
            >
              <Sparkles size={15} strokeWidth={2} style={{ marginRight: 7 }} />
              Gerar cronograma
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SegmentedControl
          options={[
            { value: 'visao', label: 'Visão geral' },
            { value: 'montar', label: 'Montar edital' },
            { value: 'vertical', label: 'Progresso' },
          ]}
          value={tab}
          onChange={setTab}
          equalWidth={false}
        />
      </div>

      {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {tab === 'visao' && (
        <HubOverviewTab
          target={target}
          catalogInfo={catalogInfo}
          updates={updates}
          tree={tree}
          linked={linked}
          subjectWeights={subjectWeights}
          isMobile={isMobile}
          canGenerate={canGenerate}
          onGoMontar={() => setTab('montar')}
          onGoProgresso={() => setTab('vertical')}
          onGenerate={() => setGeneratorOpen(true)}
          onPromote={handlePromote}
          onSaveDate={handleSaveDate}
          onArchive={() => setArchiveOpen(true)}
        />
      )}

      {tab === 'montar' && (
        <MontarEditalTab
          tree={tree}
          linked={linked}
          blueprints={blueprints}
          nQInputs={nQInputs}
          isMobile={isMobile}
          inFlightTopics={inFlightTopics}
          onToggleTopic={toggleTopic}
          onToggleAll={toggleAllOfSubject}
          onChangeSubjectWeight={changeSubjectWeight}
          onNQChange={(sid, val) => setNQInputs((prev) => ({ ...prev, [sid]: val }))}
          onNavigateToSubjects={() => router.push('/subjects')}
        />
      )}

      {tab === 'vertical' && (
        <VerticalizadoTab
          tree={tree}
          linked={linked}
          saudeMap={saudeMap}
          incidencias={incidencias}
          topicWeights={topicWeights}
          subjectWeights={subjectWeights}
          isMobile={isMobile}
          onChangeTopicWeight={changeTopicWeight}
          onSwitchToTopics={() => setTab('montar')}
        />
      )}

      {generatorOpen && (
        <GeneratorModal
          presetExamId={targetId}
          onClose={() => setGeneratorOpen(false)}
          onGenerated={() => {
            setGeneratorOpen(false);
            // Cronograma gerado de fato → marca a etapa da Central de preparação
            // (o clique no item só abre o modal; cancelar não marca nada).
            const done = target?.prep_checklist ?? [];
            if (target && !done.includes('cronograma')) {
              updateTargetPrepChecklist(targetId, [...done, 'cronograma']).catch(() => {});
            }
            router.push('/schedule');
          }}
        />
      )}

      {archiveOpen && target && (
        <ArquivarConcursoModal
          target={{ id: target.id, label: formatTargetLabel(target) }}
          onClose={() => setArchiveOpen(false)}
          onArchived={() => {
            setArchiveOpen(false);
            invalidateHomeCaches();
            queryClient.invalidateQueries({ queryKey: ['target-exams-archived'] });
            router.push('/targets');
          }}
        />
      )}

      {editOpen && target && (
        <Overlay onClose={() => setEditOpen(false)} maxWidth={440} labelledBy="edit-target-title">
          <h3 id="edit-target-title" style={s.promoteTitle}>Editar concurso</h3>
          <p style={s.promoteSub}>Corrija cargo, órgão, ano ou banca — nada além da identificação muda.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input value={editCargo} onChange={(e) => setEditCargo(e.target.value)} placeholder="Cargo (ex: Auditor Fiscal)" aria-label="Cargo" />
            <Input value={editOrgao} onChange={(e) => setEditOrgao(e.target.value)} placeholder="Órgão (ex: TCE-GO)" aria-label="Órgão" />
            <div style={{ display: 'flex', gap: 10 }}>
              <Input
                value={editAno}
                onChange={(e) => setEditAno(e.target.value)}
                placeholder="Ano (ex: 2026)"
                aria-label="Ano previsto"
                type="number"
                min="2000"
                max="2100"
                style={{ maxWidth: 140 }}
              />
              <Select value={editBoardId} onChange={(e) => setEditBoardId(e.target.value)} aria-label="Banca" style={{ flex: 1 }}>
                <option value="">{target.phase === 'pos' ? 'Banca (obrigatória no pós)' : 'Banca (a definir)'}</option>
                {editBoards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap' }}>
            {target.phase === 'pos' ? (
              <button onClick={handleDemote} disabled={demoting} style={s.demoteLink}>
                {demoting ? 'Voltando…' : '← Voltar para pré-edital'}
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </Overlay>
      )}

      {promoteOpen && (
        <Overlay onClose={() => setPromoteOpen(false)} maxWidth={400} labelledBy="promote-target-detail-title">
          <h3 id="promote-target-detail-title" style={s.promoteTitle}>Edital publicado! Qual é a banca?</h3>
          <p style={s.promoteSub}>Selecione a banca definida para <strong>{formatTargetLabel(target)}</strong>.</p>
          <Select value={promoteBoardId} onChange={(e) => setPromoteBoardId(e.target.value)} autoFocus>
            {promoteBoards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="ghost" onClick={() => setPromoteOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmPromote} disabled={!promoteBoardId || promoting}>
              {promoting ? 'Promovendo…' : 'Promover para pós-edital'}
            </Button>
          </div>
        </Overlay>
      )}
    </PageContainer>
  );
}

const s: Record<string, CSSProperties> = {
  back: {
    border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', padding: '10px 12px', marginBottom: 10, fontFamily: 'inherit',
    minHeight: 44, display: 'inline-flex', alignItems: 'center',
    borderRadius: theme.radiusSm, marginLeft: -12, transition: 'background .12s',
  },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: '0 0 12px', overflowWrap: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  coverageRow: { display: 'flex', alignItems: 'center', gap: 10 },
  coverageTrack: { flex: 1, maxWidth: 260, height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  coverageFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  coverageLabel: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  genBtn: { display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  editBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, borderRadius: theme.radiusSm, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background .12s' },
  demoteLink: { background: 'transparent', border: 'none', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '10px 0', textDecoration: 'underline', textUnderlineOffset: 3 },
  genBtnDisabled: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },

  promoteTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  promoteSub: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
  btnPrimary: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnGhost: { padding: '10px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};
