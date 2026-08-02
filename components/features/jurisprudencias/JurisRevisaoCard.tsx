// components/features/jurisprudencias/JurisRevisaoCard.tsx
// Cartão de revisão de uma jurisprudência: tese (ou pergunta, quando há
// flashcard) → revelar → avaliação de 4 níveis. Usado pela fila avulsa de
// jurisprudências (jurisprudencias/revisar) e pela fila única
// (app/(app)/revisar) — mesma mecânica, um só lugar para corrigir/evoluir.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { theme } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { INITIAL_JURIS_STATE, type JurisRating, type JurisReviewState } from '@/lib/juris-review';
import { RatingRow4 } from '@/components/features/reviews/RatingRow4';

export interface JurisRevisaoData {
  tribunal: string;
  disciplina: string;
  tese: string;
  resumo?: string | null;
  como_banca_cobra?: string | null;
  pegadinhas?: string | null;
  flashcard_frente?: string | null;
  flashcard_verso?: string | null;
}

export function JurisRevisaoCard({
  item, interacaoState, revealed, onReveal, onRate, disabled, overdueDays, revealHint, footer,
}: {
  item: JurisRevisaoData;
  interacaoState: JurisReviewState | null;
  revealed: boolean;
  onReveal: () => void;
  onRate: (r: JurisRating) => void;
  disabled?: boolean;
  overdueDays?: number;
  revealHint?: ReactNode;
  footer?: ReactNode;
}) {
  const temFlash = !!(item.flashcard_frente && item.flashcard_verso);

  return (
    <div style={s.card}>
      <div style={s.head}>
        <Badge variant="brand">{item.tribunal}</Badge>
        <Badge variant="neutral">{item.disciplina}</Badge>
        {!!overdueDays && overdueDays > 0 && <Badge variant="danger">{overdueDays}d atrasada</Badge>}
      </div>

      <div style={s.teseBox}>
        <p style={s.teseLabel}>{temFlash ? 'Pergunta' : 'Tese principal'}</p>
        <p style={s.teseText}>{temFlash ? item.flashcard_frente : item.tese}</p>
      </div>

      {revealed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {temFlash && (
            <div style={{ background: theme.okTint, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ ...s.secLabel, color: theme.okDeep }}>Resposta</p>
              <p style={s.secText}>{item.flashcard_verso}</p>
            </div>
          )}
          {!temFlash && item.resumo && (
            <div><p style={s.secLabel}>Resumo</p><p style={s.secText}>{item.resumo}</p></div>
          )}
          {item.como_banca_cobra && (
            <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ ...s.secLabel, color: theme.clay }}>Como a banca cobra</p>
              <p style={s.secText}>{item.como_banca_cobra}</p>
            </div>
          )}
          {item.pegadinhas && (
            <div style={{ background: theme.dangerTint, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ ...s.secLabel, color: theme.danger }}>Pegadinha</p>
              <p style={s.secText}>{item.pegadinhas}</p>
            </div>
          )}
        </div>
      )}

      {!revealed ? (
        <div style={{ textAlign: 'center' }}>
          <Button onClick={onReveal} style={{ padding: '13px 32px', fontSize: 15 }}>
            {temFlash ? 'Ver resposta' : 'Ver tudo'}
          </Button>
          {revealHint && <p style={s.revealHint}>{revealHint}</p>}
        </div>
      ) : (
        <>
          <RatingRow4 state={interacaoState ?? INITIAL_JURIS_STATE} onRate={onRate} disabled={disabled} />
          {footer}
        </>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  head: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  teseBox: { background: theme.tealBg, border: `1px solid ${theme.teal}`, borderRadius: theme.radiusSm, padding: '16px 18px' },
  teseLabel: { fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' },
  teseText: { fontSize: 17, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 },
  secLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 5px' },
  secText: { fontSize: 14, color: theme.ink, lineHeight: 1.65, margin: 0 },
  revealHint: { fontSize: 12, color: theme.inkFaint, marginTop: 12 },
};
