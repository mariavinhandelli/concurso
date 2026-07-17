'use client';

// Aba "Visão geral" do hub do concurso: countdown, status, progresso por
// disciplina, central de preparação (pré-edital) e ações rápidas.
// Um concurso sem edital vigente não é um concurso "morto" — é uma central
// de preparação para o próximo edital.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { type TargetExam } from '@/services/targetExams.service';
import { type CatalogEditalInfo, type EditalUpdate, type EditalUpdateTipo } from '@/services/editaisCatalog.service';
import { normalizeDisciplina } from '@/lib/juris-disciplinas';
import { leiDisciplinaForSubject } from '@/services/leis.service';
import { type SubjectTree, daysUntilExam, countdownInfo, formatDateBR } from '@/lib/targets';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { SITUACAO_LABEL } from '@/components/features/editais/EditalCard';

const PREP_KEY_PREFIX = 'focali_prep_';

// Checklist de preparação pré-edital.
// - auto: derivado de estado real da plataforma (não é autorrelato).
// - catalog: a ação vive na página do edital (/editais/[slug]) — comparador,
//   estatística de disciplinas, histórico do concurso, provas anteriores.
//   Só fica disponível quando o concurso está vinculado a um edital do banco;
//   sem vínculo, aparece como "em breve" e sai do cálculo de % para não
//   fingir progresso que não depende da usuária.
const PREP_ITEMS: { key: string; label: string; auto?: boolean; catalog?: boolean; anchor?: string }[] = [
  { key: 'prova-ultima', label: 'Resolver a última prova aplicada neste concurso' },
  { key: 'estudar-edital', label: 'Estudar o último edital publicado' },
  { key: 'comparar-editais', label: 'Comparar o último edital com o anterior', catalog: true, anchor: '#comparar' },
  { key: 'mapa-incidencia', label: 'Mapear disciplinas e assuntos mais cobrados', catalog: true, anchor: '#disciplinas' },
  { key: 'estilo-banca', label: 'Estudar o estilo da banca provável', catalog: true, anchor: '#historico' },
  { key: 'montar-edital', label: 'Montar o edital verticalizado na Focali', auto: true },
  { key: 'pesos', label: 'Definir os pesos das disciplinas', auto: true },
  { key: 'cronograma', label: 'Gerar o cronograma de estudos' },
  { key: 'juris', label: 'Revisar as jurisprudências relacionadas' },
  { key: 'lei-seca', label: 'Revisar a lei seca relacionada' },
];

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const UPDATE_TIPO: Record<EditalUpdateTipo, { label: string; color: 'teal' | 'warn' | 'muted' | 'danger' }> = {
  noticia: { label: 'Notícia', color: 'teal' },
  retificacao: { label: 'Retificação', color: 'danger' },
  aviso: { label: 'Aviso', color: 'warn' },
  resultado: { label: 'Resultado', color: 'muted' },
};

interface Props {
  target: TargetExam;
  catalogInfo: CatalogEditalInfo | null;
  updates: EditalUpdate[];
  tree: SubjectTree[];
  linked: Set<string>;
  subjectWeights: Record<string, number>;
  isMobile: boolean;
  canGenerate: boolean;
  onGoMontar: () => void;
  onGoProgresso: () => void;
  onGenerate: () => void;
  onPromote: () => void;
  onSaveDate: (date: string | null) => Promise<void>;
}

