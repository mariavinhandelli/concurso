'use client';

// Histórico do concurso: estatísticas por ano (inscritos, vagas, nota de
// corte, nomeados) e provas anteriores com links oficiais. Só renderiza o
// que foi curado com dado real — sem edital vigente, a última prova vira o
// call-to-action principal ("resolver a última prova aplicada").

import { type CSSProperties } from 'react';
import { FileDown, ExternalLink } from 'lucide-react';
import { type ConcursoStat, type PastPaper, type EditalSituacao } from '@/services/editaisCatalog.service';
import { track, EV } from '@/lib/analytics';
import { theme } from '@/lib/theme';

function fmt(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('pt-BR');
}

export function ConcursoStatsTable({ stats }: { stats: ConcursoStat[] }) {
  return (
    <div className="table-scroll" style={{ marginTop: 12 }}>
      <table style={s.table}>
        <caption style={s.srOnly}>Histórico do concurso por ano: vagas, inscritos, nota de corte e nomeados</caption>
        <thead>
          <tr>
            <th scope="col" style={s.th}>Ano</th>
            <th scope="col" style={s.th}>Vagas</th>
            <th scope="col" style={s.th}>Inscritos</th>
            <th scope="col" style={s.th}>Nota de corte</th>
            <th scope="col" style={s.th}>Nomeados</th>
            <th scope="col" style={s.th} aria-label="Fonte" />
          </tr>
        </thead>
        <tbody>
          {stats.map((st) => (
            <tr key={st.ano}>
              <td style={{ ...s.td, fontWeight: 700 }}>{st.ano}</td>
              <td style={s.td}>{fmt(st.vagas)}</td>
              <td style={s.td}>{fmt(st.inscritos)}</td>
              <td style={s.td}>{st.notaCorte == null ? '—' : st.notaCorte.toLocaleString('pt-BR')}</td>
              <td style={s.td}>{fmt(st.nomeados)}</td>
              <td style={s.td}>
                {st.fonteUrl && (
                  <a href={st.fonteUrl} target="_blank" rel="noopener noreferrer" style={s.fonteLink} title="Abrir fonte oficial" aria-label={`Fonte oficial ${st.ano}`}>
                    <ExternalLink size={13} strokeWidth={2} />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PastPapersProps {
  papers: PastPaper[];
  situacao: EditalSituacao;
  editalSlug: string;
}

export function PastPapersList({ papers, situacao, editalSlug }: PastPapersProps) {
  const ultima = papers[0];
  const destaqueUltima = situacao !== 'vigente' && Boolean(ultima);

  function handleOpen(p: PastPaper) {
    track(EV.pastPaperOpened, { slug: editalSlug, ano: p.ano });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
      {destaqueUltima && (
        <div style={s.ctaCard}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={s.ctaTitle}>Sem edital vigente? Resolva a última prova.</p>
            <p style={s.ctaHint}>
              A prova de {ultima.ano}{ultima.banca ? ` (${ultima.banca})` : ''} é o melhor termômetro do que a banca cobra.
            </p>
          </div>
          <a
            href={ultima.provaUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => handleOpen(ultima)}
            style={s.ctaBtn}
          >
            <FileDown size={15} strokeWidth={2} style={{ marginRight: 6 }} />
            Abrir prova {ultima.ano}
          </a>
        </div>
      )}

      {papers.map((p) => (
        <div key={p.id} style={s.paperRow}>
          <span style={s.paperLabel}>
            Prova {p.ano}{p.banca ? ` · ${p.banca}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <a href={p.provaUrl} target="_blank" rel="noopener noreferrer" onClick={() => handleOpen(p)} style={s.paperLink}>
              <FileDown size={13} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -2 }} />Prova
            </a>
            {p.gabaritoUrl && (
              <a href={p.gabaritoUrl} target="_blank" rel="noopener noreferrer" style={s.paperLink}>
                <FileDown size={13} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -2 }} />Gabarito
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 10px', borderBottom: `0.5px solid ${theme.line}`, whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: `0.5px solid ${theme.line}`, color: theme.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  fonteLink: { display: 'inline-flex', alignItems: 'center', color: theme.teal, padding: 2 },

  ctaCard: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 16px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg },
  ctaTitle: { fontSize: 14, fontWeight: 700, color: theme.ink, margin: 0 },
  ctaHint: { fontSize: 12, color: theme.inkSoft, margin: '3px 0 0', lineHeight: 1.5 },
  ctaBtn: { display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: theme.radiusSm, background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },

  paperRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  paperLabel: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  paperLink: { fontSize: 13, fontWeight: 600, color: theme.teal, textDecoration: 'none', whiteSpace: 'nowrap' },
  // Caption só para leitores de tela (padrão visually-hidden).
  srOnly: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 },
};
