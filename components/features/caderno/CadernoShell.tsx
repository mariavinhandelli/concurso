// components/features/caderno/CadernoShell.tsx
// Shell de layout único das abas do hub Caderno, igual em TODAS as larguras
// (aprovado 01/08): rail de pills no topo + lista em coluna única (~560px),
// alinhada à ESQUERDA junto do título "Caderno" — não centralizada dentro do
// PageContainer "wide" (1080px), o que a fazia flutuar longe do cabeçalho no
// desktop. Scroll natural da página; nada de painel de detalhe lateral — com
// um item aberto (`detalheAberto`), o detalhe substitui rail+lista em largura
// de leitura com "← Voltar". Antes era grid de 3 painéis viewport-fit no
// desktop/tablet, com a lista espremida e o painel vazio dominando a tela.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { theme } from '@/lib/theme';

export function CadernoShell({
  rail, lista, detalhe, detalheAberto, onVoltar, voltarLabel = 'Voltar',
}: {
  rail: ReactNode;
  lista: ReactNode;
  detalhe: ReactNode;
  /** Item aberto: o detalhe substitui rail+lista (todas as larguras). */
  detalheAberto?: boolean;
  /** Fecha o detalhe e volta à lista. Sem ele o "← Voltar" não aparece. */
  onVoltar?: () => void;
  voltarLabel?: string;
}) {
  if (detalheAberto) {
    return (
      <div style={s.detalheWrap}>
        {onVoltar && (
          <button className="touch-target" onClick={onVoltar} style={s.voltar}>
            ← {voltarLabel}
          </button>
        )}
        {detalhe}
      </div>
    );
  }

  // Rail dentro da mesma coluna de 560px da lista: filtros e cards alinhados
  // num bloco só (na largura toda as pills pareciam soltas na página).
  return (
    <div style={s.coluna}>
      <div className="caderno-rail">{rail}</div>
      <div style={s.listaWrap}>{lista}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  coluna: { maxWidth: 560, minWidth: 0 },
  listaWrap: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  detalheWrap: { maxWidth: 720, minWidth: 0 },
  voltar: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', marginBottom: 14, display: 'block' },
};
