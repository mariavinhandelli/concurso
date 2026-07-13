// app/(app)/targets/[id]/page.tsx
// Hub do concurso: visão geral (status, countdown, preparação), montagem do
// edital e progresso verticalizado.
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { useTargetDetail } from '@/hooks/useTargetDetail';
import { formatTargetLabel } from '@/lib/targets';
import { updateTargetExamDate, promoteToPos } from '@/services/targetExams.service';
import { listAllBoards, type Board } from '@/services/boards.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { useUI } from '@/components/layout/UIContext';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

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
    target, catalogInfo, updates, tree, linked, saudeMap, topicWeights, subjectWeights, blueprints, nQInputs,
    loading, error, inFlightTopics,
    load, toggleTopic, toggleAllOfSubject, changeTopicWeight, changeSubjectWeight, setNQInputs,
  } = useTargetDetail(targetId);

  const [tab, setTab] = useState<Tab>('visao');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteBoards, setPromoteBoards] = useState<Board[]>([]);
  const [promoteBoardId, setPromoteBoardId] = useState('');
  const [promoting, setPromoting] = useState(false);

  useEffect(() => { load(); }, [load]);

  const totalTopics = useMemo(() => tree.reduce((acc, n) => acc + n.topics.length, 0), [tree]);
  const coveragePct = totalTopics > 0 ? Math.round((linked.size / totalTopics) * 100) : 0;
  const canGenerate = linked.size > 0;

  async function handleSaveDate(date: string | null) {
    await updateTargetExamDate(targetId, date);
    toast.success(date ? 'Data da prova salva.' : 'Data removida.');
    load();
  }

  async function handlePromote() {
    if (!target) return;
    if (target.board_id) {
      setPromoting(true);
      try {
        await promoteToPos(targetId);
        toast.success('Concurso promovido para pós-edital.');
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

  async function handleConfirmPromote() {
    if (!promoteBoardId) return;
    setPromoting(true);
    try {
      await promoteToPos(targetId, promoteBoardId);
      toast.success('Concurso promovido para pós-edital.');
      setPromoteOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao promover.');
    } finally {
      setPromoting(false);
    }
  }

  if (loading) return (
    <div style={{ ...s.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={{ height: 16, width: 88, borderRadius: theme.radiusXs, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite', marginBottom: 20 }} />
      <div style={{ height: 34, width: '55%', borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite', marginBottom: 8 }} />
      <div style={{ height: 12, width: '35%', borderRadius: theme.radiusXs, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite', marginBottom: 28 }} />
      <SkeletonList />
    </div>
  );

  if (!target) return (
    <div style={{ ...s.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <button onClick={() => router.push('/targets')} style={s.back}>← Concursos</button>
      <p style={{ color: theme.inkFaint, fontSize: 14 }}>Concurso não encontrado.</p>
    </div>
  );

  return (
    <div style={{ ...s.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <button onClick={() => router.push('/targets')} style={s.back}>← Concursos</button>

      <div style={s.headerRow}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : 28 }}>{formatTargetLabel(target)}</h1>
          <div style={s.coverageRow}>
            <div style={s.coverageTrack}>
              <div style={{ ...s.coverageFill, width: `${coveragePct}%` }} />
            </div>
            <span style={s.coverageLabel}>
              {linked.size}/{totalTopics} tópicos
              {totalTopics > 0 && <span style={{ marginLeft: 5, color: theme.teal, fontWeight: 700 }}>{coveragePct}%</span>}
            </span>
          </div>
        </div>

        <div title={!canGenerate ? 'Vincule ao menos um tópico para gerar o cronograma' : undefined} style={{ flexShrink: 0 }}>
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

      <div style={s.tabs}>
        <button onClick={() => setTab('visao')} style={{ ...s.tab, ...(tab === 'visao' ? s.tabOn : {}) }}>Visão geral</button>
        <button onClick={() => setTab('montar')} style={{ ...s.tab, ...(tab === 'montar' ? s.tabOn : {}) }}>Montar edital</button>
        <button onClick={() => setTab('vertical')} style={{ ...s.tab, ...(tab === 'vertical' ? s.tabOn : {}) }}>Progresso</button>
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
          onGenerated={() => { setGeneratorOpen(false); router.push('/schedule'); }}
        />
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
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: { maxWidth: 720, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },
  back: {
    border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', padding: '10px 12px', marginBottom: 10, fontFamily: 'inherit',
    minHeight: 44, display: 'inline-flex', alignItems: 'center',
    borderRadius: theme.radiusSm, marginLeft: -12, transition: 'background .12s',
  },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: '0 0 12px', overflowWrap: 'break-word' },
  coverageRow: { display: 'flex', alignItems: 'center', gap: 10 },
  coverageTrack: { flex: 1, maxWidth: 260, height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  coverageFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  coverageLabel: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  genBtn: { display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  genBtnDisabled: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed' },
  tabs: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: `1px solid ${theme.line}` },
  tab: { padding: '10px 18px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -1, transition: 'color .15s' },
  tabOn: { color: theme.teal, borderBottomColor: theme.teal },

  promoteTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 6px' },
  promoteSub: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
  btnPrimary: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnGhost: { padding: '10px 12px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};
