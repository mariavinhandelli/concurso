// app/(app)/caderno/page.tsx
// Hub Caderno (M8): unifica num só lugar as duas superfícies de escrita que antes
// eram destinos separados e confusos — "Caderno" (notas ricas) e "Cadernos de
// Erros" (log estruturado). Três abas: Tudo (lista unificada + busca), Anotações
// e Erros. Não altera dados: cada aba reusa a UI e os serviços nativos. Os
// atalhos de anotar dentro do Vade Mecum e das Jurisprudências ficam intactos.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useUI } from '@/components/layout/UIContext';
import { AnotacoesView } from '@/components/features/caderno/AnotacoesView';
import { TudoView } from '@/components/features/caderno/TudoView';
import { ErrosView } from '@/components/features/notebook/ErrosView';
import { theme } from '@/lib/theme';

type Tab = 'tudo' | 'anotacoes' | 'erros';

const parseTab = (v: string | null): Tab => (v === 'anotacoes' || v === 'erros' ? v : 'tudo');

const TABS: { value: Tab; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'anotacoes', label: 'Anotações' },
  { value: 'erros', label: 'Erros' },
];

export default function CadernoHubPage() {
  const { isMobile } = useUI();

  // Aba preferida persiste; `override` (deep-link ou clique na aba "Tudo") tem
  // prioridade sem gravar preferência — assim um deep-link não muda o padrão.
  const [tabPref, setTabPref] = usePersistedState<Tab>('caderno:tab', 'tudo', parseTab);
  const [override, setOverride] = useState<Tab | null>(null);
  const [openNotaId, setOpenNotaId] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const tab = override ?? tabPref;

  // Deep-links (client-only): ?nota= abre a nota na aba Anotações; ?erro= abre o
  // erro na aba Erros (usado pela busca global); ?tab= escolhe a aba.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nota = params.get('nota');
    const erro = params.get('erro');
    const tabParam = params.get('tab');
    // Sincroniza a aba a partir da URL uma vez na montagem (sistema externo).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (nota) { setOverride('anotacoes'); setOpenNotaId(nota); }
    else if (erro) { setOverride('erros'); setOpenNoteId(erro); }
    else if (tabParam) { setOverride(parseTab(tabParam)); }
    /* eslint-enable react-hooks/set-state-in-effect */
    if (nota || erro || tabParam) window.history.replaceState(null, '', '/caderno');
  }, []);

  // Clique numa aba: vira preferência e limpa qualquer abertura pendente.
  function irParaAba(t: Tab) {
    setOverride(null);
    setTabPref(t);
    setOpenNotaId(null);
    setOpenNoteId(null);
  }

  // Clique na aba "Tudo": abre o item na aba nativa (sem mudar a preferência).
  function abrirDoTudo(item: { fonte: 'nota' | 'erro'; id: string }) {
    if (item.fonte === 'nota') { setOpenNoteId(null); setOpenNotaId(item.id); setOverride('anotacoes'); }
    else { setOpenNotaId(null); setOpenNoteId(item.id); setOverride('erros'); }
  }

  return (
    <div style={{ ...s.wrap, padding: isMobile ? '16px 12px' : '28px 32px' }}>
      <div style={s.head}>
        <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : 28 }}>Caderno</h1>
        <p style={s.sub}>Tudo que você escreveu — anotações e erros, num lugar só.</p>
      </div>

      <div style={s.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => irParaAba(t.value)}
            style={{ ...s.tab, ...(tab === t.value ? s.tabOn : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tudo' && <TudoView onAbrir={abrirDoTudo} />}
      {tab === 'anotacoes' && <AnotacoesView openNotaId={openNotaId} />}
      {tab === 'erros' && <ErrosView openNoteId={openNoteId} />}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1240, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },
  head: { marginBottom: 14 },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 13.5, color: theme.inkSoft, margin: '4px 0 0' },
  tabs: { display: 'flex', gap: 4, marginBottom: 18, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, width: 'fit-content' },
  tab: { padding: '8px 18px', borderRadius: theme.radiusXs, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' },
  tabOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
};
