'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  listJurisprudencias, deleteJurisprudencia, listDistinct,
  JURIS_PAGE_LIMIT,
  type Jurisprudencia, type JurisFilters,
} from '@/services/jurisprudencias.service';
import { listFavoritas } from '@/services/jurisInteracoes.service';
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

export default function JurisprudenciasListaPage() {
  return (
    <Suspense fallback={null}>
      <ListaContent />
    </Suspense>
  );
}

function ListaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile } = useUI();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const isFavoritasView = searchParams.get('favoritas') === '1';

  const [items, setItems] = useState<Jurisprudencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('busca') ?? '');
  const [filters, setFilters] = useState<JurisFilterValues>({
    ...EMPTY_FILTERS,
    disciplina: searchParams.get('disciplina') ?? '',
  });
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showSimulado, setShowSimulado] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isFavoritasView) {
        setItems(await listFavoritas());
      } else {
        const f: JurisFilters = {};
        if (search.trim()) f.search = search.trim();
        if (filters.tribunal) f.tribunal = filters.tribunal;
        if (filters.tipo) f.tipo = filters.tipo as JurisFilters['tipo'];
        if (filters.disciplina) f.disciplina = filters.disciplina;
        if (filters.status) f.status = filters.status as JurisFilters['status'];
        if (filters.estrelas) f.estrelas = Number(filters.estrelas);
        if (filters.incidencia) f.incidencia = filters.incidencia as JurisFilters['incidencia'];
        if (filters.ano) f.ano = Number(filters.ano);
        if (filters.sortBy) f.sortBy = filters.sortBy as JurisFilters['sortBy'];
        if (filters.completude) f.completude = filters.completude as JurisFilters['completude'];
        setItems(await listJurisprudencias(f));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar jurisprudências.');
    } finally {
      setLoading(false);
    }
  }, [isFavoritasView, search, filters, toast]);

  useEffect(() => { load(); }, [load]);

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

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '20px 16px' : '34px 40px', fontFamily: theme.font, minWidth: 0 }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <button onClick={() => router.push('/jurisprudencias')} style={styles.backBtn}>← Jurisprudências</button>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: '8px 0 0' }}>
              {isFavoritasView ? '★ Favoritas' : (filters.disciplina || 'Todas as jurisprudências')}
            </h1>
          </div>
          <button onClick={() => router.push('/jurisprudencias/nova')} style={styles.addBtn}>
            + Nova jurisprudência
          </button>
        </div>

        {!isFavoritasView && (
          <>
            {/* Busca */}
            <div style={{ marginBottom: 12 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar na tese, tribunal, disciplina…"
                style={styles.searchInput}
              />
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
              <div style={{ textAlign: 'center', padding: '60px 20px', background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}` }}>
                <p style={{ fontSize: 15, color: theme.inkSoft, margin: '0 0 16px' }}>
                  {isFavoritasView
                    ? 'Você ainda não favoritou nenhuma jurisprudência.'
                    : hasFilters ? 'Nenhuma jurisprudência encontrada com esses filtros.' : 'Nenhuma jurisprudência cadastrada ainda.'}
                </p>
                {!isFavoritasView && !hasFilters && (
                  <button onClick={() => router.push('/jurisprudencias/nova')} style={styles.addBtn}>
                    Cadastrar primeira jurisprudência
                  </button>
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
                      {items.length >= JURIS_PAGE_LIMIT && (
                        <span style={{ marginLeft: 8, fontWeight: 400, color: theme.warn }}>(limite — refine)</span>
                      )}
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
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                        <path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" />
                      </svg>
                      Flashcards ({countFlash})
                    </button>
                  )}
                  {countQuestao > 0 && (
                    <button onClick={() => setShowSimulado(true)} style={styles.simuladoBtn}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
                      </svg>
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
                    canDelete={userId === item.created_by}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar de widgets */}
          {!isMobile && (
            <div style={{ width: 260, flexShrink: 0 }}>
              <JurisSidebarWidgets />
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ marginTop: 24 }}>
            <JurisSidebarWidgets />
          </div>
        )}
      </div>
    </>
  );
}

function CoverageChip({ active, total, label, color, bg }: {
  active: number; total: number; label: string; color: string; bg: string;
}) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
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
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
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
