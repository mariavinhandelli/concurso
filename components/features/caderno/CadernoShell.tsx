// components/features/caderno/CadernoShell.tsx
// Shell de layout único das abas do hub Caderno: [rail de navegação ~208px |
// lista ~320px | detalhe flex], viewport-fit com scroll por painel (nunca a
// página inteira). Antes cada aba tinha a própria estrutura — Erros era 2
// colunas com a lista espremida na sidebar e a página rolando em dobro.
// Tablet: rail vira linha horizontal de pills no topo (208+320 fixos deixariam
// o detalhe com ~80px em 768px). Mobile: rail + lista empilhados; `detalhe`
// substitui tudo quando `mobileDetalhe` está ativo.
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useUI } from '@/components/layout/UIContext';

export function CadernoShell({
  rail, lista, detalhe, mobileDetalhe,
}: {
  rail: ReactNode;
  lista: ReactNode;
  detalhe: ReactNode;
  /** Mobile: true mostra só o painel de detalhe (item aberto) no lugar de rail+lista. */
  mobileDetalhe?: boolean;
}) {
  const { isMobile, isTablet } = useUI();

  if (isMobile) {
    return mobileDetalhe ? (
      <div style={{ minWidth: 0 }}>{detalhe}</div>
    ) : (
      <>
        <div style={s.railMobile}>{rail}</div>
        <div style={{ minWidth: 0 }}>{lista}</div>
      </>
    );
  }

  if (isTablet) {
    return (
      <div style={s.gridTablet}>
        <div style={s.railTablet}>{rail}</div>
        <div style={s.painelLista}>{lista}</div>
        <div style={s.painelDetalhe}>{detalhe}</div>
      </div>
    );
  }

  return (
    <div style={s.grid}>
      <div style={s.painelRail}>{rail}</div>
      <div style={s.painelLista}>{lista}</div>
      <div style={s.painelDetalhe}>{detalhe}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  grid: {
    display: 'grid', gridTemplateColumns: '208px 320px minmax(0, 1fr)',
    // minmax(0,1fr) na linha: sem isso, conteúdo alto (editor com imagens) força
    // a linha implícita além do container e a página volta a rolar em dobro.
    gridTemplateRows: 'minmax(0, 1fr)', gap: 14,
    height: 'calc(100vh - 258px)', minHeight: 460,
  },
  gridTablet: {
    // 240px: com a sidebar do app expandida a 768px sobram ~429px de conteúdo —
    // lista mais larga deixaria o detalhe espremido demais.
    display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)',
    gridTemplateRows: 'auto minmax(0, 1fr)', gap: 14,
    height: 'calc(100vh - 258px)', minHeight: 460,
  },
  railTablet: { gridColumn: '1 / -1', display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, minWidth: 0 },
  railMobile: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 6 },
  painelRail: { display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', paddingRight: 2, minHeight: 0 },
  painelLista: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 2, minWidth: 0, minHeight: 0 },
  painelDetalhe: { overflowY: 'auto', paddingRight: 4, minWidth: 0, minHeight: 0 },
};
