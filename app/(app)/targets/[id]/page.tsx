// app/(app)/targets/[id]/page.tsx
// Página de um edital: "Montar edital" (biblioteca + pesos das disciplinas) e
// "Verticalizado" (vinculados, com saúde, progresso e ajuste de peso por tópico).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { listTopics, type Topic } from '@/services/topics.service';
import { listTargetExams, type TargetExam } from '@/services/targetExams.service';
import {
  listLinkedTopicIds, linkTopic, unlinkTopic,
  linkTopicsBulk, unlinkTopicsBulk,
  listTopicWeights, setTopicWeight,
} from '@/services/targetTopics.service';
import { listBlueprints, upsertBlueprint, type Blueprint } from '@/services/blueprints.service';
import { getSaudeMap } from '@/services/metrics.service';
import { HealthBar } from '@/components/features/topics/HealthBar';
import { GeneratorModal } from '@/components/features/schedule/GeneratorModal';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

interface SubjectTree {
  subject: Subject;
  topics: Topic[];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function TargetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isMobile } = useUI();
  const targetId = params.id as string;

  const [target, setTarget] = useState<TargetExam | null>(null);
  const [tree, setTree] = useState<SubjectTree[]>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [saudeMap, setSaudeMap] = useState<Record<string, number>>({});
  const [topicWeights, setTopicWeights] = useState<Record<string, number | null>>({});
  const [subjectWeights, setSubjectWeights] = useState<Record<string, number>>({});
  const [blueprints, setBlueprints] = useState<Record<string, Blueprint>>({});
  const [tab, setTab] = useState<'montar' | 'vertical'>('montar');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [targets, subjects] = await Promise.all([listTargetExams(), listSubjects()]);
      const alvo = targets.find((t) => t.id === targetId) ?? null;
      setTarget(alvo);

      const arvore: SubjectTree[] = [];
      const todosTopicos: Topic[] = [];
      for (const s of subjects) {
        const tops = await listTopics(s.id);
        // Exclui tópicos-pasta (pai de outros): só mostra folhas estudáveis.
        const parentIds = new Set(tops.filter((t) => t.parent_id !== null).map((t) => t.parent_id!));
        const leafTopics = tops.filter((t) => !parentIds.has(t.id));
        arvore.push({ subject: s, topics: leafTopics });
        todosTopicos.push(...leafTopics);
      }
      setTree(arvore);

      const [linkedIds, saude, tWeights, blueprintsList] = await Promise.all([
        listLinkedTopicIds(targetId),
        getSaudeMap(todosTopicos.map((t) => t.id)),
        listTopicWeights(targetId),
        listBlueprints(targetId),
      ]);
      setLinked(linkedIds);
      setSaudeMap(saude);
      setTopicWeights(tWeights);
      const sw: Record<string, number> = {};
      const bpMap: Record<string, Blueprint> = {};
      for (const b of blueprintsList) { sw[b.subject_id] = b.weight; bpMap[b.subject_id] = b; }
      setSubjectWeights(sw);
      setBlueprints(bpMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(subjectId: string) {
    setExpanded((prev) => {
      const novo = new Set(prev);
      if (novo.has(subjectId)) novo.delete(subjectId); else novo.add(subjectId);
      return novo;
    });
  }

  async function toggleTopic(topicId: string) {
    const estava = linked.has(topicId);
    setLinked((prev) => {
      const novo = new Set(prev);
      if (estava) novo.delete(topicId); else novo.add(topicId);
      return novo;
    });
    try {
      if (estava) await unlinkTopic(topicId, targetId);
      else await linkTopic(topicId, targetId);
    } catch (e) {
      load();
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular tópico.');
    }
  }

  async function toggleAllOfSubject(node: SubjectTree, marcar: boolean) {
    const ids = node.topics.map((t) => t.id);
    setLinked((prev) => {
      const novo = new Set(prev);
      ids.forEach((id) => (marcar ? novo.add(id) : novo.delete(id)));
      return novo;
    });
    try {
      if (marcar) await linkTopicsBulk(ids, targetId);
      else await unlinkTopicsBulk(ids, targetId);
    } catch (e) {
      load();
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular em lote.');
    }
  }

  async function changeTopicWeight(topicId: string, weight: number | null) {
    setTopicWeights((prev) => ({ ...prev, [topicId]: weight }));
    setEditingWeight(null);
    try {
      await setTopicWeight(topicId, targetId, weight);
    } catch (e) {
      load();
      toast.error(e instanceof Error ? e.message : 'Erro ao definir peso do tópico.');
    }
  }

  // Peso da DISCIPLINA (exam_blueprints). Atualiza otimista + grava.
  async function changeSubjectWeight(subjectId: string, weight: number, nQ: string) {
    setSubjectWeights((prev) => ({ ...prev, [subjectId]: weight }));
    setBlueprints((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], subject_id: subjectId, weight,
        num_questions_expected: nQ ? Number(nQ) : null } as Blueprint,
    }));
    try {
      await upsertBlueprint({
        targetExamId: targetId, subjectId, weight,
        numQuestionsExpected: nQ ? Number(nQ) : null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar peso da disciplina.');
    }
  }

  function pesoEfetivo(topicId: string, subjectId: string): number {
    const tw = topicWeights[topicId];
    if (tw != null) return tw;
    return subjectWeights[subjectId] ?? 1;
  }

  function rotulo(t: TargetExam): string {
    const bancaVis = t.boardName ?? 'Banca a definir';
    return [bancaVis, t.orgao, t.cargo, t.ano_alvo].filter(Boolean).join(' · ');
  }

  if (loading) return <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}><p style={styles.muted}>Carregando…</p></div>;
  if (!target) return <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}><p style={styles.muted}>Concurso não encontrado.</p></div>;

  const totalLinked = linked.size;

  return (
    <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <button onClick={() => router.push('/targets')} style={styles.back}>← Concursos</button>

      <div style={styles.headerRow}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 23 : 28 }}>{rotulo(target)}</h1>
          <p style={styles.sub}>{totalLinked} tópico(s) neste edital.</p>
        </div>
        <button onClick={() => setGeneratorOpen(true)} style={styles.genBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 7 }}>
            <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
          </svg>
          Gerar cronograma
        </button>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setTab('montar')} style={{ ...styles.tab, ...(tab === 'montar' ? styles.tabOn : {}) }}>Montar edital</button>
        <button onClick={() => setTab('vertical')} style={{ ...styles.tab, ...(tab === 'vertical' ? styles.tabOn : {}) }}>Verticalizado</button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {/* ABA 1 — MONTAR */}
      {tab === 'montar' && (
        <div style={styles.section}>
          {/* Seleção de tópicos da biblioteca */}
          {tree.length === 0 ? (
            <p style={styles.muted}>Sua biblioteca está vazia. Cadastre matérias e tópicos primeiro.</p>
          ) : tree.map((node) => {
            const ids = node.topics.map((t) => t.id);
            const marcados = ids.filter((id) => linked.has(id)).length;
            const todosMarcados = ids.length > 0 && marcados === ids.length;
            const aberto = expanded.has(node.subject.id);
            return (
              <div key={node.subject.id} style={styles.subjectBlock}>
                <div style={styles.subjectHead}>
                  <button onClick={() => toggleExpand(node.subject.id)} style={styles.expandBtn} aria-label="Expandir">
                    <Chevron open={aberto} />
                  </button>
                  <span style={styles.subjectName} onClick={() => toggleExpand(node.subject.id)}>{node.subject.name}</span>
                  <span style={{ ...styles.subjectCount, ...(marcados > 0 ? { color: theme.teal, fontWeight: 700 } : {}) }}>
                    {marcados}/{ids.length}
                  </span>
                  <button onClick={() => toggleAllOfSubject(node, !todosMarcados)} style={styles.markAllBtn}>
                    {todosMarcados ? 'Desmarcar tudo' : 'Marcar tudo'}
                  </button>
                </div>
                {aberto && (
                  node.topics.length === 0 ? (
                    <p style={styles.emptyTopics}>Sem tópicos nesta matéria.</p>
                  ) : (
                    <div style={styles.topicList}>
                      {node.topics.map((t) => {
                        const on = linked.has(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleTopic(t.id)} style={{ ...styles.libRow, ...(on ? styles.libRowOn : {}) }}>
                            <span style={{ ...styles.libCheck, ...(on ? styles.libCheckOn : {}) }}>{on ? '✓' : ''}</span>
                            <span style={styles.libTopicName}>{t.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            );
          })}

          {/* Pesos das disciplinas */}
          {tree.length > 0 && (
            <div style={styles.weightsBlock}>
              <h2 style={styles.weightsTitle}>Pesos das disciplinas</h2>
              <p style={styles.weightsHint}>Peso 1 (padrão) a 5 (cai muito). Define quanto tempo a matéria recebe no cronograma gerado. Questões esperadas é opcional.</p>
              <div style={styles.weightList}>
                {tree.map((node) => {
                  const s = node.subject;
                  const bp = blueprints[s.id];
                  const weight = bp?.weight ?? 1;
                  const nQ = bp?.num_questions_expected?.toString() ?? '';
                  return (
                    <div key={s.id} style={{ ...styles.weightRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 10 : 0 }}>
                      <span style={styles.weightSubject}>{s.name}</span>
                      <div style={{ ...styles.weightControls, ...(isMobile ? { width: '100%' } : {}) }}>
                        <select
                          value={weight}
                          onChange={(e) => changeSubjectWeight(s.id, Number(e.target.value), nQ)}
                          style={{ ...styles.weightSelectInput, flex: isMobile ? 1 : undefined }}
                        >
                          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Peso {w}</option>)}
                        </select>
                        <input
                          defaultValue={nQ}
                          onBlur={(e) => changeSubjectWeight(s.id, weight, e.target.value)}
                          placeholder="nº questões"
                          type="number"
                          style={{ ...styles.qInput, width: isMobile ? undefined : 120, flex: isMobile ? 1 : undefined, minWidth: 0 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2 — VERTICALIZADO */}
      {tab === 'vertical' && (
        <div style={styles.section}>
          {totalLinked === 0 ? (
            <p style={styles.muted}>Nenhum tópico vinculado ainda. Use a aba “Montar edital”.</p>
          ) : tree.map((node) => {
            const vinculados = node.topics.filter((t) => linked.has(t.id));
            if (vinculados.length === 0) return null;

            const done = vinculados.filter((t) => t.is_completed).length;
            const pct = Math.round((done / vinculados.length) * 100);
            const aberto = expanded.has(node.subject.id);

            return (
              <div key={node.subject.id} style={styles.vertBlock}>
                <div style={styles.vertHead} onClick={() => toggleExpand(node.subject.id)}>
                  <span style={styles.vertHeadLeft}>
                    <button style={styles.expandBtn} aria-label="Expandir"><Chevron open={aberto} /></button>
                    <span style={styles.subjectName}>{node.subject.name}</span>
                  </span>
                  <span style={styles.vertProgress}>
                    <b style={{ color: theme.ink }}>{pct}%</b>
                    <span style={styles.subjectCount}>{done}/{vinculados.length}</span>
                  </span>
                </div>
                <div style={styles.vertTrack}>
                  <div style={{ ...styles.vertFill, width: `${pct}%` }} />
                </div>
                {aberto && (
                  <div style={styles.topicList}>
                    {vinculados.map((t) => {
                      const peso = pesoEfetivo(t.id, node.subject.id);
                      const editando = editingWeight === t.id;
                      return (
                        <div key={t.id} style={styles.vertRow}>
                          <span style={{ ...styles.libTopicName, ...(t.is_completed ? styles.doneText : {}) }}>{t.name}</span>
                          <HealthBar saude={saudeMap[t.id]} />
                          {editando ? (
                            <select
                              value={topicWeights[t.id] ?? ''}
                              onChange={(e) => changeTopicWeight(t.id, e.target.value === '' ? null : Number(e.target.value))}
                              onBlur={() => setEditingWeight(null)}
                              autoFocus
                              style={styles.weightSelect}
                            >
                              <option value="">Herdar ({subjectWeights[node.subject.id] ?? 1})</option>
                              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Peso {w}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingWeight(t.id)}
                              style={styles.weightBadge}
                              title="Ajustar peso deste tópico"
                            >
                              ×{peso}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {generatorOpen && (
        <GeneratorModal
          presetExamId={targetId}
          onClose={() => setGeneratorOpen(false)}
          onGenerated={() => { setGeneratorOpen(false); router.push('/schedule'); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 720, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 18, fontFamily: 'inherit' },
  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0, overflowWrap: 'break-word', wordBreak: 'normal' },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  genBtn: { display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  tabs: { display: 'flex', gap: 6, marginBottom: 22, borderBottom: `0.5px solid ${theme.line}` },
  tab: { padding: '10px 16px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -1 },
  tabOn: { color: theme.teal, borderBottom: `2px solid ${theme.teal}` },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  subjectBlock: { background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  subjectHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  expandBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 },
  subjectName: { fontSize: 15.5, fontWeight: 700, color: theme.ink, flex: '1 1 140px', cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  subjectCount: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  markAllBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  emptyTopics: { fontSize: 13, color: theme.inkFaint, margin: '12px 0 0' },
  topicList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  libRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', minWidth: 0 },
  libRowOn: { background: theme.tealBg, border: `0.5px solid ${theme.teal}` },
  libCheck: { width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${theme.line}`, background: theme.card, color: 'transparent', fontSize: 12, display: 'grid', placeItems: 'center', flexShrink: 0 },
  libCheckOn: { background: theme.teal, border: `1.5px solid ${theme.teal}`, color: '#fff' },
  libTopicName: { flex: 1, fontSize: 14.5, color: theme.ink, minWidth: 0 },
  weightsBlock: { background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 16, marginTop: 4, minWidth: 0 },
  weightsTitle: { fontSize: 16, fontWeight: 700, color: theme.ink, margin: 0 },
  weightsHint: { fontSize: 12.5, color: theme.inkFaint, margin: '6px 0 14px', lineHeight: 1.5 },
  weightList: { display: 'flex', flexDirection: 'column', gap: 8 },
  weightRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.bg, borderRadius: 10, border: `0.5px solid ${theme.line}`, padding: '10px 14px', minWidth: 0 },
  weightSubject: { fontSize: 14.5, color: theme.ink, flex: 1, minWidth: 0 },
  weightControls: { display: 'flex', gap: 10 },
  weightSelectInput: { padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', cursor: 'pointer' },
  qInput: { width: 120, padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  vertBlock: { background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  vertHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, cursor: 'pointer', gap: 10 },
  vertHeadLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  vertProgress: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, fontWeight: 700, flexShrink: 0 },
  vertTrack: { height: 6, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  vertFill: { height: '100%', background: theme.teal, borderRadius: 999, transition: 'width 0.4s ease' },
  vertRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, minWidth: 0 },
  doneText: { color: theme.inkFaint, textDecoration: 'line-through' },
  weightBadge: { border: `0.5px solid ${theme.line}`, background: 'rgba(15,23,42,.04)', color: theme.inkSoft, fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  weightSelect: { padding: '5px 8px', borderRadius: 8, border: `1.5px solid ${theme.teal}`, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 },
};