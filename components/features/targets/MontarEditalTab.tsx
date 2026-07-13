'use client';

import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronRight, Search, Pencil, X, Check } from 'lucide-react';
import { type Blueprint } from '@/services/blueprints.service';
import { type SubjectTree } from '@/lib/targets';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight size={16} strokeWidth={2}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }} />
  );
}

// Spinner 14px — visível dentro de checkbox 20×20
function Spinner() {
  return <span style={s.spinner} aria-label="Salvando…" />;
}

interface Props {
  tree: SubjectTree[];
  linked: Set<string>;
  blueprints: Record<string, Blueprint>;
  nQInputs: Record<string, string>;
  isMobile: boolean;
  inFlightTopics: Set<string>;
  onToggleTopic: (id: string) => void;
  onToggleAll: (node: SubjectTree, marcar: boolean) => void;
  onChangeSubjectWeight: (subjectId: string, weight: number, nQ: string) => void;
  onNQChange: (subjectId: string, value: string) => void;
  onNavigateToSubjects: () => void;
}

export const MontarEditalTab = memo(function MontarEditalTab({
  tree, linked, blueprints, nQInputs, isMobile, inFlightTopics,
  onToggleTopic, onToggleAll, onChangeSubjectWeight, onNQChange, onNavigateToSubjects,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [innerTab, setInnerTab] = useState<'topicos' | 'pesos'>('topicos');
  const [search, setSearch] = useState('');
  const [pendingMarkAll, setPendingMarkAll] = useState<{ subjectId: string; marcar: boolean } | null>(null);

  const totalTopics = useMemo(() => tree.reduce((acc, n) => acc + n.topics.length, 0), [tree]);
  const coveragePct = totalTopics > 0 ? Math.round((linked.size / totalTopics) * 100) : 0;

  const q = search.trim().toLowerCase();
  const filteredTree = useMemo(() => {
    if (!q) return tree;
    return tree
      .map((node) => ({ ...node, topics: node.topics.filter((t) => t.name.toLowerCase().includes(q)) }))
      .filter((node) => node.topics.length > 0 || node.subject.name.toLowerCase().includes(q));
  }, [tree, q]);

  useEffect(() => {
    if (!q) return;
    const toExpand = filteredTree
      .filter((n) => n.topics.some((t) => t.name.toLowerCase().includes(q)))
      .map((n) => n.subject.id);
    if (toExpand.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        toExpand.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [q, filteredTree]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleMarkAll(node: SubjectTree, marcar: boolean) {
    if (marcar && node.topics.length > 10) { setPendingMarkAll({ subjectId: node.subject.id, marcar }); return; }
    onToggleAll(node, marcar);
  }

  const pendingNode = pendingMarkAll
    ? (tree.find((n) => n.subject.id === pendingMarkAll.subjectId) ?? null)
    : null;

  if (tree.length === 0) {
    return (
      <div style={s.emptyState}>
        <Pencil size={36} color={theme.inkFaint} strokeWidth={1.2} style={{ marginBottom: 10 }} />
        <p style={s.emptyTitle}>Biblioteca vazia</p>
        <p style={s.emptyHint}>Cadastre matérias e tópicos para começar a montar o edital.</p>
        <Button variant="outline" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onNavigateToSubjects}>Ir para Matérias →</Button>
      </div>
    );
  }

  return (
    <div style={s.section}>
      {/* Confirm Marcar tudo (> 10 tópicos) */}
      {pendingNode && (
        <div style={s.confirmBanner}>
          <span style={s.confirmText}>
            Marcar todos os {pendingNode.topics.length} tópicos de <strong>{pendingNode.subject.name}</strong>?
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={() => { onToggleAll(pendingNode, pendingMarkAll!.marcar); setPendingMarkAll(null); }}>
              Marcar tudo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingMarkAll(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* M3: cobertura */}
      <div style={s.coverageRow}>
        <div style={s.coverageTrack}>
          <div style={{ ...s.coverageFill, width: `${coveragePct}%` }} />
        </div>
        <span style={s.coverageLabel}>
          {linked.size}/{totalTopics} tópicos · <span style={{ color: theme.teal, fontWeight: 700 }}>{coveragePct}%</span>
        </span>
      </div>

      {/* M4: sub-tabs + actions — unificados com phaseToggle */}
      <div style={s.innerTabRow}>
        <div style={s.innerTabs}>
          <button onClick={() => setInnerTab('topicos')} style={{ ...s.innerTab, ...(innerTab === 'topicos' ? s.innerTabOn : {}) }}>Tópicos</button>
          <button onClick={() => setInnerTab('pesos')} style={{ ...s.innerTab, ...(innerTab === 'pesos' ? s.innerTabOn : {}) }}>Pesos</button>
        </div>
        {innerTab === 'topicos' && (
          <div style={s.headerActions}>
            <button onClick={() => setExpanded(new Set(tree.map((n) => n.subject.id)))} style={s.actionLink}>Expandir tudo</button>
            <span style={{ color: theme.inkFaint, fontSize: 12 }}>/</span>
            <button onClick={() => setExpanded(new Set())} style={s.actionLink}>Recolher</button>
          </div>
        )}
      </div>

      {innerTab === 'topicos' && (
        <>
          {/* M2: busca */}
          <div style={s.searchWrap}>
            <Search size={14} color={theme.inkFaint} strokeWidth={2} style={{ flexShrink: 0 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tópico…" style={s.searchInput} />
            {search && <button onClick={() => setSearch('')} style={s.searchClear} aria-label="Limpar busca"><X size={13} strokeWidth={2} /></button>}
          </div>

          {filteredTree.length === 0 && (
            <p style={{ fontSize: 13, color: theme.inkFaint, textAlign: 'center', padding: '16px 0' }}>
              Nenhum tópico encontrado para &quot;{search}&quot;.
            </p>
          )}

          {filteredTree.map((node) => {
            const ids = node.topics.map((t) => t.id);
            const marcados = ids.filter((id) => linked.has(id)).length;
            const todosMarcados = ids.length > 0 && marcados === ids.length;
            const aberto = expanded.has(node.subject.id);

            return (
              <div key={node.subject.id} style={s.subjectBlock}>
                <div style={s.subjectHead}>
                  <button onClick={() => toggleExpand(node.subject.id)} style={s.expandBtn} aria-label="Expandir">
                    <Chevron open={aberto} />
                  </button>
                  <span style={s.subjectName} onClick={() => toggleExpand(node.subject.id)}>
                    {node.subject.name}
                  </span>
                  <span style={{ ...s.subjectCount, ...(marcados > 0 ? { color: theme.teal, fontWeight: 700 } : {}) }}>
                    {marcados}/{ids.length}
                  </span>
                  <button onClick={() => handleMarkAll(node, !todosMarcados)} style={s.markAllBtn}>
                    {todosMarcados ? 'Desmarcar tudo' : 'Marcar tudo'}
                  </button>
                </div>

                {aberto && (
                  node.topics.length === 0 ? (
                    <p style={{ fontSize: 13, color: theme.inkFaint, margin: '12px 0 0' }}>Sem tópicos nesta matéria.</p>
                  ) : (
                    <div style={{ ...s.topicList, animation: 'focali-slide-down 0.18s ease' }}>
                      {node.topics.map((t) => (
                        <TopicRow
                          key={t.id}
                          name={t.name}
                          on={linked.has(t.id)}
                          loading={inFlightTopics.has(t.id)}
                          onToggle={() => onToggleTopic(t.id)}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </>
      )}

      {innerTab === 'pesos' && (
        <div style={s.weightsBlock}>
          <p style={s.weightsHint}>Peso 1 (padrão) a 5 (cai muito). Define quanto tempo a matéria recebe no cronograma. Questões esperadas é opcional.</p>
          <div style={s.weightList}>
            {tree.map((node) => {
              const sid = node.subject.id;
              const bp = blueprints[sid];
              const weight = bp?.weight ?? 1;
              const nQ = nQInputs[sid] ?? bp?.num_questions_expected?.toString() ?? '';
              return (
                <div key={sid} style={{ ...s.weightRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 10 : 0 }}>
                  <span style={s.weightSubject}>{node.subject.name}</span>
                  <div style={{ ...s.weightControls, ...(isMobile ? { width: '100%' } : {}) }}>
                    <Select
                      value={weight}
                      onChange={(e) => onChangeSubjectWeight(sid, Number(e.target.value), nQ)}
                      style={{ flex: isMobile ? 1 : undefined }}
                    >
                      {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Peso {w}</option>)}
                    </Select>
                    <Input
                      value={nQ}
                      onChange={(e) => onNQChange(sid, e.target.value)}
                      onBlur={(e) => onChangeSubjectWeight(sid, weight, e.target.value)}
                      placeholder="nº questões"
                      type="number"
                      style={{ width: isMobile ? undefined : 120, flex: isMobile ? 1 : undefined, minWidth: 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// TopicRow isolado — hover sem re-render da lista inteira
function TopicRow({ name, on, loading, onToggle }: { name: string; on: boolean; loading: boolean; onToggle: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      style={{
        ...s.libRow,
        ...(on ? s.libRowOn : {}),
        ...(hov && !on ? { background: theme.muted } : {}),
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <span style={{ ...s.libCheck, ...(on ? s.libCheckOn : {}) }}>
        {loading ? <Spinner /> : on ? <Check size={13} strokeWidth={2.5} /> : ''}
      </span>
      <span style={s.libTopicName}>{name}</span>
    </button>
  );
}

const s: Record<string, CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 12 },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 300, lineHeight: 1.6, margin: '0 0 16px' },
  emptyBtn: { padding: '10px 20px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  confirmBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: theme.tealBg, border: `1px solid ${theme.teal}`, borderRadius: theme.radiusSm, padding: '10px 14px', flexWrap: 'wrap', animation: 'focali-slide-down 0.18s ease' },
  confirmText: { fontSize: 13, color: theme.ink, flex: 1 },
  confirmYes: { padding: '6px 14px', borderRadius: theme.radiusXs, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirmNo: { padding: '6px 10px', borderRadius: theme.radiusXs, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  coverageRow: { display: 'flex', alignItems: 'center', gap: 10 },
  coverageTrack: { flex: 1, maxWidth: 200, height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  coverageFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  coverageLabel: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },

  // Segmented control — unificado: container radiusSm, botões radiusXs
  innerTabRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  innerTabs: { display: 'inline-flex', gap: 0, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 3 },
  innerTab: { padding: '6px 16px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusXs },
  innerTabOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },

  headerActions: { display: 'flex', alignItems: 'center', gap: 4 },
  actionLink: { background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' },

  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: theme.card, border: `1px solid ${theme.lineStrong}`, borderRadius: theme.radiusSm, padding: '8px 12px' },
  searchInput: { flex: 1, border: 'none', background: 'transparent', fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  searchClear: { background: 'transparent', border: 'none', color: theme.inkFaint, cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 },

  subjectBlock: { background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  subjectHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  expandBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 },
  subjectName: { fontSize: 15, fontWeight: 700, color: theme.ink, flex: '1 1 140px', cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  subjectCount: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  markAllBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  topicList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },

  // Rows de tópico — radius unificado (radiusSm)
  libRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', minWidth: 0, transition: 'background .12s' },
  libRowOn: { background: theme.tealBg, border: `1px solid ${theme.teal}` },
  libCheck: { width: 20, height: 20, borderRadius: theme.radiusXs, border: `1.5px solid ${theme.lineStrong}`, background: theme.card, color: 'transparent', fontSize: 12, display: 'grid', placeItems: 'center', flexShrink: 0 },
  libCheckOn: { background: theme.teal, border: `1.5px solid ${theme.teal}`, color: theme.onTeal },
  libTopicName: { flex: 1, fontSize: 13, color: theme.ink, minWidth: 0 },

  // Spinner 14px — visível dentro do checkbox 20×20
  spinner: { display: 'inline-block', width: 14, height: 14, border: `2px solid ${theme.teal}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .6s linear infinite' } as CSSProperties,

  // Painel de pesos
  weightsBlock: { background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  weightsHint: { fontSize: 12, color: theme.inkFaint, margin: '0 0 14px', lineHeight: 1.5 },
  weightList: { display: 'flex', flexDirection: 'column', gap: 8 },
  weightRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme.bg, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, padding: '10px 14px', minWidth: 0 },
  weightSubject: { fontSize: 13, color: theme.ink, flex: 1, minWidth: 0 },
  weightControls: { display: 'flex', gap: 10 },
};
