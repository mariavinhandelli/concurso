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
  // Hierarquia do select: outra edição do mesmo concurso, outro cargo do
  // mesmo órgão, ou qualquer edital do banco (aberto em 31/07 — com federais
  // no catálogo, comparar entre órgãos responde "quanto aproveita?").
  grupo: 'edicao' | 'orgao' | 'banco';
}

interface Props {
  editalAtualId: string;
  editalAtualSlug: string;
  options: ComparadorOption[];
}

// Uma linha só aparece na lista se algo mudou nela — então nenhuma linha
// visível pode dizer "Mantida": alterada é "Alterada" (bug de 31/07, quando o
// resumo dizia "6 alteradas" e todas as linhas diziam "Mantida").
function badgeOf(sub: EditalComparisonSubject): { label: string; variant: 'ok' | 'danger' | 'info' } {
  if (sub.status === 'adicionada') return { label: 'Adicionada', variant: 'ok' };
  if (sub.status === 'removida') return { label: 'Removida', variant: 'danger' };
  return { label: 'Alterada', variant: 'info' };
}

function subjectChanged(sub: EditalComparisonSubject): boolean {
  return sub.status !== 'mantida' || sub.changed;
}

// Acima disso, os chips de tópicos colapsam — 52 chips de uma vez viram
// paredão ilegível em vez de informação.
const TOPIC_CHIP_LIMIT = 8;

function TopicChips({ added, removed }: { added: string[]; removed: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const total = added.length + removed.length;
  const overflow = total - TOPIC_CHIP_LIMIT;
  const showAdded = expanded ? added : added.slice(0, TOPIC_CHIP_LIMIT);
  const showRemoved = expanded ? removed : removed.slice(0, Math.max(0, TOPIC_CHIP_LIMIT - added.length));
  return (
    <div style={s.topicChips}>
      {showAdded.map((t) => <span key={`a-${t}`} style={s.chipAdd}>+ {t}</span>)}
      {showRemoved.map((t) => <span key={`r-${t}`} style={s.chipDel}>− {t}</span>)}
      {overflow > 0 && (
        <button onClick={() => setExpanded((v) => !v)} style={s.chipMore}>
          {expanded ? 'mostrar menos' : `+${overflow} tópico${overflow === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
}

export function EditalComparador({ editalAtualId, editalAtualSlug, options }: Props) {
  const [otherId, setOtherId] = useState('');

  const { data: comparison, isLoading } = useQuery<EditalComparison>({
    queryKey: ['edital-compare', editalAtualId, otherId],
    queryFn: () => compareEditais(editalAtualId, otherId),
    enabled: Boolean(otherId),
  });

  // Sem opção para comparar (órgão com um cargo só, sem outra edição curada):
  // a seção continua existindo — âncoras do hub apontam para cá — mas diz a
  // verdade em vez de sumir. DEPOIS dos hooks: `options` começa vazio enquanto
  // o catálogo carrega, e um return antes do useQuery muda a contagem de
  // hooks entre renders (crash "Rendered more hooks", 31/07).
  if (options.length === 0) {
    return (
      <p style={s.hint}>
        Ainda não há outro edital com grade curada no banco para comparar.
        Quando houver, o comparador aparece aqui.
      </p>
    );
  }

  function handleSelect(id: string) {
    setOtherId(id);
    if (id) track(EV.editalCompared, { slug: editalAtualSlug, otherId: id });
  }

  const mesmasEdicoes = options.filter((o) => o.grupo === 'edicao');
  const mesmoOrgao = options.filter((o) => o.grupo === 'orgao');
  const outros = options.filter((o) => o.grupo === 'banco');
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
          {mesmoOrgao.length > 0 && (
            <optgroup label="Outros cargos deste órgão">
              {mesmoOrgao.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </optgroup>
          )}
          {outros.length > 0 && (
            <optgroup label="Outros editais do banco (mesma área primeiro)">
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
          {/* Direção do diff explícita: "adicionada" = está neste edital e não
              no comparado — sem isto, comparar com outro concurso lê como
              mudança temporal, o que engana. */}
          <p style={s.directionNote}>
            Mudanças <b>deste edital</b> em relação a “{options.find((o) => o.id === otherId)?.label ?? 'outro edital'}”:
          </p>
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
                const badge = badgeOf(sub);
                const pesoMudou = sub.status === 'mantida' && sub.weightAtual !== sub.weightAnterior;
                const questoesMudou = sub.status === 'mantida' && sub.numQuestionsAtual !== sub.numQuestionsAnterior;
                const nAdd = sub.topicsAdded.length;
                const nDel = sub.topicsRemoved.length;
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
                      {questoesMudou && (
                        <span style={s.pesoChange}>
                          questões {sub.numQuestionsAnterior ?? '—'} → <b style={{ color: theme.teal }}>{sub.numQuestionsAtual ?? '—'}</b>
                        </span>
                      )}
                      {/* O quê da mudança sempre no cabeçalho — sem isso a linha
                          "Alterada" com dezenas de chips não dizia o resumo. */}
                      {(nAdd > 0 || nDel > 0) && (
                        <span style={s.pesoChange}>
                          {nAdd > 0 && <>+{nAdd} tópico{nAdd === 1 ? '' : 's'}</>}
                          {nAdd > 0 && nDel > 0 && ' · '}
                          {nDel > 0 && <>−{nDel} tópico{nDel === 1 ? '' : 's'}</>}
                        </span>
                      )}
                    </div>
                    {(nAdd > 0 || nDel > 0) && (
                      <TopicChips added={sub.topicsAdded} removed={sub.topicsRemoved} />
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

  directionNote: { fontSize: 12, color: theme.inkFaint, margin: '12px 0 0', lineHeight: 1.5 },
  summaryRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  subjectList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  subjectRow: { padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  subjectHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  subjectName: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0 },
  pesoChange: { fontSize: 12, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums' },
  topicChips: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 },
  chipAdd: { fontSize: 12, fontWeight: 600, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px' },
  chipDel: { fontSize: 12, fontWeight: 500, color: theme.danger, background: theme.dangerBg, borderRadius: theme.radiusXs, padding: '2px 8px', textDecoration: 'line-through' },
  chipMore: { fontSize: 12, fontWeight: 600, color: theme.teal, background: 'transparent', border: `1px dashed ${theme.teal}`, borderRadius: theme.radiusXs, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' },
  unchangedNote: { fontSize: 12, color: theme.inkFaint, margin: '4px 0 0' },
};
