'use client';

import { memo, useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { theme } from '@/lib/theme';
import { EstrelasBadge } from './EstrelasBadge';
import { getInteracao, toggleFavorito } from '@/services/jurisInteracoes.service';
import type { Jurisprudencia, JurisIncidencia } from '@/services/jurisprudencias.service';

const INCIDENCIA_LABEL: Record<JurisIncidencia, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', muito_alta: 'Muito Alta',
};
const INCIDENCIA_COLOR: Record<JurisIncidencia, string> = {
  baixa: theme.inkFaint, media: theme.warn, alta: '#f97316', muito_alta: theme.danger,
};
const TIPO_LABEL: Record<string, string> = {
  sumula: 'Súmula', sumula_vinculante: 'Súm. Vinculante', acordao: 'Acórdão', decisao_monocratica: 'Dec. Monocrática',
  informativo: 'Informativo', outro: 'Outro',
};
const STATUS_LABEL: Record<string, string> = {
  cancelada: 'Cancelada', substituida: 'Substituída', revisada: 'Revisada',
};

interface Props {
  item: Jurisprudencia;
  onClick: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  initialFavorito?: boolean;
  reviewOverdueDays?: number;
}

export const JurisprudenciaCard = memo(function JurisprudenciaCard({ item, onClick, onDelete, canDelete, initialFavorito, reviewOverdueDays = 0 }: Props) {
  const [favorito, setFavorito] = useState(initialFavorito ?? false);
  const [loadingFav, setLoadingFav] = useState(false);

  useEffect(() => {
    if (initialFavorito !== undefined) return;
    getInteracao(item.id).then((i) => setFavorito(i?.favorito ?? false)).catch(() => {});
  }, [item.id, initialFavorito]);

  async function handleFavorito(e: React.MouseEvent) {
    e.stopPropagation();
    if (loadingFav) return;
    setLoadingFav(true);
    const novo = !favorito;
    setFavorito(novo); // otimista
    try {
      await toggleFavorito(item.id, novo);
    } catch {
      setFavorito(!novo); // desfaz se falhar
    } finally {
      setLoadingFav(false);
    }
  }

  const comoCai = item.como_banca_cobra || item.tese_banca;

  return (
    <div
      onClick={onClick}
      style={styles.card}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = theme.teal;
        (e.currentTarget as HTMLDivElement).style.boxShadow = theme.shadowHover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = theme.line;
        (e.currentTarget as HTMLDivElement).style.boxShadow = theme.shadow;
      }}
    >
      {/* Topo: tribunal + tipo + status + favorito */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={styles.tribunalBadge}>{item.tribunal}</span>
        <span style={styles.tipoBadge}>
          {item.numero_sumula
            ? `${item.tipo === 'sumula_vinculante' ? 'SV' : 'Súmula'} ${item.numero_sumula}`
            : (TIPO_LABEL[item.tipo] ?? item.tipo)}
        </span>
        {item.status !== 'vigente' && (
          <span style={{ ...styles.tipoBadge, background: theme.dangerTint, color: theme.danger }}>
            {STATUS_LABEL[item.status]}
          </span>
        )}
        {reviewOverdueDays > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: theme.danger, background: theme.dangerTint, borderRadius: 6, padding: '2px 8px' }}>
            ↻ {reviewOverdueDays}d atrasada
          </span>
        )}
        <button
          onClick={handleFavorito}
          aria-label={favorito ? 'Remover dos favoritos' : 'Marcar como favorito'}
          style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 44, minHeight: 44 }}
        >
          <Star size={18} fill={favorito ? '#f59e0b' : 'none'} color={favorito ? '#f59e0b' : theme.inkFaint} strokeWidth={1.7} />
        </button>
      </div>

      {/* Tese */}
      <p style={styles.tese}>{item.tese}</p>

      {/* Resumo (se houver) */}
      {item.resumo && (
        <p style={styles.resumo}>{item.resumo}</p>
      )}

      {/* Como cai */}
      {comoCai && (
        <div style={styles.comoCaiBox}>
          <span style={styles.comoCaiLabel}>Como cai</span>
          <p style={styles.comoCaiText}>{comoCai}</p>
        </div>
      )}

      {/* Disciplina / matéria */}
      <div style={{ fontSize: 13, color: theme.inkSoft }}>
        {item.disciplina}{item.materia ? ` · ${item.materia}` : ''}
        {item.assunto ? ` · ${item.assunto}` : ''}
      </div>

      {/* Rodapé: estrelas + incidência + tags + ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <EstrelasBadge value={item.estrelas} size={13} />
        <span style={{ fontSize: 12, fontWeight: 600, color: INCIDENCIA_COLOR[item.incidencia_concursos] }}>
          ↑ {INCIDENCIA_LABEL[item.incidencia_concursos]}
        </span>
        {item.palavras_chave.slice(0, 2).map((t) => (
          <span key={t} style={styles.tag}>{t}</span>
        ))}
        {item.palavras_chave.length > 2 && (
          <span style={styles.tagMore}>+{item.palavras_chave.length - 2}</span>
        )}
        {canDelete && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={styles.deleteBtn}
            aria-label="Apagar"
          ><X size={13} strokeWidth={2} /></button>
        )}
      </div>
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
    boxShadow: theme.shadow, padding: '16px 18px', cursor: 'pointer',
    transition: 'border-color .15s, box-shadow .15s', fontFamily: theme.font,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  tribunalBadge: { fontSize: 12, fontWeight: 700, color: theme.onTeal, background: theme.teal, borderRadius: 6, padding: '2px 8px' },
  tipoBadge: { fontSize: 12, fontWeight: 500, color: theme.inkSoft, background: 'rgba(15,23,42,.06)', borderRadius: 6, padding: '2px 8px' },
  tese: {
    fontSize: 14, color: theme.ink, margin: 0, lineHeight: 1.55, fontWeight: 500,
    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  resumo: {
    fontSize: 13, color: theme.inkSoft, margin: 0, lineHeight: 1.5,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  comoCaiBox: { background: 'rgba(99,102,241,.06)', borderRadius: theme.radiusXs, padding: '8px 12px' },
  comoCaiLabel: { fontSize: 11, fontWeight: 700, color: theme.clay, textTransform: 'uppercase', letterSpacing: 0.4 },
  comoCaiText: {
    fontSize: 13, color: theme.ink, margin: '3px 0 0', lineHeight: 1.5,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  tag: { fontSize: 11, color: theme.tealDeep, background: theme.tealBg, borderRadius: 6, padding: '2px 7px', fontWeight: 500 },
  tagMore: { fontSize: 11, color: theme.inkFaint, fontWeight: 500 },
  deleteBtn: { marginLeft: 'auto', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', opacity: 0.6, padding: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
