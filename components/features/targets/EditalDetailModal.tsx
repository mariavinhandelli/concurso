'use client';

// Detalhes de um edital do catálogo — o usuário explora a ficha, as disciplinas
// e a linha do tempo ANTES de decidir ativar.

import { useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  activateCatalogEdital, getCatalogEditalSubjects, listEditalUpdates,
  type CatalogEdital, type CatalogEditalSubject, type EditalUpdate, type EditalUpdateTipo,
} from '@/services/editaisCatalog.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';
import { IconButton } from '@/components/ui/IconButton';

const SITUACAO_LABEL: Record<CatalogEdital['situacao'], string> = {
  vigente: 'Edital vigente',
  em_expectativa: 'Em expectativa',
  encerrado: 'Encerrado',
};

const UPDATE_TIPO: Record<EditalUpdateTipo, { label: string; fg: string; bg: string }> = {
  noticia: { label: 'Notícia', fg: theme.teal, bg: theme.tealBg },
  retificacao: { label: 'Retificação', fg: theme.danger, bg: theme.dangerBg },
  aviso: { label: 'Aviso', fg: theme.warn, bg: theme.warnBg },
  resultado: { label: 'Resultado', fg: theme.inkSoft, bg: theme.muted },
};

// Peso 1–5 da disciplina, expresso como pontos preenchidos — mais rápido de
// ler do que um número solto ao lado da contagem de questões.
function WeightDots({ weight }: { weight: number }) {
  return (
    <span style={s.weightDots} title={`Peso ${weight} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ ...s.weightDot, background: n <= weight ? theme.teal : theme.line }} />
      ))}
    </span>
  );
}

function formatDateBR(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

interface Props {
  edital: CatalogEdital;
  isMobile: boolean;
  onClose: () => void;
  onActivated: (targetId: string) => void;
}

export function EditalDetailModal({ edital, isMobile, onClose, onActivated }: Props) {
  const toast = useToast();
  const [activating, setActivating] = useState(false);

  const { data: subjects } = useQuery<CatalogEditalSubject[]>({
    queryKey: ['catalog-edital-subjects', edital.id],
    queryFn: () => getCatalogEditalSubjects(edital.id),
  });
  const { data: updates } = useQuery<EditalUpdate[]>({
    queryKey: ['catalog-edital-updates', edital.id],
    queryFn: () => listEditalUpdates(edital.id),
  });

  async function handleActivate() {
    if (activating) return;
    setActivating(true);
    try {
      const targetId = await activateCatalogEdital(edital.id);
      onActivated(targetId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar edital.');
      setActivating(false);
    }
  }

  const totalQuestions = (subjects ?? []).reduce((acc, s) => acc + (s.numQuestions ?? 0), 0);

  const facts: { label: string; value: string }[] = [
    { label: 'Status', value: SITUACAO_LABEL[edital.situacao] },
    ...(edital.banca ? [{ label: edital.situacao === 'vigente' ? 'Banca' : 'Última banca', value: edital.banca }] : []),
    ...(edital.ultimaEdicao ? [{ label: 'Última edição', value: String(edital.ultimaEdicao) }] : []),
    ...(edital.vagas != null ? [{ label: 'Vagas', value: edital.vagas.toLocaleString('pt-BR') }] : []),
    ...(edital.remuneracao != null ? [{ label: 'Remuneração', value: edital.remuneracao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }] : []),
    ...(edital.examDate ? [{ label: 'Prova', value: formatDateBR(edital.examDate) }] : []),
    ...(edital.inscricoesAte ? [{ label: 'Inscrições até', value: formatDateBR(edital.inscricoesAte) }] : []),
  ];

  return (
    <Overlay onClose={onClose} maxWidth={640} labelledBy="edital-detail-title" padding={0} hideClose>
      <div style={{ width: isMobile ? '100%' : undefined }}>
        <div style={s.head}>
          <div style={{ minWidth: 0 }}>
            <div style={s.titleRow}>
              <h2 id="edital-detail-title" style={s.h2}>{[edital.orgao, edital.cargo].filter(Boolean).join(' · ')}</h2>
              <span style={{
                ...s.situacaoTag,
                ...(edital.situacao === 'vigente' ? s.situacaoVigente
                  : edital.situacao === 'em_expectativa' ? s.situacaoExpectativa
                  : s.situacaoEncerrado),
              }}>
                {SITUACAO_LABEL[edital.situacao]}
              </span>
            </div>
            {edital.areaName && <p style={s.areaLabel}>{edital.areaName}</p>}
          </div>
          <IconButton onClick={onClose} aria-label="Fechar" size="sm" style={{ fontSize: 16, flexShrink: 0 }}>✕</IconButton>
        </div>

        <div style={s.body}>
          {/* Ficha */}
          <div style={{ ...s.factGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)' }}>
            {facts.map((f) => (
              <div key={f.label} style={s.fact}>
                <span style={s.factLabel}>{f.label}</span>
                <span style={s.factValue}>{f.value}</span>
              </div>
            ))}
          </div>
          {edital.aviso && <p style={s.avisoText}>{edital.aviso}</p>}

          {/* Conteúdo do edital */}
          <div style={s.sectionHead}>
            <h3 style={s.h3}>Conteúdo do edital</h3>
            <span style={s.sectionMeta}>
              {edital.subjectCount} matéria{edital.subjectCount === 1 ? '' : 's'} · {edital.topicCount} tópicos
              {totalQuestions > 0 && ` · ${totalQuestions} questões`}
            </span>
          </div>
          {!subjects ? (
            <div style={s.skeleton} />
          ) : (
            <div style={s.subjectList}>
              {subjects.map((sub) => (
                <div key={sub.name} style={s.subjectRow}>
                  <div style={s.subjectLeft}>
                    <span style={s.subjectName}>{sub.name}</span>
                    <span style={s.subjectSub}>
                      {sub.topicCount} tópico{sub.topicCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div style={s.subjectRight}>
                    <WeightDots weight={sub.weight} />
                    {sub.numQuestions != null ? (
                      <span style={s.questionBadge}>{sub.numQuestions} questões</span>
                    ) : (
                      <span style={s.questionBadgeMuted}>sem questões fixas</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Linha do tempo e notícias */}
          {(updates?.length ?? 0) > 0 && (
            <>
              <div style={s.sectionHead}>
                <h3 style={s.h3}>Linha do tempo e notícias</h3>
              </div>
              <div style={s.updateList}>
                {updates!.map((u) => {
                  const meta = UPDATE_TIPO[u.tipo];
                  return (
                    <div key={u.id} style={s.updateRow}>
                      <span style={{ ...s.updateBadge, color: meta.fg, background: meta.bg }}>{meta.label}</span>
                      <span style={s.updateTitle}>{u.titulo}</span>
                      <span style={s.updateDate}>{formatDateBR(u.publishedAt)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={s.footer}>
          {edital.editalUrl && (
            <a href={edital.editalUrl} target="_blank" rel="noopener noreferrer" style={s.linkBtn}>
              Baixar edital ↓
            </a>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {/* Edital sem conteúdo programático: ativar criaria um concurso vazio. */}
          {!edital.isActivated && edital.subjectCount === 0 ? (
            <Button disabled title="Conteúdo programático em preparação — acompanhe as notícias por aqui.">
              Conteúdo em preparação
            </Button>
          ) : (
            <Button
              onClick={handleActivate}
              disabled={activating}
              style={edital.isActivated ? { background: theme.card, color: theme.teal, border: `1px solid ${theme.teal}` } : undefined}
            >
              {activating ? 'Ativando…' : edital.isActivated ? 'Abrir concurso' : 'Ativar edital'}
            </Button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

const s: Record<string, CSSProperties> = {
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 22px 14px', borderBottom: `0.5px solid ${theme.line}` },
  titleRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0, overflowWrap: 'break-word' },
  situacaoTag: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '3px 9px', flexShrink: 0, letterSpacing: 0.2 },
  situacaoVigente: { color: theme.onTeal, background: theme.teal },
  situacaoExpectativa: { color: theme.warn, background: theme.warnBg },
  situacaoEncerrado: { color: theme.inkFaint, background: theme.muted },
  areaLabel: { fontSize: 12, color: theme.inkFaint, margin: '4px 0 0', fontWeight: 500 },

  body: { overflowY: 'auto', padding: '16px 22px' },

  factGrid: { display: 'grid', gap: 12 },
  fact: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  factLabel: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValue: { fontSize: 14, fontWeight: 600, color: theme.ink, overflowWrap: 'break-word' },
  avisoText: { fontSize: 12, color: theme.inkFaint, margin: '12px 0 0', lineHeight: 1.5, fontStyle: 'italic' },

  sectionHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '20px 0 10px', flexWrap: 'wrap' },
  h3: { fontSize: 14, fontWeight: 700, color: theme.ink, margin: 0 },
  sectionMeta: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  skeleton: { height: 120, borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite' },

  subjectList: { display: 'flex', flexDirection: 'column', gap: 6 },
  subjectRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  subjectLeft: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  subjectName: { fontSize: 14, color: theme.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subjectSub: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  subjectRight: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  weightDots: { display: 'inline-flex', gap: 3, alignItems: 'center' },
  weightDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  questionBadge: { fontSize: 12, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '4px 10px', whiteSpace: 'nowrap' },
  questionBadgeMuted: { fontSize: 12, fontWeight: 500, color: theme.inkFaint, whiteSpace: 'nowrap' },

  updateList: { display: 'flex', flexDirection: 'column', gap: 6 },
  updateRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  updateBadge: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0 },
  updateTitle: { flex: 1, fontSize: 13, color: theme.ink, minWidth: 0, lineHeight: 1.4 },
  updateDate: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },

  footer: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 22px', borderTop: `0.5px solid ${theme.line}` },
  linkBtn: { fontSize: 13, fontWeight: 600, color: theme.teal, textDecoration: 'none', padding: '8px 0' },
  btnGhost: { padding: '10px 14px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnPrimary: { padding: '10px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnOpen: { background: theme.card, color: theme.teal, border: `1px solid ${theme.teal}` },
};
