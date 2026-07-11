'use client';

// Banco de editais prontos, navegável direto na página (sem modal escondido).
// Clique num edital abre os detalhes completos — a ativação é uma decisão
// informada, nunca o primeiro clique.

import { useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listCatalogEditais, type CatalogEdital } from '@/services/editaisCatalog.service';
import { EditalDetailModal } from '@/components/features/targets/EditalDetailModal';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

const SITUACAO_LABEL: Record<CatalogEdital['situacao'], string> = {
  vigente: 'Edital vigente',
  em_expectativa: 'Em expectativa',
  encerrado: 'Encerrado',
};

interface Props {
  isMobile: boolean;
  onActivated: (targetId: string) => void;
  onImportar: () => void;
}

export function BancoEditaisTab({ isMobile, onActivated, onImportar }: Props) {
  const [area, setArea] = useState<string>('todas');
  const [detail, setDetail] = useState<CatalogEdital | null>(null);

  const { data: editais, isLoading, isError } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
  });

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const e of editais ?? []) set.add(e.areaName ?? 'Outros');
    return [...set];
  }, [editais]);

  const filtered = useMemo(() => {
    if (area === 'todas') return editais ?? [];
    return (editais ?? []).filter((e) => (e.areaName ?? 'Outros') === area);
  }, [editais, area]);

  if (isLoading) {
    return (
      <div style={s.list}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...s.skeleton, animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p style={s.muted}>Não foi possível carregar o banco de editais. Tente de novo.</p>;
  }

  if ((editais?.length ?? 0) === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyTitle}>Banco de editais em construção</p>
        <p style={s.emptyHint}>Em breve, concursos prontos aqui. Por ora, crie seu concurso manualmente ou importe um edital colado.</p>
        <Button variant="outline" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onImportar}>Importar edital colado →</Button>
      </div>
    );
  }

  return (
    <>
      {/* Filtro por área */}
      {areas.length > 1 && (
        <div style={s.chips}>
          <button onClick={() => setArea('todas')} style={{ ...s.chip, ...(area === 'todas' ? s.chipOn : {}) }}>
            Todas
          </button>
          {areas.map((a) => (
            <button key={a} onClick={() => setArea(a)} style={{ ...s.chip, ...(area === a ? s.chipOn : {}) }}>
              {a}
            </button>
          ))}
        </div>
      )}

      <div style={s.list}>
        {filtered.map((e) => (
          <EditalCard key={e.id} edital={e} onOpen={() => setDetail(e)} />
        ))}
      </div>

      <p style={s.footerHint}>
        Não achou seu concurso?{' '}
        <button onClick={onImportar} style={s.footerLink}>Importe um edital colado →</button>
      </p>

      {detail && (
        <EditalDetailModal
          edital={detail}
          isMobile={isMobile}
          onClose={() => setDetail(null)}
          onActivated={onActivated}
        />
      )}
    </>
  );
}

function EditalCard({ edital: e, onOpen }: { edital: CatalogEdital; onOpen: () => void }) {
  const [hov, setHov] = useState(false);
  const meta = [
    e.banca,
    e.situacao === 'em_expectativa' && e.ultimaEdicao ? `última edição ${e.ultimaEdicao}` : e.ano ? String(e.ano) : null,
    `${e.subjectCount} matéria${e.subjectCount === 1 ? '' : 's'}`,
    `${e.topicCount} tópicos`,
  ].filter(Boolean).join(' · ');

  const extra = [
    e.vagas != null ? `${e.vagas.toLocaleString('pt-BR')} vagas` : null,
    e.examDate ? `prova em ${new Date(e.examDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onOpen}
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
          <span style={s.cardTitle}>{[e.orgao, e.cargo].filter(Boolean).join(' · ')}</span>
          <span style={{
            ...s.situacaoTag,
            ...(e.situacao === 'vigente' ? s.situacaoVigente
              : e.situacao === 'em_expectativa' ? s.situacaoExpectativa
              : s.situacaoEncerrado),
          }}>
            {SITUACAO_LABEL[e.situacao]}
          </span>
          {e.isActivated && <span style={s.activatedTag}>Ativado ✓</span>}
        </div>
        <div style={s.cardMeta}>{meta}</div>
        {extra && <div style={s.cardExtra}>{extra}</div>}
      </div>
      <span style={{ ...s.cardArrow, color: hov ? theme.teal : theme.inkFaint }}>
        Ver detalhes →
      </span>
    </button>
  );
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 13.5, color: theme.inkSoft, padding: '12px 0' },
  skeleton: { height: 84, borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite' },

  empty: { textAlign: 'center', padding: '40px 12px' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.6 },
  importBtn: { padding: '10px 20px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  chip: { padding: '6px 14px', borderRadius: 999, border: `1px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' },
  chipOn: { background: theme.tealBg, border: `1px solid ${theme.teal}`, color: theme.teal, fontWeight: 600 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', width: '100%', minWidth: 0, transition: 'border-color .15s, box-shadow .15s' },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  cardTitle: { fontSize: 14.5, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  situacaoTag: { fontSize: 10.5, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  situacaoVigente: { color: theme.onTeal, background: theme.teal },
  situacaoExpectativa: { color: theme.warn, background: theme.warnBg },
  situacaoEncerrado: { color: theme.inkFaint, background: theme.muted },
  activatedTag: { fontSize: 10.5, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0 },
  cardMeta: { fontSize: 12.5, color: theme.inkSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardExtra: { fontSize: 12, color: theme.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardArrow: { fontSize: 12.5, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .15s' },

  footerHint: { fontSize: 13, color: theme.inkFaint, margin: '16px 0 0', textAlign: 'center' },
  footerLink: { background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
