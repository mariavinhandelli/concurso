'use client';

// Card de um edital do catálogo — compartilhado entre a aba "Banco de editais"
// (agrupada por órgão) e a página do órgão (/editais/orgao/[slug]).

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { type CatalogEdital } from '@/services/editaisCatalog.service';
import { formatDateBR } from '@/lib/targets';
import { theme } from '@/lib/theme';

export const SITUACAO_LABEL: Record<CatalogEdital['situacao'], string> = {
  vigente: 'Edital vigente',
  em_expectativa: 'Em expectativa',
  encerrado: 'Encerrado',
};

// Tag de situação compartilhada — única fonte do mapeamento situação→cor
// (usada no card, no header de /editais/[slug] e em "Outros cargos").
export function SituacaoTag({ situacao }: { situacao: CatalogEdital['situacao'] }) {
  return (
    <span style={{
      ...s.situacaoTag,
      ...(situacao === 'vigente' ? s.situacaoVigente
        : situacao === 'em_expectativa' ? s.situacaoExpectativa
        : s.situacaoEncerrado),
    }}>
      {SITUACAO_LABEL[situacao]}
    </span>
  );
}

interface Props {
  edital: CatalogEdital;
  /** Oculta o órgão no título (página do órgão já o exibe no header). */
  hideOrgao?: boolean;
}

export function EditalCard({ edital: e, hideOrgao }: Props) {
  const [hov, setHov] = useState(false);
  const meta = [
    e.banca,
    e.uf,
    e.situacao === 'em_expectativa' && e.ultimaEdicao ? `última edição ${e.ultimaEdicao}` : e.ano ? String(e.ano) : null,
    // Edital sem conteúdo programático curado é sinalizado — não escondido.
    e.subjectCount > 0 ? `${e.subjectCount} matéria${e.subjectCount === 1 ? '' : 's'}` : 'grade em preparação',
    e.topicCount > 0 ? `${e.topicCount} tópicos` : null,
  ].filter(Boolean).join(' · ');

  const extra = [
    e.vagas != null ? `${e.vagas.toLocaleString('pt-BR')} vagas` : null,
    e.remuneracao != null ? `inicial ${e.remuneracao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : null,
    e.examDate ? `prova em ${formatDateBR(e.examDate)}` : null,
  ].filter(Boolean).join(' · ');

  const titulo = hideOrgao ? (e.cargo || e.orgao) : [e.orgao, e.cargo].filter(Boolean).join(' · ');

  return (
    // <Link> (e não <button> + router.push): o card é navegação de verdade —
    // crawlers seguem o href nas páginas públicas e o Next faz prefetch.
    <Link
      href={`/editais/${e.slug}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...s.card,
        borderColor: hov ? theme.teal : theme.line,
        boxShadow: hov ? theme.shadowHover : theme.shadow,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={s.cardTitleRow}>
          <span style={s.cardTitle}>{titulo}</span>
          <SituacaoTag situacao={e.situacao} />
          {e.isActivated && <span style={{ ...s.activatedTag, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ativado <Check size={12} strokeWidth={2.5} /></span>}
        </div>
        <div style={s.cardMeta}>{meta}</div>
        {extra && <div style={s.cardExtra}>{extra}</div>}
      </div>
      <span style={{ ...s.cardArrow, color: hov ? theme.teal : theme.inkFaint }}>
        Ver detalhes →
      </span>
    </Link>
  );
}

const s: Record<string, CSSProperties> = {
  card: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', width: '100%', minWidth: 0, transition: 'border-color .15s, box-shadow .15s', textDecoration: 'none' },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  situacaoTag: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  situacaoVigente: { color: theme.onTeal, background: theme.teal },
  // warnDeep (não warn cru): warn sobre warnBg dá ~1,9:1 e reprova AA — mesma
  // fórmula do Badge do design system.
  situacaoExpectativa: { color: theme.warnDeep, background: theme.warnBg },
  situacaoEncerrado: { color: theme.inkFaint, background: theme.muted },
  activatedTag: { fontSize: 11, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0 },
  cardMeta: { fontSize: 13, color: theme.inkSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardExtra: { fontSize: 12, color: theme.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardArrow: { fontSize: 13, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .15s' },
};
