'use client';

// Comparador de editais: o edital atual contra outra edição do mesmo concurso
// (ou outro edital do catálogo). O diff — disciplinas adicionadas/removidas,
// pesos alterados e tópicos que entraram/saíram — é calculado no cliente a
// partir do conteúdo programático curado dos dois editais.

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Search } from 'lucide-react';
import { compareEditais, type EditalComparison, type EditalComparisonSubject } from '@/services/editaisCatalog.service';
import { track, EV } from '@/lib/analytics';
import { theme, zIndex } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

// Remove acentos e caixa — mesmo normalizador do BancoEditaisTab, para "tecnico"
// casar com "Técnico" na busca.
function norm(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

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

interface EditalPickerProps {
  options: ComparadorOption[];
  value: string;
  onChange: (id: string) => void;
}

const GROUP_LABEL: Record<ComparadorOption['grupo'], string> = {
  edicao: 'Edições deste concurso',
  orgao: 'Outros cargos deste órgão',
  // Sem "(mesma área primeiro)" — a ordenação já vem assim do chamador
  // (page.tsx) e falar isso em voz alta não ajuda quem está escolhendo;
  // fica implícito, como qualquer outra lista ordenada por relevância.
  banco: 'Outros editais do banco',
};

// Combobox com busca por texto — troca o <select> nativo (que virava uma
// lista longa sem filtro, ~20 itens com o catálogo de 25 editais) por um
// campo que filtra ao digitar, mantendo os mesmos 3 grupos e a navegação
// por teclado (setas + Enter, mesmo padrão do CommandPalette).
function EditalPicker({ options, value, onChange }: EditalPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const nq = norm(query.trim());
    const match = (o: ComparadorOption) => !nq || norm(o.label).includes(nq);
    return (['edicao', 'orgao', 'banco'] as const)
      .map((grupo) => ({ grupo, label: GROUP_LABEL[grupo], items: options.filter((o) => o.grupo === grupo && match(o)) }))
      .filter((g) => g.items.length > 0);
  }, [options, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => { setHighlighted(0); }, [query, open]);

  function select(o: ComparadorOption) {
    onChange(o.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[highlighted]) select(flat[highlighted]); }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1, minWidth: 200 }}>
      <div style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.inkFaint, display: 'flex' }}>
          <Search size={14} strokeWidth={2} />
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Buscar edital para comparar"
          // Sem controls/activedescendant, navegar com as setas não anunciava
          // nada no leitor de tela: a seleção só era visual (fundo teal).
          aria-controls={listboxId}
          aria-activedescendant={open && flat[highlighted] ? `${listboxId}-${flat[highlighted].id}` : undefined}
          value={open ? query : (selected?.label ?? '')}
          placeholder="Buscar edital…"
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={handleKeyDown}
          style={s.pickerInput}
        />
      </div>
      {open && (
        <div className="floating-root" id={listboxId} role="listbox" style={s.pickerPanel}>
          {flat.length === 0 ? (
            <p style={{ fontSize: 13, color: theme.inkFaint, padding: '8px 10px', margin: 0 }}>
              Nenhum edital encontrado.
            </p>
          ) : groups.map((g) => (
            <div key={g.grupo}>
              <div style={s.pickerGroupLabel}>{g.label}</div>
              {g.items.map((o) => {
                const idx = flat.indexOf(o);
                const isHighlighted = idx === highlighted;
                return (
                  <button
                    key={o.id}
                    id={`${listboxId}-${o.id}`}
                    type="button"
                    role="option"
                    aria-selected={o.id === value}
                    onMouseEnter={() => setHighlighted(idx)}
                    onClick={() => select(o)}
                    style={{
                      ...s.pickerOption,
                      background: isHighlighted ? theme.tealBg : 'transparent',
                      color: isHighlighted ? theme.teal : theme.ink,
                      fontWeight: o.id === value ? 700 : 500,
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
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

  const semMudancas = comparison
    && comparison.totalAdded === 0 && comparison.totalRemoved === 0 && comparison.totalChanged === 0;

  const inalteradas = comparison?.subjects.filter((x) => !subjectChanged(x)) ?? [];
  // Totais só valem quando os DOIS editais publicam nº de questões em todas as
  // disciplinas; senão a soma compara peras com maçãs.
  const qAtual = comparison?.subjects.every((x) => x.status === 'removida' || x.numQuestionsAtual != null)
    ? comparison.subjects.reduce((acc, x) => acc + (x.numQuestionsAtual ?? 0), 0) : null;
  const qOutro = comparison?.subjects.every((x) => x.status === 'adicionada' || x.numQuestionsAnterior != null)
    ? comparison.subjects.reduce((acc, x) => acc + (x.numQuestionsAnterior ?? 0), 0) : null;
  // A ressalva sobre tópicos só vale quando pelo menos um dos editais NÃO teve
  // a grade conferida contra o conteúdo programático oficial: aí a lista de
  // tópicos é a padrão do catálogo e o diff sai vazio por construção, não por
  // apuração. Com os dois curados (`ambosCurados`), zero tópico significa zero
  // tópico de verdade.
  const precisaRessalvaDeTopicos = comparison != null && !comparison.ambosCurados;

  return (
    <div>
      <div style={s.selectorRow}>
        <ArrowLeftRight size={15} color={theme.inkSoft} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={s.selectorLabel}>Comparar com</span>
        <EditalPicker options={options} value={otherId} onChange={handleSelect} />
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

          {/* Tamanho das duas provas lado a lado: sem isto, "2 alteradas" não
              dizia se as provas são do mesmo porte ou não. */}
          {qAtual != null && qOutro != null && (
            <p style={s.totaisNote}>
              Prova deste edital: <b>{qAtual} questões</b> em {comparison.subjects.filter((x) => x.status !== 'removida').length} disciplinas ·
              {' '}comparado: <b>{qOutro} questões</b> em {comparison.subjects.filter((x) => x.status !== 'adicionada').length} disciplinas.
            </p>
          )}

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
              {inalteradas.length > 0 && (
                // Nomeadas, não só contadas: "7 disciplinas sem mudanças" não
                // respondia "quais?" — e é justamente essa lista que diz o
                // quanto do estudo aproveita de um edital para o outro.
                <div style={s.unchangedBox}>
                  <p style={s.unchangedTitle}>
                    Igual nos dois ({inalteradas.length} disciplina{inalteradas.length === 1 ? '' : 's'}, mesmo peso e mesmo nº de questões)
                  </p>
                  <div style={s.unchangedChips}>
                    {inalteradas.map((x) => (
                      <span key={x.name} style={s.chipSame}>
                        {x.name}
                        {x.numQuestionsAtual != null && <span style={s.chipSameQ}> · {x.numQuestionsAtual}q</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Limite conhecido do dado, dito em voz alta — e só quando existe. */}
          {precisaRessalvaDeTopicos ? (
            <p style={s.topicCaveat}>
              A comparação de tópicos aqui é aproximada: pelo menos um destes editais ainda
              usa a lista padrão do catálogo para cada disciplina, em vez do conteúdo
              programático oficial dele. Editais cobram a mesma matéria com profundidades
              diferentes (ex.: “Noções de Direito Constitucional” × “Direito
              Constitucional”) — confira o PDF oficial para o detalhe fino.
            </p>
          ) : (
            <p style={s.topicCaveat}>
              Comparação de tópicos conferida: as duas grades foram checadas contra o
              conteúdo programático oficial de cada edital.
            </p>
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
  totaisNote: { fontSize: 12, color: theme.inkSoft, margin: '8px 0 0', lineHeight: 1.55 },
  unchangedBox: { marginTop: 4, paddingTop: 10, borderTop: `0.5px solid ${theme.line}` },
  unchangedTitle: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, margin: 0 },
  unchangedChips: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 },
  chipSame: { fontSize: 12, fontWeight: 500, color: theme.inkSoft, background: theme.muted, borderRadius: theme.radiusXs, padding: '3px 9px' },
  chipSameQ: { fontVariantNumeric: 'tabular-nums', color: theme.inkFaint },
  topicCaveat: { fontSize: 12, color: theme.inkFaint, lineHeight: 1.55, margin: '12px 0 0', paddingTop: 10, borderTop: `0.5px solid ${theme.line}` },

  pickerInput: {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px',
    borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, fontSize: 13, color: theme.ink,
    fontFamily: 'inherit', outline: 'none',
  },
  pickerPanel: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    background: theme.card, border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radiusSm, boxShadow: theme.shadowHover,
    maxHeight: 280, overflowY: 'auto', zIndex: zIndex.menu, padding: 4,
  },
  pickerGroupLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 10px 4px' },
  pickerOption: { display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: theme.radiusXs, border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
};
