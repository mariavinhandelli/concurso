// app/(app)/caderno/page.tsx
// Hub Caderno (M8): unifica num só lugar as duas superfícies de escrita que antes
// eram destinos separados e confusos — "Caderno" (notas ricas) e "Cadernos de
// Erros" (log estruturado). Três abas: Tudo (lista unificada + busca), Anotações
// e Erros. Não altera dados: cada aba reusa a UI e os serviços nativos. Os
// atalhos de anotar dentro do Vade Mecum e das Jurisprudências ficam intactos.
'use client';

import { useEffect, useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { AnotacoesView } from '@/components/features/caderno/AnotacoesView';
import { TudoView } from '@/components/features/caderno/TudoView';
import { ErrosView } from '@/components/features/notebook/ErrosView';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Tab = 'tudo' | 'anotacoes' | 'erros';

const parseTab = (v: string | null): Tab => (v === 'anotacoes' || v === 'erros' ? v : 'tudo');

const TABS: { value: Tab; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'anotacoes', label: 'Anotações' },
  { value: 'erros', label: 'Erros' },
];

export default function CadernoHubPage() {

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
    <PageContainer width="wide">
      <PageHeader title="Caderno" subtitle="Tudo que você escreveu — anotações e erros, num lugar só." />

      <div style={{ marginBottom: 18 }}>
        <SegmentedControl options={TABS} value={tab} onChange={irParaAba} equalWidth={false} />
      </div>

      {tab === 'tudo' && <TudoView onAbrir={abrirDoTudo} />}
      {tab === 'anotacoes' && <AnotacoesView openNotaId={openNotaId} />}
      {tab === 'erros' && <ErrosView openNoteId={openNoteId} />}
    </PageContainer>
  );
}

