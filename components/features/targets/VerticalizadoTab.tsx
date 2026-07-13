'use client';

import { memo, useEffect, useState, type CSSProperties } from 'react';
import { X, ChevronRight, Info, ChartNoAxesColumn } from 'lucide-react';
import { HealthBar } from '@/components/features/topics/HealthBar';
import { type SubjectTree, pesoEfetivo } from '@/lib/targets';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

const COACH_KEY = 'focali_vert_coach_seen';

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight size={16} strokeWidth={2}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }} />
  );
}

function WeightBadge({ peso, onEdit }: { peso: number; onEdit: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onEdit}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ ...s.weightBadge, ...(hov ? s.weightBadgeHov : {}) }}
      title="Ajustar peso deste tópico"
    >
      ×{peso}
    </button>
  );
}

type Filter = 'all' | 'notStarted' | 'lowHealth' | 'done';

interface Props {
  tree: SubjectTree[];
  linked: Set<string>;
  saudeMap: Record<string, number>;
  topicWeights: Record<string, number | null>;
  subjectWeights: Record<string, number>;
  isMobile: boolean;
  onChangeTopicWeight: (topicId: string, weight: number | null) => void;
  onSwitchToTopics: () => void;
}

export const VerticalizadoTab = memo(function VerticalizadoTab({
  tree, linked, saudeMap, topicWeights, subjectWeights,
  onChangeTopicWeight, onSwitchToTopics,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showCoach, setShowCoach] = useState(false);
  // MI2: barra inicia em 0% e anima ao valor real após mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const seen = typeof window !== 'undefined' && localStorage.getItem(COACH_KEY);
    if (!seen) setShowCoach(true);
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  function dismissCoach() {
    if (typeof window !== 'undefined') localStorage.setItem(COACH_KEY, '1');
    setShowCoach(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (linked.size === 0) {
    return (
      <div style={s.emptyState}>
        <ChartNoAxesColumn size={36} color={theme.inkFaint} strokeWidth={1.2} style={{ marginBottom: 10 }} />
        <p style={s.emptyTitle}>Nada aqui ainda</p>
        <p style={s.emptyHint}>Vincule tópicos na aba &quot;Montar edital&quot; para ver o progresso aqui.</p>
        <Button variant="outline" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onSwitchToTopics}>Ir para Montar edital →</Button>
      </div>
    );
  }

  const filterChips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'notStarted', label: 'Não iniciados' },
    { id: 'lowHealth', label: 'Saúde baixa (<40)' },
    { id: 'done', label: 'Concluídos' },
  ];

  return (
    <div style={s.section}>
      {/* V1: Coach mark — primeira visita */}
      {showCoach && (
        <div style={s.coachMark}>
          <div style={s.coachInner}>
            <Info size={16} color={theme.teal} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={s.coachTitle}>Como ler a barra de saúde</p>
              <p style={s.coachBody}>
                <span style={{ color: theme.danger, fontWeight: 600 }}>Vermelho</span> = sem revisões recentes ·{' '}
                <span style={{ color: theme.warn, fontWeight: 600 }}>Amarelo</span> = atenção ·{' '}
                <span style={{ color: theme.teal, fontWeight: 600 }}>Verde</span> = em dia.
                Clique no peso (×N) para ajustar por tópico.
              </p>
            </div>
            <button onClick={dismissCoach} style={s.coachClose} aria-label="Fechar dica">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* V3: filtros */}
      <div style={s.chips}>
        {filterChips.map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)} style={{ ...s.chip, ...(filter === c.id ? s.chipOn : {}) }}>
            {c.label}
          </button>
        ))}
      </div>

      {tree.map((node) => {
        const vinculados = node.topics.filter((t) => linked.has(t.id));
        if (vinculados.length === 0) return null;

        const filtrados = vinculados.filter((t) => {
          const saude = saudeMap[t.id] ?? 0;
          if (filter === 'notStarted') return saude === 0 && !t.is_completed;
          if (filter === 'lowHealth') return saude > 0 && saude < 40 && !t.is_completed;
          if (filter === 'done') return t.is_completed;
          return true;
        });
        if (filtrados.length === 0) return null;

        const done = vinculados.filter((t) => t.is_completed).length;
        const pct = Math.round((done / vinculados.length) * 100);
        const aberto = expanded.has(node.subject.id);

        return (
          <div key={node.subject.id} style={s.vertBlock}>
            <div style={s.vertHead} onClick={() => toggleExpand(node.subject.id)}>
              <span style={s.vertHeadLeft}>
                <button style={s.expandBtn} aria-label="Expandir"><Chevron open={aberto} /></button>
                <span style={s.subjectName}>{node.subject.name}</span>
              </span>
              <span style={s.vertProgress}>
                <b style={{ color: theme.ink }}>{pct}%</b>
                <span style={s.subjectCount}>{done}/{vinculados.length}</span>
              </span>
            </div>
            {/* MI2: barra inicia em 0 e anima */}
            <div style={s.vertTrack}>
              <div style={{ ...s.vertFill, width: mounted ? `${pct}%` : '0%' }} />
            </div>
            {aberto && (
              <div style={{ ...s.topicList, animation: 'focali-slide-down 0.18s ease' }}>
                {filtrados.map((t) => {
                  const peso = pesoEfetivo(topicWeights, subjectWeights, t.id, node.subject.id);
                  const editando = editingWeight === t.id;
                  return (
                    <div key={t.id} style={s.vertRow}>
                      <span style={{ ...s.libTopicName, ...(t.is_completed ? s.doneText : {}) }}>{t.name}</span>
                      <HealthBar saude={saudeMap[t.id]} />
                      {editando ? (
                        <Select
                          value={topicWeights[t.id] ?? ''}
                          onChange={(e) => {
                            onChangeTopicWeight(t.id, e.target.value === '' ? null : Number(e.target.value));
                            setEditingWeight(null);
                          }}
                          onBlur={() => setTimeout(() => setEditingWeight(null), 200)}
                          autoFocus
                          style={{ padding: '5px 28px 5px 8px', borderRadius: theme.radiusXs, border: `1.5px solid ${theme.teal}`, fontSize: 13, flexShrink: 0, width: 'auto' }}
                        >
                          <option value="">Herdar ({subjectWeights[node.subject.id] ?? 1})</option>
                          {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Peso {w}</option>)}
                        </Select>
                      ) : (
                        <WeightBadge peso={peso} onEdit={() => setEditingWeight(t.id)} />
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
  );
});

const s: Record<string, CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 12 },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 320, lineHeight: 1.6, margin: '0 0 16px' },
  emptyBtn: { padding: '10px 20px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  // Coach mark com SVG (sem emoji)
  coachMark: { background: theme.tealBg, border: `1px solid ${theme.teal}`, borderRadius: theme.radiusSm, padding: '12px 14px', animation: 'focali-slide-down 0.2s ease' },
  coachInner: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  coachTitle: { fontSize: 13, fontWeight: 600, color: theme.ink, margin: '0 0 3px' },
  coachBody: { fontSize: 13, color: theme.inkSoft, margin: 0, lineHeight: 1.55 },
  coachClose: { background: 'transparent', border: 'none', color: theme.inkFaint, cursor: 'pointer', padding: 2, flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center' },

  // Chips — padding 6px 14px (antes 5px 12px), fontSize 13 (antes 12.5)
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '6px 14px', borderRadius: theme.radiusPill, border: `1px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' },
  chipOn: { background: theme.tealBg, border: `1px solid ${theme.teal}`, color: theme.teal, fontWeight: 600 },

  // Blocos de disciplina — radius unificado (radiusSm)
  vertBlock: { background: theme.card, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  vertHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, cursor: 'pointer', gap: 10 },
  vertHeadLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  vertProgress: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, fontWeight: 700, flexShrink: 0 },
  vertTrack: { height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  vertFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.5s ease' },
  topicList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },

  // Rows — radius unificado (radiusSm)
  vertRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, minWidth: 0 },
  expandBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 },
  subjectName: { fontSize: 15, fontWeight: 700, color: theme.ink, flex: '1 1 140px', cursor: 'pointer', minWidth: 0 },
  subjectCount: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  libTopicName: { flex: 1, fontSize: 13, color: theme.ink, minWidth: 0 },
  doneText: { color: theme.inkFaint, textDecoration: 'line-through' },

  // Badge de peso com hover state
  weightBadge: { border: `1px solid ${theme.lineStrong}`, background: theme.muted, color: theme.inkSoft, fontSize: 12, fontWeight: 700, borderRadius: theme.radiusXs, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, fontVariantNumeric: 'tabular-nums', transition: 'border-color .12s, background .12s, color .12s' },
  weightBadgeHov: { border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal },
};
