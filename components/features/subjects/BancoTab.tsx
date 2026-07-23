'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import {
  getCatalogAreas, getCatalogSubjects, activateSubject, getCatalogTopics,
  type CatalogArea, type CatalogSubject, type CatalogTopic,
} from '@/services/catalog.service';
import { SubjectTopicsModal } from './SubjectTopicsModal';
import { theme } from '@/lib/theme';

interface Props {
  isMobile: boolean;
  onError: (m: string) => void;
  onActivated: () => void;
}

export function BancoTab({ isMobile, onError, onActivated }: Props) {
  const [areas, setAreas] = useState<CatalogArea[]>([]);
  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string>('todas');
  const [query, setQuery] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogSubject | null>(null);
  const [modalTopics, setModalTopics] = useState<CatalogTopic[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  async function openModal(s: CatalogSubject) {
    setSelected(s);
    setModalTopics([]);
    setLoadingModal(true);
    try {
      const topics = await getCatalogTopics(s.id);
      setModalTopics(topics);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao carregar tópicos da matéria.');
    } finally {
      setLoadingModal(false);
    }
  }

  function closeModal() { setSelected(null); setModalTopics([]); }

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([getCatalogAreas(), getCatalogSubjects()]);
      setAreas(a);
      setSubjects(s);
      setLoadError(false);
    } catch (e) {
      // Erro ≠ vazio: sem isso a falha de rede aparecia como catálogo vazio.
      setLoadError(true);
      onError(e instanceof Error ? e.message : 'Erro ao carregar o banco.');
    } finally {
      setLoading(false);
    }
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  async function handleActivate(cat: CatalogSubject) {
    setActivatingId(cat.id);
    try {
      await activateSubject(cat.id);
      setSubjects((prev) => prev.map((s) => (s.id === cat.id ? { ...s, is_activated: true } : s)));
      onActivated();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao ativar.');
    } finally {
      setActivatingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      const okArea = areaFilter === 'todas' || s.area_slugs.includes(areaFilter);
      const okQuery = q === '' || s.name.toLowerCase().includes(q);
      return okArea && okQuery;
    });
  }, [subjects, areaFilter, query]);

  const groups = useMemo(() => {
    const visibleAreas = areaFilter === 'todas'
      ? areas
      : areas.filter((a) => a.slug === areaFilter);

    return visibleAreas
      .map((area) => ({
        area,
        items: filtered.filter((s) => s.area_slugs.includes(area.slug)),
      }))
      .filter((g) => g.items.length > 0);
  }, [areas, filtered, areaFilter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 72, borderRadius: 14, background: theme.muted, animation: 'skeleton-pulse 1.4s ease infinite', animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  if (loadError && subjects.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <p style={styles.muted}>Não foi possível carregar o banco de matérias. Verifique a conexão.</p>
        <button
          onClick={() => { setLoading(true); load(); }}
          style={{ ...styles.activateBtn }}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Busca */}
      <div style={styles.searchBox}>
        <Search size={16} color={theme.inkFaint} strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar matéria…"
          aria-label="Buscar matéria no banco"
          style={styles.searchInput}
        />
      </div>

      {/* Filtro por área */}
      <div style={styles.pills}>
        <button
          onClick={() => setAreaFilter('todas')}
          style={{ ...styles.pill, ...(areaFilter === 'todas' ? styles.pillActive : {}) }}
        >
          Todas
        </button>
        {areas.map((a) => (
          <button
            key={a.slug}
            onClick={() => setAreaFilter(a.slug)}
            style={{ ...styles.pill, ...(areaFilter === a.slug ? styles.pillActive : {}) }}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* Modal de tópicos */}
      {selected && (
        <SubjectTopicsModal
          subject={selected}
          topics={modalTopics}
          loading={loadingModal}
          activating={activatingId === selected.id}
          onActivate={() => handleActivate(selected)}
          onClose={closeModal}
        />
      )}

      {groups.length === 0 ? (
        <p style={styles.muted}>Nenhuma matéria encontrada.</p>
      ) : (
        groups.map(({ area, items }) => (
          <div key={area.slug} style={{ marginBottom: 22 }}>
            <div style={styles.groupLabel}>{area.name}</div>
            <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {items.map((s) => (
                <div
                  key={s.id}
                  className="subject-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver tópicos de ${s.name}`}
                  style={{ ...styles.catCard, cursor: 'pointer' }}
                  onClick={() => openModal(s)}
                  onKeyDown={(e) => {
                    // Card era só clicável com mouse — teclado não abria o modal de tópicos.
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(s); }
                  }}
                  onMouseEnter={() => { void getCatalogTopics(s.id); }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="cat-name-clamp" style={styles.catName} title={s.name}>{s.name}</div>
                    <div style={styles.catMeta}>
                      {s.parent_count} tópicos · {s.topic_count - s.parent_count} subtópicos
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {s.is_activated ? (
                      <span style={styles.activeBadge}>
                        <Check size={13} strokeWidth={2.5} />
                        Ativa
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivate(s)}
                        disabled={activatingId === s.id}
                        style={{ ...styles.activateBtn, opacity: activatingId === s.id ? 0.6 : 1 }}
                      >
                        {activatingId === s.id ? 'Ativando…' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  muted: { color: theme.inkFaint, fontSize: 14 },

  searchBox: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
    border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm,
    background: theme.card, padding: '9px 12px',
  },
  searchInput: { flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: theme.ink, fontFamily: 'inherit' },

  pills: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 },
  pill: {
    fontSize: 13, padding: '6px 13px', borderRadius: theme.radiusPill, cursor: 'pointer', fontFamily: 'inherit',
    border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontWeight: 500,
  },
  pillActive: {
    background: theme.tealBg, color: theme.teal,
    border: `1px solid ${theme.teal}`, fontWeight: 600,
  },

  groupLabel: {
    fontSize: 11, color: theme.inkFaint, fontWeight: 700, marginBottom: 10,
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  },
  grid: { display: 'grid', gap: 16 },

  catCard: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 14,
    padding: '14px 16px', minWidth: 0, minHeight: 72,
  },
  catName: { fontSize: 15, fontWeight: 600, color: theme.ink },
  catMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 4 },
  activateBtn: {
    fontSize: 13, padding: '6px 14px', borderRadius: theme.radiusPill, border: 'none',
    background: theme.primary, color: theme.onTeal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  },
  activeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, padding: '6px 12px',
    borderRadius: theme.radiusPill, background: theme.okBg, color: theme.ok, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
  },
};
