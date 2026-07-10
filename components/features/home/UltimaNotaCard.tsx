// components/features/home/UltimaNotaCard.tsx
// Atalho "continue de onde parou": a última anotação editada no Caderno,
// com link direto pro editor (deep-link ?nota=).
'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getLastEditedNote, NOTA_KINDS, type StudyNoteMeta } from '@/services/studyNotes.service';
import { KIND_CORES } from '@/components/features/caderno/notaCores';
import { theme } from '@/lib/theme';

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

export const UltimaNotaCard = memo(function UltimaNotaCard() {
  const router = useRouter();
  const { data, isLoading } = useQuery<StudyNoteMeta | null>({
    queryKey: ['ultima-nota'],
    queryFn: getLastEditedNote,
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  const kindLabel = NOTA_KINDS.find((k) => k.value === data.kind)?.label ?? data.kind;
  const cor = KIND_CORES[data.kind];

  return (
    <button onClick={() => router.push(`/caderno?nota=${data.id}`)} style={s.card}>
      <span style={s.icon}>✎</span>
      <div style={s.info}>
        <span style={s.eyebrow}>Continue de onde parou</span>
        <span style={s.titulo}>{data.title || 'Sem título'}</span>
      </div>
      <span style={{ ...s.kind, background: cor.bg, color: cor.ink }}>{kindLabel}</span>
      <span style={s.quando}>{fmtRelative(data.updated_at)}</span>
    </button>
  );
});

const s: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
    boxShadow: theme.shadow, padding: '13px 16px', cursor: 'pointer', fontFamily: theme.font, minWidth: 0,
  },
  icon: { fontSize: 18, flexShrink: 0 },
  info: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 },
  eyebrow: { fontSize: 10.5, fontWeight: 700, color: theme.inkFaint, letterSpacing: 0.4, textTransform: 'uppercase' },
  titulo: { fontSize: 13.5, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  kind: { fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 9px', flexShrink: 0 },
  quando: { fontSize: 11.5, color: theme.inkFaint, flexShrink: 0, whiteSpace: 'nowrap' },
};
