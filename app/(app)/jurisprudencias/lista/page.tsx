'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleHelp, Layers, TriangleAlert, Star } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  listJurisprudencias, deleteJurisprudencia, listDistinct, getJurisprudenciaById,
  JURIS_PAGE_LIMIT,
  type Jurisprudencia, type JurisFilters,
} from '@/services/jurisprudencias.service';
import { listFavoritas, listInteracoesSummaryByIds } from '@/services/jurisInteracoes.service';
import { JurisprudenciaCard } from '@/components/features/jurisprudencias/JurisprudenciaCard';
import { JurisFilterBar, EMPTY_FILTERS, type JurisFilterValues } from '@/components/features/jurisprudencias/JurisFilterBar';
import { JurisSidebarWidgets } from '@/components/features/jurisprudencias/JurisSidebarWidgets';
import { JurisFlashcardPlayer } from '@/components/features/jurisprudencias/JurisFlashcardPlayer';
import { JurisSimulado } from '@/components/features/jurisprudencias/JurisSimulado';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { useUI } from '@/components/layout/UIContext';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/ui/Page';

function ListaSkeleton() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 40px' }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 150, background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, animation: 'skeleton-pulse 1.4s ease-in-out infinite', animationDelay: `${(i - 1) * 0.1}s`, marginBottom: 12 }} />
      ))}
    </div>
  );
}

export default function JurisprudenciasListaPage() {
  return (
    <Suspense fallback={<ListaSkeleton />}>
      <ListaContent />
    </Suspense>
  );
}

function ListaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile, isTablet } = useUI();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const isFavoritasView = searchParams.get('favoritas') === '1';

  const [items, setItems] = useState<Jurisprudencia[]>([]);
  const [favoritosMap, setFavoritosMap] = useState<Record<string, boolean>>({});
  const [overdueMap, setOverdueMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('busca') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('busca') ?? '');
  // Filtros hidratados da URL — F5 e link compartilhado preservam a seleção.
  const [filters, setFilters] = useState<JurisFilterValues>(() => ({
    ...EMPTY_FILTERS,
    tribunal: searchParams.get('tribunal') ?? '',
    tipo: searchParams.get('tipo') ?? '',
    disciplina: searchParams.get('disciplina') ?? '',
    status: searchParams.get('status') ?? '',
    estrelas: searchParams.get('estrelas') ?? '',
    incidencia: searchParams.get('incidencia') ?? '',
    ano: searchParams.get('ano') ?? '',
    sortBy: (searchParams.get('sort') ?? '') as JurisFilterValues['sortBy'],
    completude: (searchParams.get('completude') ?? '') as JurisFilterValues['completude'],
  }));
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showSimulado, setShowSimulado] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isFavoritasView) {
        const loaded = await listFavoritas();
        setItems(loaded);
        // Todos os itens de favoritas têm favorito=true por definição
        const favMap: Record<string, boolean> = {};
        for (const item of loaded) favMap[item.id] = true;
        setFavoritosMap(favMap);
      } else {
        const f: JurisFilters = {};
        if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
        if (filters.tribunal) f.tribunal = filters.tribunal;
        if (filters.tipo) f.tipo = filters.tipo as JurisFilters['tipo'];
        if (filters.disciplina) f.disciplina = filters.disciplina;
        if (filters.status) f.status = filters.status as JurisFilters['status'];
        if (filters.estrelas) f.estrelas = Number(filters.estrelas);
        if (filters.incidencia) f.incidencia = filters.incidencia as JurisFilters['incidencia'];
        if (filters.ano) f.ano = Number(filters.ano);
        if (filters.sortBy) f.sortBy = filters.sortBy as JurisFilters['sortBy'];
        if (filters.completude) f.completude = filters.completude as JurisFilters['completude'];
        const loaded = await listJurisprudencias(f);
        setItems(loaded);
        // Busca favoritos + status de revisão em lote (1 query) em vez de 1 por card
        const summary = await listInteracoesSummaryByIds(loaded.map((i) => i.id));
        const favMap: Record<string, boolean> = {};
        const ovMap: Record<string, number> = {};
        for (const [id, s] of Object.entries(summary)) {
          favMap[id] = s.favorito;
          ovMap[id] = s.overdueDays;
        }
        setFavoritosMap(favMap);
        setOverdueMap(ovMap);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar jurisprudências.');
    } finally {
      setLoading(false);
    }
  }, [isFavoritasView, debouncedSearch, filters, toast]);

  useEffect(() => { load(); }, [load]);

  // Espelha busca + filtros na URL (replaceState: sem re-render nem entrada no histórico).
  useEffect(() => {
    const p = new URLSearchParams();
    if (isFavoritasView) p.set('favoritas', '1');
    if (debouncedSearch.trim()) p.set('busca', debouncedSearch.trim());
    const map: Record<string, string> = {
      tribunal: filters.tribunal, tipo: filters.tipo, disciplina: filters.disciplina,
      status: filters.status, estrelas: filters.estrelas, incidencia: filters.incidencia,
      ano: filters.ano, sort: filters.sortBy, completude: filters.completude,
    };
    for (const [k, v] of Object.entries(map)) if (v) p.set(k, v);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [debouncedSearch, filters, isFavoritasView]);

  // Guarda a ordem da seleção atual para a navegação anterior/próxima no detalhe.
  useEffect(() => {
    try { sessionStorage.setItem('juris:navIds', JSON.stringify(items.map((i) => i.id))); } catch { /* storage cheio/indisponível */ }
  }, [items]);

  useEffect(() => {
    listDistinct('disciplina').then(setDisciplinas).catch(() => {});
  }, []);

  async function handleDelete(id: string) {
    if (!await confirm({ title: 'Apagar esta jurisprudência?', description: 'Ela some do banco para todos os usuários. Esta ação não pode ser desfeita.', confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteJurisprudencia(id);
      toast.success('Jurisprudência apagada.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar.');
    }
  }

  const hasFilters = !!(search || Object.values(filters).some(Boolean));

  // Métricas de cobertura da seleção atual
  const countFlash = items.filter((i) => i.flashcard_frente && i.flashcard_verso).length;
  const countQuestao = items.filter((i) => i.questao_enunciado && i.questao_gabarito !== null).length;

  return (
    <>
      {dialog}
      {showFlashcards && (
        <JurisFlashcardPlayer items={items} onClose={() => setShowFlashcards(false)} />
      )}
      {showSimulado && (
        <JurisSimulado items={items} onClose={() => setShowSimulado(false)} />
      )}

      <PageContainer width="wide" style={{ minWidth: 0 }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <button className="touch-target" onClick={() => router.push('/jurisprudencias')} style={styles.backBtn}>← Jurisprudências</button>
            <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isFavoritasView ? <><Star size={isMobile ? 20 : 24} fill={theme.ink} strokeWidth={1.7} />Favoritas</> : (filters.disciplina || 'Todas as jurisprudências')}
            </h1>
          </div>
          <Button onClick={() => router.push('/jurisprudencias/nova')}>
            + Nova jurisprudência
          </Button>
        </div>

        {!isFavoritasView && (
          <>
            {/* Busca */}
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar na tese, tribunal, disciplina…"
                style={{ ...styles.searchInput, paddingRight: loading ? 44 : 16 }}
              />
              {loading && (
                <span aria-hidden="true" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  <Spinner size={17} color={theme.inkFaint} />
                </span>
              )}
            </div>

            {/* Filtros expansíveis */}
            <div style={{ marginBottom: 16 }}>
              <JurisFilterBar values={filters} onChange={setFilters} disciplinas={disciplinas} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* Lista principal */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 150, background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div style={{ background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}` }}>
                {isFavoritasView ? (
                  <EmptyState
                    icon={<Star size={26} color={theme.teal} strokeWidth={1.8} />}
                    title="Nenhum favorito ainda"
                    body="Clique na estrela em qualquer card para guardar as jurisprudências mais importantes."
                    action={{ label: 'Explorar jurisprudências', onClick: () => router.push('/jurisprudencias/lista') }}
                  />
                ) : (
                  <EmptyState
                    icon={<Star size={26} color={theme.teal} strokeWidth={1.8} />}
                    title={hasFilters ? 'Nenhuma jurisprudência encontrada com esses filtros.' : 'Nenhuma jurisprudência cadastrada ainda.'}
                    action={!hasFilters ? { label: 'Cadastrar primeira jurisprudência', onClick: () => router.push('/jurisprudencias/nova') } : undefined}
                  />
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Barra de resultado + cobertura + ações de estudo */}
                <div style={{
                  background: theme.card, border: `0.5px solid ${theme.line}`,
                  borderRadius: theme.radiusSm, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  {/* Contadores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.ink }}>
                      {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <CoverageChip active={countFlash} total={items.length} label="flashcards" color={theme.teal} bg={theme.tealBg} />
                      <CoverageChip active={countQuestao} total={items.length} label="questões" color={theme.clay} bg={theme.clayBg} />
                    </div>
                  </div>

                  <div style={{ flex: 1 }} />

                  {/* Botões de modo de estudo */}
                  {countFlash > 0 && (
                    <button onClick={() => setShowFlashcards(true)} style={styles.studyBtn}>
                      <Layers size={13} strokeWidth={1.7} style={{ marginRight: 6 }} />
                      Flashcards ({countFlash})
                    </button>
                  )}
                  {countQuestao > 0 && (
                    <button onClick={() => setShowSimulado(true)} style={styles.simuladoBtn}>
                      <CircleHelp size={13} strokeWidth={1.7} style={{ marginRight: 6 }} />
                      Simular ({countQuestao})
                    </button>
                  )}
                </div>

                {items.map((item) => (
                  <JurisprudenciaCard
                    key={item.id}
                    item={item}
                    onClick={() => router.push(`/jurisprudencias/${item.id}`)}
                    onDelete={() => handleDelete(item.id)}
                    canDelete={userId === item.created_by && !getJurisprudenciaById(item.id)}
                    initialFavorito={favoritosMap[item.id] ?? false}
                    reviewOverdueDays={overdueMap[item.id] ?? 0}
                  />
                ))}

                {items.length >= JURIS_PAGE_LIMIT && (
                  <div style={{
                    padding: '14px 18px', borderRadius: theme.radiusSm,
                    background: theme.warnBg, border: `1px solid ${theme.warn}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <TriangleAlert size={16} color={theme.warn} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: theme.warn, fontWeight: 500 }}>
                      Mostrando apenas os primeiros {JURIS_PAGE_LIMIT} resultados. Use filtros para refinar a busca e ver mais itens.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar de widgets — no mobile vem DEPOIS da lista (resultado primeiro) */}
          <div style={{ width: isMobile ? '100%' : isTablet ? 220 : 260, flexShrink: 0 }}>
            <JurisSidebarWidgets />
          </div>
        </div>

      </PageContainer>
    </>
  );
}

function CoverageChip({ active, total, label, color, bg }: {
  active: number; total: number; label: string; color: string; bg: string;
}) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
      <span style={{
        display: 'inline-block', width: 28, height: 5, borderRadius: 3,
        background: `linear-gradient(to right, ${color} ${pct}%, ${bg} ${pct}%)`,
      }} />
      <span style={{ color, fontWeight: 700 }}>{active}</span>
      <span style={{ color: '#9ca3af' }}>/ {total} {label}</span>
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', boxShadow: theme.shadow },
  studyBtn: {
    display: 'flex', alignItems: 'center',
    padding: '8px 14px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.teal}`, background: theme.tealBg,
    color: theme.tealDeep, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  simuladoBtn: {
    display: 'flex', alignItems: 'center',
    padding: '8px 14px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.clay}`, background: theme.clayBg,
    color: theme.clayDeep, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
};
