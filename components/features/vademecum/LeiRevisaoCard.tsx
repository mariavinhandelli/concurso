// components/features/vademecum/LeiRevisaoCard.tsx
// Cartão de revisão de um artigo de lei: texto com lacunas de memória (clique
// para revelar) + avaliação de 4 níveis. Usado pela fila avulsa de lei seca
// (vademecum/revisar) e pela fila única (app/(app)/revisar) — mesma mecânica,
// um só lugar para corrigir/evoluir.
'use client';

import type { CSSProperties } from 'react';
import { theme } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';
import { SUBLINHADO_COR, segmentarBloco, grifoVisual } from '@/lib/lei-grifos';
import { fromJurisDbRow, type JurisRating } from '@/lib/juris-review';
import { RatingRow4 } from '@/components/features/reviews/RatingRow4';
import type { LeiArtigo } from '@/services/leis.service';
import type { LeiInteracao } from '@/services/leiInteracoes.service';

export function LeiRevisaoCard({
  leiNomeCurto, artigo, interacao, reveladas, onRevelar, onRevelarTudo, onRate, disabled,
}: {
  leiNomeCurto: string;
  artigo: LeiArtigo;
  interacao: LeiInteracao;
  reveladas: Set<string>;
  onRevelar: (grifoId: string) => void;
  onRevelarTudo: () => void;
  onRate: (r: JurisRating) => void;
  disabled?: boolean;
}) {
  const grifos = interacao.grifos ?? [];
  const temLacunas = grifos.length > 0;

  return (
    <div style={s.card}>
      <div style={s.head}>
        <Badge variant="brand">{leiNomeCurto}</Badge>
        <span style={s.rotulo}>{artigo.rotulo}</span>
        {artigo.caminho && <span style={s.caminho}>{artigo.caminho}</span>}
      </div>

      {temLacunas && (
        <p style={s.hint}>
          Complete as lacunas de memória — clique para revelar.
          <button onClick={onRevelarTudo} style={s.revelarTudo}>revelar tudo</button>
        </p>
      )}

      <div style={s.texto}>
        {artigo.blocos.map((b) => (
          <p key={b.id} style={{ ...s.bloco, paddingLeft: b.nivel * 20 }}>
            {b.rotulo && <span style={s.blocoRotulo}>{b.rotulo} </span>}
            {segmentarBloco(b.texto, grifos, b.id).map((seg, i) => {
              if (!seg.grifo) return <span key={i}>{seg.texto}</span>;
              const aberta = reveladas.has(seg.grifo.id);
              if (!aberta) {
                // Botão (não span): focável por teclado e com largura fixa —
                // largura proporcional vazaria o tamanho da resposta.
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onRevelar(seg.grifo!.id)}
                    title="Revelar trecho oculto"
                    aria-label="Revelar trecho oculto"
                    style={s.lacuna}
                  />
                );
              }
              const estilo: CSSProperties = seg.grifo.estilo === 'sublinhado'
                ? { borderBottom: `2px solid ${SUBLINHADO_COR}` }
                : { background: grifoVisual(seg.grifo).bg, borderRadius: 3 };
              return <span key={i} style={estilo}>{seg.texto}</span>;
            })}
          </p>
        ))}
      </div>

      <RatingRow4 state={fromJurisDbRow(interacao)} onRate={onRate} disabled={disabled} />
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 },
  head: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rotulo: { fontSize: 16, fontWeight: 700, color: theme.ink },
  caminho: { fontSize: 12, color: theme.inkFaint, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  hint: { fontSize: 13, color: theme.inkSoft, margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  revelarTudo: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  texto: { fontSize: 15, lineHeight: 1.9, color: theme.ink },
  bloco: { margin: '0 0 8px' },
  blocoRotulo: { fontWeight: 600, color: theme.inkSoft },
  lacuna: { display: 'inline-block', width: 72, height: '1.05em', verticalAlign: 'text-bottom', background: theme.muted, borderRadius: 4, cursor: 'pointer', border: 'none', borderBottom: `1.5px dashed ${theme.inkFaint}`, padding: 0 },
};
