'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  listJurisprudencias, deleteJurisprudencia, listDistinct,
  type Jurisprudencia, type JurisFilters,
} from '@/services/jurisprudencias.service';
import { listFavoritas } from '@/services/jurisInteracoes.service';
import { JurisprudenciaCard } from '@/components/features/jurisprudencias/JurisprudenciaCard';
import { JurisFilterBar, EMPTY_FILTERS, type JurisFilterValues } from '@/components/features/jurisprudencias/JurisFilterBar';
import { JurisSidebarWidgets } from '@/components/features/jurisprudencias/JurisSidebarWidgets';
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

  return (
    <>
      {dialog}
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
                <p style={{ fontSize: 13, color: theme.inkFaint, margin: 0 }}>
                  {items.length} {items.length === 1 ? 'resultado' : 'resultados'}
                </p>
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

const styles: Record<string, React.CSSProperties> = {
  backBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  searchInput: { width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', boxShadow: theme.shadow },
};
