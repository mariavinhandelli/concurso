// components/features/caderno/ItemCard.tsx
// Card único de item das listas do hub Caderno (Tudo/Anotações/Erros): título +
// preview de 2 linhas + linha de meta (chip colorido, textos secundários, data
// relativa). Antes cada aba tinha o seu (notaCard/NoteItem/card do Tudo) — com
// densidades e informações diferentes; os erros nem mostravam data ou preview.
'use client';

import type { CSSProperties } from 'react';
import { Pin } from 'lucide-react';
import { fmtRelative } from '@/lib/relative-time';
import { theme } from '@/lib/theme';

export function ItemCard({
  title, preview, pinned, chip, meta, when, active, onClick,
}: {
  title: string;
  preview?: string | null;
  pinned?: boolean;
  /** Chip colorido de tipo (Resumo/Dica/Erro/…). */
  chip?: { label: string; bg: string; ink: string } | null;
  /** Textos secundários da linha de meta (tópico, banca…); nulos são ignorados. */
  meta?: (string | null | undefined)[];
  /** ISO de atualização — vira "há 2h"/"ontem" no canto direito. */
  when?: string;
  active?: boolean;
  onClick: () => void;
}) {
  const metas = (meta ?? []).filter((m): m is string => !!m);
  return (
    <button
      className="caderno-item-card"
      onClick={onClick}
      style={{ ...s.card, ...(active ? s.cardOn : {}) }}
      aria-current={active || undefined}
    >
      <span style={s.titulo}>
        {pinned && <Pin size={12} strokeWidth={2} style={{ marginRight: 3, verticalAlign: -1 }} aria-label="Fixada" />}
        {title}
      </span>
      {preview && <span style={s.preview}>{preview}</span>}
      {(chip || metas.length > 0 || when) && (
        <span style={s.metaRow}>
          {chip && <span style={{ ...s.chip, background: chip.bg, color: chip.ink }}>{chip.label}</span>}
          {metas.map((m, i) => <span key={i} style={s.metaTexto}>{m}</span>)}
          {when && <span style={s.quando}>{fmtRelative(when)}</span>}
        </span>
      )}
    </button>
  );
}

const s: Record<string, CSSProperties> = {
  card: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 },
  cardOn: { borderColor: theme.teal, background: theme.tealBg },
  titulo: { fontSize: 14, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  preview: { fontSize: 12, color: theme.inkSoft, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, minWidth: 0 },
  chip: { fontSize: 10, fontWeight: 700, borderRadius: theme.radiusPill, padding: '2px 8px', flexShrink: 0 },
  metaTexto: { fontSize: 11, color: theme.inkFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  quando: { fontSize: 11, color: theme.inkFaint, marginLeft: 'auto', flexShrink: 0 },
};