export function HubOverviewTab({
  target, catalogInfo, updates, tree, linked, subjectWeights, isMobile, canGenerate,
  onGoMontar, onGoProgresso, onGenerate, onPromote, onSaveDate,
}: Props) {
  const router = useRouter();
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [prepDone, setPrepDone] = useState<Set<string>>(new Set());
  const [prepOpen, setPrepOpen] = useState(true);

  const isPre = target.phase === 'pre';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREP_KEY_PREFIX + target.id);
      if (raw) setPrepDone(new Set(JSON.parse(raw) as string[]));
    } catch { /* estado corrompido = checklist zerada */ }
  }, [target.id]);

  function togglePrep(key: string) {
    setPrepDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(PREP_KEY_PREFIX + target.id, JSON.stringify([...next])); } catch { /* quota */ }
      return next;
    });
  }

  // ── Estatísticas derivadas (nenhuma query extra: tudo já está no hook) ──
  const stats = useMemo(() => {
    const porDisciplina = tree
      .map((node) => {
        const vinculados = node.topics.filter((t) => linked.has(t.id));
        const done = vinculados.filter((t) => t.is_completed).length;
        return { id: node.subject.id, name: node.subject.name, total: vinculados.length, done };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
    const totalLinked = porDisciplina.reduce((acc, d) => acc + d.total, 0);
    const totalDone = porDisciplina.reduce((acc, d) => acc + d.done, 0);
    const totalTopics = tree.reduce((acc, n) => acc + n.topics.length, 0);
    return { porDisciplina, totalLinked, totalDone, totalTopics };
  }, [tree, linked]);

  const progressoPct = stats.totalLinked > 0 ? Math.round((stats.totalDone / stats.totalLinked) * 100) : 0;

  const days = target.exam_date ? daysUntilExam(target.exam_date) : null;
  const cd = days !== null ? countdownInfo(days) : null;
  const cdColor = cd
    ? { danger: theme.danger, warn: theme.warn, ok: theme.teal, past: theme.inkFaint }[cd.tone]
    : theme.inkFaint;

  // Itens que dependem da página do edital só contam quando o concurso está
  // vinculado ao catálogo; do contrário o checklist nunca chegaria a 100% por
  // motivos que não dependem do usuário.
  const catalogSlug = catalogInfo?.slug ?? null;
  const isItemDisabled = (item: (typeof PREP_ITEMS)[number]): boolean => Boolean(item.catalog) && !catalogSlug;
  const countableItems = PREP_ITEMS.filter((i) => !isItemDisabled(i));
  function isChecked(item: (typeof PREP_ITEMS)[number]): boolean {
    if (item.key === 'pesos') return Object.keys(subjectWeights).length > 0;
    if (item.auto) return linked.size > 0;
    return prepDone.has(item.key);
  }
  const prepCheckedCount = countableItems.filter(isChecked).length;
  const prepPct = countableItems.length > 0 ? Math.round((prepCheckedCount / countableItems.length) * 100) : 0;

  // Disciplina para filtrar jurisprudências relacionadas a este concurso.
  // Os nomes das matérias da Focali ("Direito Penal Militar") não usam a
  // mesma taxonomia do módulo de jurisprudências ("Penal e Proc. Penal
  // Militar") — por isso normalizamos antes de filtrar. Além disso, a
  // matéria com mais tópicos vinculados pode não ter jurisprudência alguma
  // (ex.: Língua Portuguesa, Conhecimentos Regionais) — nesse caso, buscamos
  // a próxima matéria (por volume de tópicos) que de fato tenha resultados,
  // em vez de levar o usuário a uma tela vazia.
  const { data: jurisCounts } = useQuery({
    queryKey: ['juris-count-by-disciplina'],
    // Import dinâmico: o service arrasta os ~800KB de data/jurisprudencias —
    // o Hub só precisa das contagens, então o chunk carrega fora do caminho crítico.
    queryFn: async () => (await import('@/services/jurisprudencias.service')).countByDisciplina(),
    staleTime: 5 * 60_000,
  });
  const topDisciplina = useMemo(() => {
    if (!jurisCounts) return null;
    for (const d of stats.porDisciplina) {
      const normalized = normalizeDisciplina(d.name);
      if ((jurisCounts[normalized] ?? 0) > 0) return normalized;
    }
    return null;
  }, [stats.porDisciplina, jurisCounts]);

  // Matérias deste concurso (com ao menos 1 tópico vinculado) — usadas para
  // escopar a sessão de flashcards ao invés de puxar todas as matérias do usuário.
  const linkedSubjectIds = useMemo(() => stats.porDisciplina.map((d) => d.id), [stats.porDisciplina]);

  // Lei seca escopada pelo edital (Fase 3): a primeira matéria do concurso
  // (por volume de tópicos) que tenha lei correspondente no Vade Mecum define
  // o filtro — mesmo racional do topDisciplina das jurisprudências.
  const topLeiDisciplina = useMemo(() => {
    for (const d of stats.porDisciplina) {
      const match = leiDisciplinaForSubject(d.name);
      if (match) return match;
    }
    return null;
  }, [stats.porDisciplina]);
  const vademecumHref = topLeiDisciplina
    ? `/vademecum?disciplina=${encodeURIComponent(topLeiDisciplina)}`
    : '/vademecum';

  function handlePrepClick(item: (typeof PREP_ITEMS)[number]) {
    if (isItemDisabled(item)) return;
    // Ações que vivem na página do edital: marca a etapa e leva à seção certa.
    if (item.catalog && catalogSlug) {
      togglePrep(item.key);
      router.push(`/editais/${catalogSlug}${item.anchor ?? ''}`);
      return;
    }
    if (item.key === 'prova-ultima' && catalogSlug) {
      togglePrep(item.key);
      router.push(`/editais/${catalogSlug}#provas`);
      return;
    }
    if (item.key === 'montar-edital' || item.key === 'pesos') { onGoMontar(); return; }
    if (item.key === 'cronograma') { onGenerate(); togglePrep(item.key); return; }
    if (item.key === 'juris') {
      router.push(topDisciplina ? `/jurisprudencias/lista?disciplina=${encodeURIComponent(topDisciplina)}` : '/jurisprudencias');
      return;
    }
    if (item.key === 'lei-seca') { router.push(vademecumHref); return; }
    togglePrep(item.key);
  }

  async function handleSaveDate() {
    try { await onSaveDate(dateValue || null); setEditingDate(false); }
    catch { /* toast já exibido pelo chamador */ }
  }

  return (
    <div style={s.section}>
      {/* ── Card de status: fase + countdown ── */}
      <div style={{ ...s.statusCard, flexDirection: isMobile ? 'column' : 'row' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.statusTags}>
            <span style={{ ...s.phaseTag, ...(isPre ? s.phaseTagPre : s.phaseTagPos) }}>
              {catalogInfo ? SITUACAO_LABEL[catalogInfo.situacao] : isPre ? 'Pré-edital' : 'Pós-edital'}
            </span>
            {catalogInfo && isPre && catalogInfo.ultimaEdicao && (
              <span style={s.metaChip}>Última edição: {catalogInfo.ultimaEdicao}</span>
            )}
            <span style={s.metaChip}>
              {target.boardName ?? (catalogInfo?.banca ? `Banca: ${catalogInfo.banca}` : 'Banca a definir')}
            </span>
            {target.orgao && <span style={s.metaChip}>{target.orgao}</span>}
            {target.ano_alvo && <span style={s.metaChip}>{target.ano_alvo}</span>}
          </div>
          <p style={s.statusHint}>
            {isPre
              ? 'Sem edital vigente — use a central de preparação abaixo para chegar pronta na publicação.'
              : 'Edital publicado — acompanhe o progresso e mantenha o cronograma em dia.'}
          </p>
          {isPre && (
            <Button
              variant="outline"
              size="sm"
              style={{ marginTop: 10, borderColor: theme.teal, background: theme.tealBg, color: theme.teal }}
              onClick={onPromote}
            >
              Edital publicado?
            </Button>
          )}
        </div>

        <div style={{ ...s.countdownBox, alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
          {editingDate ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                autoFocus
                style={s.dateInput}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDate(); if (e.key === 'Escape') setEditingDate(false); }}
              />
              <button onClick={handleSaveDate} style={s.dateSaveBtn}><Check size={14} strokeWidth={2.2} /></button>
              <button onClick={() => setEditingDate(false)} style={s.dateCancelBtn}><X size={14} strokeWidth={2} /></button>
            </div>
          ) : days !== null && cd ? (
            <button
              onClick={() => { setDateValue(target.exam_date ?? ''); setEditingDate(true); }}
              style={s.countdownBtn}
              title="Alterar data da prova"
            >
              <span style={{ ...s.countdownBig, color: cdColor }}>
                {days >= 0 ? days : '—'}
              </span>
              <span style={{ ...s.countdownLabel, color: cdColor }}>{cd.label}</span>
              <span style={s.countdownDate}>
                {formatDateBR(target.exam_date!)}
              </span>
            </button>
          ) : (
            <button
              onClick={() => { setDateValue(''); setEditingDate(true); }}
              style={s.setDateBtn}
            >
              + definir data da prova
            </button>
          )}
        </div>
      </div>

      {/* ── Sobre o concurso (ficha do catálogo) ── */}
      {catalogInfo && (
        <div style={s.card}>
          <div style={s.cardHead}>
            <h3 style={s.cardTitle}>Sobre o concurso</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => router.push(`/editais/${catalogInfo.slug}`)} style={s.editalPageLink}>
                Página do edital →
              </button>
              {catalogInfo.editalUrl && (
                <a href={catalogInfo.editalUrl} target="_blank" rel="noopener noreferrer" style={s.downloadBtn}>
                  Baixar edital ↓
                </a>
              )}
            </div>
          </div>
          <div style={{ ...s.factGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)' }}>
            <div style={s.fact}>
              <span style={s.factLabel}>Status</span>
              <span style={s.factValue}>{SITUACAO_LABEL[catalogInfo.situacao]}</span>
            </div>
            {catalogInfo.ultimaEdicao && (
              <div style={s.fact}>
                <span style={s.factLabel}>Última edição</span>
                <span style={s.factValue}>{catalogInfo.ultimaEdicao}</span>
              </div>
            )}
            {catalogInfo.banca && (
              <div style={s.fact}>
                <span style={s.factLabel}>{catalogInfo.situacao === 'vigente' ? 'Banca' : 'Última banca'}</span>
                <span style={s.factValue}>{catalogInfo.banca}</span>
              </div>
            )}
            {catalogInfo.vagas != null && (
              <div style={s.fact}>
                <span style={s.factLabel}>{catalogInfo.situacao === 'vigente' ? 'Vagas' : 'Vagas (última edição)'}</span>
                <span style={s.factValue}>{catalogInfo.vagas.toLocaleString('pt-BR')}</span>
              </div>
            )}
            {catalogInfo.remuneracao != null && (
              <div style={s.fact}>
                <span style={s.factLabel}>Remuneração</span>
                <span style={s.factValue}>{formatBRL(catalogInfo.remuneracao)}</span>
              </div>
            )}
            {catalogInfo.examDate && (
              <div style={s.fact}>
                <span style={s.factLabel}>Prova</span>
                <span style={s.factValue}>{formatDateBR(catalogInfo.examDate)}</span>
              </div>
            )}
            {catalogInfo.inscricoesAte && (
              <div style={s.fact}>
                <span style={s.factLabel}>Inscrições até</span>
                <span style={s.factValue}>{formatDateBR(catalogInfo.inscricoesAte)}</span>
              </div>
            )}
          </div>
          {catalogInfo.aviso && <p style={s.avisoText}>{catalogInfo.aviso}</p>}
        </div>
      )}

      {/* ── Linha do tempo: notícias, retificações e resultados ── */}
      {updates.length > 0 && (
        <div style={s.card}>
          <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>Linha do tempo e notícias</h3>
          <div style={s.updateList}>
            {updates.map((u) => {
              const meta = UPDATE_TIPO[u.tipo];
              const badgeStyle = meta.color === 'teal' ? s.updateBadgeTeal
                : meta.color === 'danger' ? s.updateBadgeDanger
                : meta.color === 'warn' ? s.updateBadgeWarn : s.updateBadgeMuted;
              const inner = (
                <>
                  <span style={{ ...s.updateBadge, ...badgeStyle }}>{meta.label}</span>
                  <span style={s.updateTitle}>{u.titulo}</span>
                  <span style={s.updateDate}>{formatDateBR(u.publishedAt)}</span>
                </>
              );
              return u.url ? (
                <a key={u.id} href={u.url} target="_blank" rel="noopener noreferrer" style={s.updateRow} title="Abrir fonte oficial">
                  {inner}
                </a>
              ) : (
                <div key={u.id} style={s.updateRow}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Central de preparação (pré-edital) ── */}
      {isPre && (
        <div style={s.card}>
          <div style={s.cardHead} onClick={() => setPrepOpen((v) => !v)}>
            <div>
              <h3 style={s.cardTitle}>Central de preparação</h3>
              <p style={s.cardSub}>
                {prepCheckedCount}/{countableItems.length} etapas · quem se prepara antes do edital sai na frente.
              </p>
            </div>
            <span style={{ ...s.prepPct, color: prepPct === 100 ? theme.teal : theme.inkSoft }}>{prepPct}%</span>
          </div>
          <div style={s.prepTrack}>
            <div style={{ ...s.prepFill, width: `${prepPct}%` }} />
          </div>
          {prepOpen && (
            <div style={s.prepList}>
              {PREP_ITEMS.map((item) => {
                const itemDisabled = isItemDisabled(item);
                const checked = !itemDisabled && isChecked(item);
                return (
                  <button
                    key={item.key}
                    onClick={() => handlePrepClick(item)}
                    disabled={itemDisabled}
                    style={{
                      ...s.prepRow,
                      ...(checked ? s.prepRowDone : {}),
                      ...(itemDisabled ? s.prepRowDisabled : {}),
                    }}
                    title={
                      itemDisabled ? 'Disponível quando o concurso estiver vinculado a um edital do banco'
                        : item.auto ? 'Marcado automaticamente com base no que você já configurou'
                        : item.catalog ? 'Abre a seção correspondente na página do edital'
                        : undefined
                    }
                  >
                    <span style={{ ...s.prepCheck, ...(checked ? s.prepCheckOn : {}) }}>{checked && <Check size={13} strokeWidth={2.5} />}</span>
                    <span style={{ ...s.prepLabel, ...(checked ? s.prepLabelDone : {}), ...(itemDisabled ? s.prepLabelDisabled : {}) }}>
                      {item.label}
                    </span>
                    {item.auto && <span style={s.autoTag}>auto</span>}
                    {itemDisabled && <span style={s.embreveTag}>em breve</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Progresso do edital ── */}
      <div style={s.card}>
        <div style={s.cardHead}>
          <div>
            <h3 style={s.cardTitle}>Progresso do edital</h3>
            <p style={s.cardSub}>
              {stats.totalLinked === 0
                ? 'Nenhum tópico vinculado ainda — monte o edital para acompanhar o avanço.'
                : `${stats.totalDone}/${stats.totalLinked} tópicos concluídos`}
            </p>
          </div>
          {stats.totalLinked > 0 && (
            <span style={{ ...s.prepPct, color: theme.teal }}>{progressoPct}%</span>
          )}
        </div>

        {stats.totalLinked === 0 ? (
          <Button variant="outline" style={{ marginTop: 12, borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onGoMontar}>Montar edital →</Button>
        ) : (
          <>
            <div style={s.prepTrack}>
              <div style={{ ...s.prepFill, width: `${progressoPct}%` }} />
            </div>
            <div style={s.subjectList}>
              {stats.porDisciplina.map((d) => {
                const pct = Math.round((d.done / d.total) * 100);
                return (
                  <div key={d.id} style={s.subjectRow}>
                    <span style={s.subjectName}>{d.name}</span>
                    <div style={s.subjectTrack}>
                      <div style={{ ...s.subjectFill, width: `${pct}%` }} />
                    </div>
                    <span style={s.subjectPct}>{d.done}/{d.total}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={onGoProgresso} style={s.linkBtn}>Ver progresso detalhado →</button>
          </>
        )}
      </div>

      {/* ── Ações rápidas: o concurso conversa com o resto da plataforma ── */}
      <div style={s.card}>
        <h3 style={{ ...s.cardTitle, marginBottom: 12 }}>Ações rápidas</h3>
        <div style={{ ...s.actionsGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)' }}>
          <Button
            variant={canGenerate ? 'primary' : 'outline'}
            style={canGenerate ? undefined : { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed', border: `0.5px solid ${theme.line}` }}
            onClick={onGenerate}
            disabled={!canGenerate}
            title={!canGenerate ? 'Vincule ao menos um tópico para gerar o cronograma' : undefined}
          >
            Gerar cronograma
          </Button>
          <Button variant="outline" onClick={onGoMontar}>Montar edital</Button>
          <Button variant="outline" onClick={() => router.push('/schedule')}>Plano de hoje</Button>
          <Button
            variant="outline"
            onClick={() => router.push(
              linkedSubjectIds.length > 0
                ? `/flashcards?subjectIds=${encodeURIComponent(linkedSubjectIds.join(','))}`
                : '/flashcards',
            )}
          >
            Flashcards
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(topDisciplina ? `/jurisprudencias/lista?disciplina=${encodeURIComponent(topDisciplina)}` : '/jurisprudencias')}
          >
            Jurisprudências
          </Button>
          <Button variant="outline" onClick={() => router.push(vademecumHref)}>Vade Mecum</Button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 12 },

  statusCard: { display: 'flex', gap: 16, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, boxShadow: theme.shadow, padding: 18, alignItems: 'stretch' },
  statusTags: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  phaseTag: { fontSize: 11, fontWeight: 600, borderRadius: theme.radiusXs, padding: '3px 8px', flexShrink: 0 },
  phaseTagPre: { color: theme.inkSoft, background: theme.muted },
  phaseTagPos: { color: theme.onTeal, background: theme.teal },
  metaChip: { fontSize: 12, fontWeight: 500, color: theme.inkSoft, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, padding: '3px 8px' },
  statusHint: { fontSize: 13, color: theme.inkFaint, margin: 0, lineHeight: 1.55 },
  promoteBtn: { marginTop: 10, padding: '7px 14px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  countdownBox: { display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0 },
  countdownBtn: { display: 'flex', flexDirection: 'column', alignItems: 'inherit', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'inherit' },
  countdownBig: { fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  countdownLabel: { fontSize: 13, fontWeight: 600, marginTop: 4 },
  countdownDate: { fontSize: 12, color: theme.inkFaint, marginTop: 2 },
  setDateBtn: { fontSize: 13, color: theme.teal, border: `1px dashed ${theme.teal}`, background: 'transparent', borderRadius: theme.radiusXs, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  dateInput: { padding: '6px 10px', borderRadius: theme.radiusXs, border: `1px solid ${theme.lineStrong}`, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  dateSaveBtn: { border: 'none', background: theme.primary, color: theme.onTeal, borderRadius: theme.radiusXs, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },
  dateCancelBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, borderRadius: theme.radiusXs, padding: '6px 8px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' },

  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, boxShadow: theme.shadow, padding: 18, minWidth: 0 },
  cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, cursor: 'default' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: 0 },
  cardSub: { fontSize: 13, color: theme.inkFaint, margin: '3px 0 0', lineHeight: 1.5 },
  prepPct: { fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },

  prepTrack: { height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', marginTop: 12 },
  prepFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  prepList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  prepRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', minWidth: 0, transition: 'background .12s' },
  prepRowDone: { background: theme.tealBg, border: `1px solid ${theme.teal}` },
  prepCheck: { width: 20, height: 20, borderRadius: theme.radiusXs, border: `1.5px solid ${theme.lineStrong}`, background: theme.card, color: 'transparent', fontSize: 12, display: 'grid', placeItems: 'center', flexShrink: 0 },
  prepCheckOn: { background: theme.teal, border: `1.5px solid ${theme.teal}`, color: theme.onTeal },
  prepLabel: { flex: 1, fontSize: 13, color: theme.ink, minWidth: 0 },
  prepLabelDone: { color: theme.inkSoft },
  autoTag: { fontSize: 10, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 6px', letterSpacing: 0.4, textTransform: 'uppercase', flexShrink: 0 },
  embreveTag: { fontSize: 10, fontWeight: 700, color: theme.inkFaint, background: theme.muted, borderRadius: theme.radiusXs, padding: '2px 6px', letterSpacing: 0.4, textTransform: 'uppercase', flexShrink: 0 },
  prepRowDisabled: { cursor: 'not-allowed', opacity: 0.6 },
  prepLabelDisabled: { color: theme.inkFaint },

  downloadBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit', flexShrink: 0 },
  editalPageLink: { background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 0' },
  factGrid: { display: 'grid', gap: 12, marginTop: 14 },
  fact: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  factLabel: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValue: { fontSize: 14, fontWeight: 600, color: theme.ink, overflowWrap: 'break-word' },
  avisoText: { fontSize: 12, color: theme.inkFaint, margin: '12px 0 0', lineHeight: 1.5, fontStyle: 'italic' },

  updateList: { display: 'flex', flexDirection: 'column', gap: 6 },
  updateRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0, textDecoration: 'none', cursor: 'pointer' },
  updateBadge: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  updateBadgeTeal: { color: theme.teal, background: theme.tealBg },
  updateBadgeWarn: { color: theme.warn, background: theme.warnBg },
  updateBadgeDanger: { color: theme.danger, background: theme.dangerBg },
  updateBadgeMuted: { color: theme.inkSoft, background: theme.muted },
  updateTitle: { flex: 1, fontSize: 13, color: theme.ink, minWidth: 0, lineHeight: 1.4 },
  updateDate: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },

  emptyCta: { marginTop: 12, padding: '10px 18px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  subjectList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  subjectRow: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  subjectName: { fontSize: 13, color: theme.ink, flex: '0 1 180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  subjectTrack: { flex: 1, height: 5, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  subjectFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  subjectPct: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 42, textAlign: 'right' },
  linkBtn: { marginTop: 12, background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  actionsGrid: { display: 'grid', gap: 8 },
  actionBtn: { padding: '11px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, color: theme.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color .12s, background .12s' },
  actionPrimary: { background: theme.teal, color: theme.onTeal, border: `0.5px solid ${theme.teal}` },
  actionDisabled: { background: theme.muted, color: theme.inkFaint, cursor: 'not-allowed', border: `0.5px solid ${theme.line}` },
};
