// components/features/social/SocialUI.tsx
// Primitivos visuais compartilhados entre o ranking de Amigos e o de Turmas.
'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Flame } from 'lucide-react';
import { fmtMin } from '@/lib/format/time';
import { theme } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';

const MEDALHAS = ['🥇', '🥈', '🥉'];

// Não existe @usuário na plataforma — só "nome de exibição" livre — então duas
// pessoas na mesma lista (ranking de Amigos, de Turma) podem ter o mesmo nome
// (ex.: "Maria" é comum). Sem isso, tanto a linha quanto "Ações para {nome}"
// do menu ficam ambíguos entre as duas. Sufixo curto e estável (baseado no id,
// não em ordem de array) e só aparece quando há colisão de fato.
export function disambiguateNames<T extends { userId: string; name: string }>(
  people: readonly T[],
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  const out = new Map<string, string>();
  for (const p of people) {
    const duplicado = (counts.get(p.name) ?? 0) > 1;
    out.set(p.userId, duplicado ? `${p.name} · ${p.userId.slice(0, 4).toUpperCase()}` : p.name);
  }
  return out;
}

export function Avatar({ name, url, size = 40, ring }: { name: string; url: string | null; size?: number; ring?: boolean }) {
  // Até 28/07 nenhum avatar chegava aqui (o perfil social lia de uma coluna
  // sempre vazia), então a foto nunca tinha sido exercitada de verdade. Com
  // imagem real vem o caso da imagem que não carrega — arquivo apagado do
  // bucket, URL antiga, offline — e um <img> quebrado é pior que a inicial.
  const [falhou, setFalhou] = useState(false);
  const initial = (name?.[0] ?? '?').toUpperCase();
  const border = ring ? `2px solid ${theme.teal}` : 'none';
  const base: CSSProperties = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border };

  return url && !falhou ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      // Sem loading="lazy": para um avatar de 28-40px numa lista curta ele não
      // economiza nada e atrasa a linha, além de nunca disparar quando o
      // elemento não é considerado visível.
      decoding="async"
      onError={() => setFalhou(true)}
      style={{ ...base, objectFit: 'cover', background: theme.bg }}
    />
  ) : (
    <span style={{ ...base, background: theme.primary, color: theme.onPrimary, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size * 0.4 }}>{initial}</span>
  );
}

// `actions` substituiu o antigo `onRemove`: era um "X" de 13px que desfazia a
// amizade num clique, sem confirmação e sem desfazer (P2-9), e não havia onde
// pendurar bloquear/denunciar (P1-5). Agora cada tela compõe o próprio menu.
// O número ranqueado é CONSTÂNCIA (dias na própria meta, 0..7), não volume.
// Antes era `fmtMin(weekMinutes)`: um pódio de horas absoluto, que é o formato
// que a pesquisa de gamificação aponta como desmotivador justamente para quem
// está embaixo. Os minutos continuam visíveis como contexto, mas não ordenam.
//
// `% do edital` saiu da linha: comparava pessoas de concursos DIFERENTES, onde
// o número não quer dizer a mesma coisa. Esse dado migrou para a comparação com
// pares do mesmo edital, onde ele de fato significa algo.
export function RankRow({
  position, name, avatarUrl, isMe, streak, weekMinutes, daysOnTarget, badge, actions,
}: {
  position: number;
  name: string;
  avatarUrl: string | null;
  isMe?: boolean;
  streak: number;
  weekMinutes: number;
  daysOnTarget: number;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={{ ...s.row, ...(isMe ? s.rowMe : {}) }}>
      <span style={s.pos}>{MEDALHAS[position] ?? `${position + 1}º`}</span>
      <Avatar name={name} url={avatarUrl} size={38} ring={isMe} />
      <div style={s.info}>
        <span style={s.name}>
          {/* text-overflow não se aplica a uma caixa flex (s.name) — só a uma
              caixa de texto simples. Sem este span interno, um nome comprido
              cortava sem "…" em vez de truncar. */}
          <span style={s.nameText}>{isMe ? 'Você' : name}</span>
          {badge && <Badge variant="brand" style={{ textTransform: 'uppercase' }}>{badge}</Badge>}
        </span>
        <span
          style={{ ...s.meta, display: 'inline-flex', alignItems: 'center', gap: 3 }}
          title="sequência: dias seguidos com pelo menos 30 min — não é a meta pessoal"
        >
          <Flame size={11} strokeWidth={2} /> {streak} {streak === 1 ? 'dia' : 'dias'} seguidos · {fmtMin(weekMinutes)} na semana
        </span>
      </div>
      <span style={s.diasWrap} title="dias em que bateu a própria meta, nos últimos 7">
        <span style={s.dias}>{daysOnTarget}<span style={s.diasDe}>/7</span></span>
        <span style={s.diasCaption}>na meta</span>
      </span>
      {actions}
    </div>
  );
}

// Linha de quem está na sua lista mas sem números para mostrar (perfil social
// desativado). Fora do pódio de propósito: 0 min ali seria comparação falsa.
export function QuietRow({ name, avatarUrl, isMe, nota, actions }: {
  name: string;
  avatarUrl: string | null;
  isMe?: boolean;
  nota: string;
  actions?: ReactNode;
}) {
  return (
    <div style={s.quietRow}>
      <Avatar name={name} url={avatarUrl} size={28} />
      <span style={s.quietName}>{isMe ? 'Você' : name}</span>
      <span style={s.quietTag}>{nota}</span>
      {actions}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg },
  rowMe: { background: theme.tealBg, borderColor: theme.teal },
  pos: { fontSize: 16, fontWeight: 800, color: theme.inkSoft, width: 30, textAlign: 'center', flexShrink: 0 },
  info: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: 700, color: theme.ink, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  nameText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  meta: { fontSize: 12, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  diasWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 1 },
  dias: { fontSize: 17, fontWeight: 800, color: theme.tealDeep, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  diasDe: { fontSize: 12, fontWeight: 700, color: theme.inkFaint },
  diasCaption: { fontSize: 9, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.3 },

  quietRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px' },
  quietName: { fontSize: 14, fontWeight: 600, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  quietTag: { fontSize: 12, color: theme.inkFaint, marginRight: 'auto', whiteSpace: 'nowrap' },
};
