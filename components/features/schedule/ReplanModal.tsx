// components/features/schedule/ReplanModal.tsx
// Cronograma vivo: confirmação da redistribuição de blocos atrasados —
// transparente por design (o usuário vê exatamente pra onde cada bloco vai
// antes de confirmar, em vez da reorganização acontecer em silêncio).
'use client';

import { theme, zIndex } from '@/lib/theme';
import { tons, dateLabelOf } from '@/lib/schedule-utils';
import type { ReplanMove } from '@/lib/schedule/replan';
import { Button } from '@/components/ui/Button';

interface Props {
  moves: ReplanMove[];
  applying: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ReplanModal({ moves, applying, onConfirm, onClose }: Props) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.h2}>Reorganizar a semana</h2>
        <p style={s.sub}>
          {moves.length} {moves.length === 1 ? 'bloco ficou' : 'blocos ficaram'} para trás.
          Veja pra onde {moves.length === 1 ? 'ele vai' : 'eles vão'} — nada é excluído, só remarcado.
        </p>

        <div style={s.lista}>
          {moves.map((m, i) => {
            const t = tons(m.block.subjectColor ?? '#C9B8DD');
            return (
              <div key={i} style={s.item}>
                <span style={{ ...s.dot, background: t.border }} />
                <div style={s.itemInfo}>
                  <span style={s.nome}>{m.block.subjectName}</span>
                  {m.block.topicName && <span style={s.topico}>{m.block.topicName}</span>}
                </div>
                <span style={s.seta}>
                  {dateLabelOf(new Date(m.fromDate + 'T00:00:00'))} → <b style={{ color: theme.ink }}>{dateLabelOf(new Date(m.toDate + 'T00:00:00'))}</b>
                </span>
              </div>
            );
          })}
        </div>

        <div style={s.actions}>
          <Button variant="outline" onClick={onClose} disabled={applying}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={applying}>
            {applying ? 'Reorganizando…' : 'Reorganizar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex.modal, padding: 16 },
  modal: { background: theme.card, borderRadius: theme.radius, width: 'min(480px, 96vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 24, boxShadow: theme.shadowModal, fontFamily: theme.font },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  sub: { fontSize: 13.5, color: theme.inkSoft, margin: '6px 0 16px', lineHeight: 1.5 },
  lista: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', marginBottom: 18 },
  item: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.bg },
  dot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  itemInfo: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  nome: { fontSize: 13.5, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  topico: { fontSize: 11.5, color: theme.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  seta: { fontSize: 12, color: theme.inkSoft, whiteSpace: 'nowrap', flexShrink: 0 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancel: { padding: '10px 18px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirm: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
