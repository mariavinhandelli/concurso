'use client';

// Comparador de editais: o edital atual contra outra edição do mesmo concurso
// (ou outro edital do catálogo). O diff — disciplinas adicionadas/removidas,
// pesos alterados e tópicos que entraram/saíram — é calculado no cliente a
// partir do conteúdo programático curado dos dois editais.

import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { compareEditais, type EditalComparison, type EditalComparisonSubject } from '@/services/editaisCatalog.service';
import { track, EV } from '@/lib/analytics';
import { theme } from '@/lib/theme';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export interface ComparadorOption {
  id: string;
  label: string;
  mesmoConcurso: boolean;
}

interface Props {
  editalAtualId: string;
  editalAtualSlug: string;
  options: ComparadorOption[];
}

const STATUS_BADGE: Record<EditalComparisonSubject['status'], { label: string; variant: 'ok' | 'danger' | 'neutral' }> = {
  adicionada: { label: 'Adicionada', variant: 'ok' },
  removida: { label: 'Removida', variant: 'danger' },
  mantida: { label: 'Mantida', variant: 'neutral' },
};

function subjectChanged(sub: EditalComparisonSubject): boolean {
  return sub.status !== 'mantida'
    || sub.weightAtual !== sub.weightAnterior
    || sub.topicsAdded.length > 0
    || sub.topicsRemoved.length > 0;
}

export function EditalComparador({ editalAtualId, editalAtualSlug, options }: Props) {
  const [otherId, setOtherId] = useState('');

  const { data: comparison, isLoading } = useQuery<EditalComparison>({
    queryKey: ['edital-compare', editalAtualId, otherId],
    queryFn: () => compareEditais(editalAtualId, otherId),
    enabled: Boolean(otherId),
  });

  function handleSelect(id: string) {
    setOtherId(id);
    if (id) track(EV.editalCompared, { slug: editalAtualSlug, otherId: id });
  }

  const mesmasEdicoes = options.filter((o) => o.mesmoConcurso);
  const outros = options.filter((o) => !o.mesmoConcurso);
  const semMudancas = comparison
    && comparison.totalAdded === 0 && comparison.totalRemoved === 0 && comparison.totalChanged === 0;

  return (
    <div>
      <div style={s.selectorRow}>
        <ArrowLeftRight size={15} color={theme.inkSoft} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={s.selectorLabel}>Comparar com</span>
        <Select
          value={otherId}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ width: 'auto', minWidth: 200, flex: 1, padding: '7px 28px 7px 10px', fontSize: 13 }}
          aria-label="Escolher edital para comparar"
        >
          <option value="">Escolher edital…</option>
          {mesmasEdicoes.length > 0 && (
            <optgroup label="Edições deste concurso">
              {mesmasEdicoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </optgroup>
          )}
          {outros.length > 0 && (
            <optgroup label="Outros editais do banco">
              {outros.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </optgroup>
          )}
        </Select>
      </div>

      {!otherId && (
        <p style={s.hint}>
          Veja o que mudou de um edital para outro: disciplinas que entraram ou saíram, pesos alterados e tópicos novos.
        </p>
      )}

      {otherId && isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} height={44} borderRadius={theme.radiusSm} />)}
        </div>
      )}

      {comparison && !isLoading && (
        <>
          <div style={s.summaryRow}>
            <Badge variant="ok">{comparison.totalAdded} disciplina{comparison.totalAdded === 1 ? '' : 's'} adicionada{comparison.totalAdded === 1 ? '' : 's'}</Badge>
            <Badge variant="danger">{comparison.totalRemoved} removida{comparison.totalRemoved === 1 ? '' : 's'}</Badge>
            <Badge variant="info">{comparison.totalChanged} alterada{comparison.totalChanged === 1 ? '' : 's'}</Badge>
          </div>

          {semMudancas ? (
            <p style={s.hint}>Nenhuma diferença no conteúdo programático entre os dois editais.</p>
          ) : (
            <div style={s.subjectList}>
              {comparison.subjects.filter(subjectChanged).map((sub) => {
                const badge = STATUS_BADGE[sub.status];
                const pesoMudou = sub.status === 'mantida' && sub.weightAtual !== sub.weightAnterior;
                return (
                  <div key={sub.name} style={s.subjectRow}>
                    <div style={s.subjectHead}>
                      <span style={s.subjectName}>{sub.name}</span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {pesoMudou && (
                        <span style={s.pesoChange}>
                          peso {sub.weightAnterior ?? '—'} → <b style={{ color: theme.teal }}>{sub.weightAtual ?? '—'}</b>
                        </span>
                      )}
                    </div>
                    {(sub.topicsAdded.length > 0 || sub.topicsRemoved.length > 0) && (
                      <div style={s.topicChips}>
                        {sub.topicsAdded.map((t) => <span key={`a-${t}`} style={s.chipAdd}>+ {t}</span>)}
                        {sub.topicsRemoved.map((t) => <span key={`r-${t}`} style={s.chipDel}>− {t}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
              {comparison.subjects.filter((x) => !subjectChanged(x)).length > 0 && (
                <p style={s.unchangedNote}>
                  {comparison.subjects.filter((x) => !subjectChanged(x)).length} disciplina(s) sem mudanças.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  selectorRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  selectorLabel: { fontSize: 13, fontWeight: 600, color: theme.inkSoft, whiteSpace: 'nowrap' },
  hint: { fontSize: 13, color: theme.inkFaint, lineHeight: 1.55, margin: '10px 0 0' },

  summaryRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 },
  subjectList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  subjectRow: { padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  subjectHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  subjectName: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0 },
  pesoChange: { fontSize: 12, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums' },
  topicChips: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 },
  chipAdd: { fontSize: 12, fontWeight: 600, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px' },
  chipDel: { fontSize: 12, fontWeight: 500, color: theme.danger, background: theme.dangerBg, borderRadius: theme.radiusXs, padding: '2px 8px', textDecoration: 'line-through' },
  unchangedNote: { fontSize: 12, color: theme.inkFaint, margin: '4px 0 0' },
};
