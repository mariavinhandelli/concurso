'use client';

// Card de um edital do catálogo — compartilhado entre a aba "Banco de editais"
// (agrupada por órgão) e a página do órgão (/editais/orgao/[slug]).

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Users } from 'lucide-react';
import { STUDYING_BADGE_MIN, getCatalogEditalBySlug, type CatalogEdital } from '@/services/editaisCatalog.service';
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
  /** Pessoas estudando este edital nos últimos 30 dias (prova social). */
  estudando?: number;
}

export function EditalCard({ edital: e, hideOrgao, estudando }: Props) {
  const [hov, setHov] = useState(false);
  const queryClient = useQueryClient();

  // Auditoria de performance (02/08) — <Link> já faz prefetch da ROTA/JS
  // (comentário abaixo), mas não da query de dados que a página do edital
  // dispara (['edital', slug]); mesmo padrão de prefetch já usado em
  // useSchedulePage.ts. Clicar no card não paga mais o RTT completo.
  const prefetchEdital = () => {
    queryClient.prefetchQuery({
      queryKey: ['edital', e.slug],
      queryFn: () => getCatalogEditalBySlug(e.slug),
    });
  };
  const meta = [
    e.banca,
    e.uf,
    e.situacao === 'em_expectativa' && e.ultimaEdicao ? `última edição ${e.ultimaEdicao}` : e.ano ? String(e.ano) : null,
    // Edital sem conteúdo programático curado é sinalizado — não escondido.
    // Grade prevista (edital não publicado) também: no card ela é indistinguível
    // de uma curada de edital oficial se não dissermos.
    e.subjectCount > 0
      ? `${e.subjectCount} matéria${e.subjectCount === 1 ? '' : 's'}${e.gradeProvisoria ? ' (grade prevista)' : ''}`
      : 'grade em preparação',
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
      onMouseEnter={() => { setHov(true); prefetchEdital(); }}
      onMouseLeave={() => setHov(false)}
      // Paridade teclado: o foco recebe o mesmo realce (borda teal + sombra)
      // que o mouse — o anel global de :focus-visible continua por cima.
      onFocus={() => { setHov(true); prefetchEdital(); }}
      onBlur={() => setHov(false)}
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
          {/* Prova social só acima da régua: "1 pessoa estudando" depõe contra. */}
          {(estudando ?? 0) >= STUDYING_BADGE_MIN && (
            <span style={s.estudandoTag}>
              <Users size={11} strokeWidth={2.2} />
              {estudando} estudando
            </span>
          )}
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
  // flexBasis:0 (não só minWidth:0): line-breaking do flex-wrap decide em QUAL
  // linha cada item cai usando o tamanho hipotético ANTES do shrink — com
  // flex-basis:auto (o padrão), o título contribui seu texto inteiro pra essa
  // conta, "reserva" a linha 1 sozinho e empurra os selos pra linha 2 mesmo
  // com minWidth:0 (isso só afeta o encolhimento DEPOIS de decidida a linha).
  // Com basis 0, o título quase não pesa nessa decisão — os selos ficam na
  // linha 1, e o título usa o espaço sobrando (via flexGrow) e trunca nele.
  cardTitle: { fontSize: 15, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0%', minWidth: '4ch' },
  situacaoTag: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  situacaoVigente: { color: theme.onTeal, background: theme.teal },
  // warnDeep (não warn cru): warn sobre warnBg dá ~1,9:1 e reprova AA — mesma
  // fórmula do Badge do design system.
  situacaoExpectativa: { color: theme.warnDeep, background: theme.warnBg },
  // inkSoft (não inkFaint): inkFaint sobre muted reprova AA em 11px nas 4
  // paletas do dark mode; inkSoft passa em todas menos menta (dívida de paleta).
  situacaoEncerrado: { color: theme.inkSoft, background: theme.muted },
  activatedTag: { fontSize: 11, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0 },
  estudandoTag: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusPill, padding: '2px 9px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  cardMeta: { fontSize: 13, color: theme.inkSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardExtra: { fontSize: 12, color: theme.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardArrow: { fontSize: 13, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .15s' },
};
