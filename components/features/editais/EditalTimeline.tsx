'use client';

// Linha do tempo do edital: notícias, avisos, resultados e retificações.
// Retificações com diff curado (changes) expandem para comparação visual
// antes/depois — sem versionar o edital inteiro, só o que de fato mudou.

import { useState, type CSSProperties } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { theme } from '@/lib/theme';
import type { EditalUpdate, EditalUpdateTipo } from '@/services/editaisCatalog.service';

const UPDATE_TIPO: Record<EditalUpdateTipo, { label: string; fg: string; bg: string }> = {
  noticia: { label: 'Notícia', fg: theme.teal, bg: theme.tealBg },
  retificacao: { label: 'Retificação', fg: theme.danger, bg: theme.dangerBg },
  aviso: { label: 'Aviso', fg: theme.warn, bg: theme.warnBg },
  resultado: { label: 'Resultado', fg: theme.inkSoft, bg: theme.muted },
};

function formatDateBR(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

function hasDiff(u: EditalUpdate): boolean {
  return Boolean(u.changes && ((u.changes.campos?.length ?? 0) > 0 || (u.changes.conteudo?.length ?? 0) > 0));
}

export function EditalTimeline({ updates }: { updates: EditalUpdate[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div style={s.list}>
      {updates.map((u) => {
        const meta = UPDATE_TIPO[u.tipo];
        const expandable = hasDiff(u);
        const open = expanded.has(u.id);
        return (
          <div key={u.id} style={s.itemWrap}>
            <div
              role={expandable ? 'button' : undefined}
              tabIndex={expandable ? 0 : undefined}
              onClick={expandable ? () => toggle(u.id) : undefined}
              onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(u.id); } : undefined}
              style={{ ...s.row, cursor: expandable ? 'pointer' : 'default' }}
            >
              <span style={{ ...s.badge, color: meta.fg, background: meta.bg }}>{meta.label}</span>
              <span style={s.title}>{u.titulo}</span>
              <span style={s.date}>{formatDateBR(u.publishedAt)}</span>
              {u.url && (
                <a
                  href={u.url} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={s.srcLink} title="Abrir fonte oficial" aria-label="Abrir fonte oficial"
                >
                  <ExternalLink size={13} strokeWidth={2} />
                </a>
              )}
              {expandable && (
                <ChevronDown size={14} color={theme.inkFaint} strokeWidth={2}
                  style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
              )}
            </div>

            {expandable && open && (
              <div style={{ ...s.diffBox, animation: 'focali-slide-down 0.18s ease' }}>
                {(u.changes!.campos ?? []).map((c, i) => (
                  <div key={`c-${i}`} style={s.diffRow}>
                    <span style={s.diffCampo}>{c.campo}</span>
                    <span style={s.diffAntes}>{c.antes}</span>
                    <span style={s.diffArrow}>→</span>
                    <span style={s.diffDepois}>{c.depois}</span>
                  </div>
                ))}
                {(u.changes!.conteudo ?? []).map((c, i) => (
                  <div key={`d-${i}`} style={s.diffDisciplina}>
                    <span style={s.diffCampo}>{c.disciplina}</span>
                    <div style={s.diffChips}>
                      {(c.adicionados ?? []).map((t) => (
                        <span key={`a-${t}`} style={s.chipAdd}>+ {t}</span>
                      ))}
                      {(c.removidos ?? []).map((t) => (
                        <span key={`r-${t}`} style={s.chipDel}>− {t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  itemWrap: { minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  badge: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  title: { flex: 1, fontSize: 13, color: theme.ink, minWidth: 0, lineHeight: 1.4 },
  date: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  srcLink: { display: 'inline-flex', alignItems: 'center', color: theme.teal, flexShrink: 0, padding: 2 },

  diffBox: { margin: '4px 0 2px 10px', padding: '10px 12px', borderLeft: `2px solid ${theme.danger}`, background: theme.card, borderRadius: `0 ${theme.radiusXs}px ${theme.radiusXs}px 0`, display: 'flex', flexDirection: 'column', gap: 8 },
  diffRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  diffCampo: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 },
  diffAntes: { fontSize: 12, color: theme.danger, background: theme.dangerBg, textDecoration: 'line-through', borderRadius: theme.radiusXs, padding: '2px 8px' },
  diffArrow: { fontSize: 12, color: theme.inkFaint, flexShrink: 0 },
  diffDepois: { fontSize: 12, fontWeight: 600, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px' },
  diffDisciplina: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 },
  diffChips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  chipAdd: { fontSize: 12, fontWeight: 600, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px' },
  chipDel: { fontSize: 12, fontWeight: 500, color: theme.danger, background: theme.dangerBg, borderRadius: theme.radiusXs, padding: '2px 8px', textDecoration: 'line-through' },
};
