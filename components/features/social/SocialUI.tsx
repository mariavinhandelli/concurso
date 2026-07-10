// components/features/social/SocialUI.tsx
// Primitivos visuais compartilhados entre o ranking de Amigos e o de Turmas.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { fmtMin } from '@/lib/format/time';
import { theme } from '@/lib/theme';

const MEDALHAS = ['🥇', '🥈', '🥉'];

export function Avatar({ name, url, size = 40, ring }: { name: string; url: string | null; size?: number; ring?: boolean }) {
  const initial = (name?.[0] ?? '?').toUpperCase();
  const border = ring ? `2px solid ${theme.teal}` : 'none';
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border }} />
  ) : (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: theme.primary, color: theme.onTeal, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size * 0.4, border }}>{initial}</span>
  );
}

export function RankRow({
  position, name, avatarUrl, isMe, streak, weekMinutes, coveragePct, badge, onRemove,
}: {
  position: number;
  name: string;
  avatarUrl: string | null;
  isMe?: boolean;
  streak: number;
  weekMinutes: number;
  coveragePct: number;
  badge?: ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div style={{ ...s.row, ...(isMe ? s.rowMe : {}) }}>
      <span style={s.pos}>{MEDALHAS[position] ?? `${position + 1}º`}</span>
      <Avatar name={name} url={avatarUrl} size={38} ring={isMe} />
      <div style={s.info}>
        <span style={s.name}>
          {isMe ? 'Você' : name}
          {badge && <span style={s.badge}>{badge}</span>}
        </span>
        <span style={s.meta}>🔥 {streak} {streak === 1 ? 'dia' : 'dias'} · {coveragePct}% do edital</span>
      </div>
      <span style={s.min}>{fmtMin(weekMinutes)}</span>
      {onRemove && (
        <button onClick={onRemove} style={s.remove} title="Remover" aria-label="Remover">✕</button>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg },
  rowMe: { background: theme.tealBg, borderColor: theme.teal },
  pos: { fontSize: 16, fontWeight: 800, color: theme.inkSoft, width: 30, textAlign: 'center', flexShrink: 0 },
  info: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 2 },
  name: { fontSize: 14.5, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 },
  badge: { fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: theme.tealDeep, background: theme.tealBg, padding: '1px 6px', borderRadius: 999, flexShrink: 0 },
  meta: { fontSize: 12, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  min: { fontSize: 15, fontWeight: 800, color: theme.tealDeep, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  remove: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', flexShrink: 0, padding: 4, opacity: 0.6 },
};
