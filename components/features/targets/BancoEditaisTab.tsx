'use client';

// Banco de editais organizado por ÓRGÃO: cada órgão (PM-GO, PC-GO, TJ-GO…)
// agrupa os editais dos seus cargos. Busca textual e filtros avançados
// (área, banca, UF, escolaridade, situação) cortam transversalmente os
// grupos. Clique num cargo abre /editais/[slug]; o header do grupo abre a
// página do órgão (/editais/orgao/[slug]).

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePersistedState } from '@/hooks/usePersistedState';
import { ChevronDown, ChevronRight, Funnel, Landmark, Search } from 'lucide-react';
import {
  listCatalogEditais, listOrgaos, SITUACAO_ORDER,
  type CatalogEdital, type OrgaoCatalog,
} from '@/services/editaisCatalog.service';
import { EditalCard } from '@/components/features/editais/EditalCard';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';

// Remove acentos e caixa para casar "tecnico" com "Técnico".
function norm(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

interface FilterValues {
  banca: string;
  uf: string;
  nivel: string;
  situacao: string;
}

const EMPTY_FILTERS: FilterValues = { banca: '', uf: '', nivel: '', situacao: '' };

// Grupos abertos persistem como CSV ("pc-go|tj-go") — SSR-safe via usePersistedState.
const parseExpandedGroups = (v: string | null): string => v ?? '';

interface Props {
  onImportar: () => void;
  onImportarPdf: () => void;
}

export function BancoEditaisTab({ onImportar, onImportarPdf }: Props) {
  const [area, setArea] = useState<string>('todas');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Grupos de órgão são recolhidos por padrão e o estado aberto/fechado
  // PERSISTE entre visitas; busca/filtro ativos forçam tudo aberto (senão o
  // resultado ficaria escondido atrás dos acordeões).
  const [expandedRaw, setExpandedRaw] = usePersistedState<string>('editais_grupos_abertos', '', parseExpandedGroups);
  const expanded = useMemo(() => new Set(expandedRaw.split('|').filter(Boolean)), [expandedRaw]);

  const { data: editais, isLoading, isError } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
  });
  const { data: orgaos } = useQuery<OrgaoCatalog[]>({
    queryKey: ['orgaos'],
    queryFn: listOrgaos,
    staleTime: 60_000,
  });

  const orgaoBySlug = useMemo(() => {
    const m = new Map<string, OrgaoCatalog>();
    for (const o of orgaos ?? []) m.set(o.slug, o);
    return m;
  }, [orgaos]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const e of editais ?? []) set.add(e.areaName ?? 'Outros');
    return [...set];
  }, [editais]);

  const options = useMemo(() => {
    const bancas = new Set<string>();
    const ufs = new Set<string>();
    const niveis = new Set<string>();
    for (const e of editais ?? []) {
      if (e.banca) bancas.add(e.banca);
      if (e.uf) ufs.add(e.uf);
      if (e.nivel) niveis.add(e.nivel);
    }
    return {
      bancas: [...bancas].sort(),
      ufs: [...ufs].sort(),
      niveis: [...niveis].sort(),
    };
  }, [editais]);

  const activeCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return (editais ?? []).filter((e) => {
      if (area !== 'todas' && (e.areaName ?? 'Outros') !== area) return false;
      if (filters.banca && e.banca !== filters.banca) return false;
      if (filters.uf && e.uf !== filters.uf) return false;
      if (filters.nivel && e.nivel !== filters.nivel) return false;
      if (filters.situacao && e.situacao !== filters.situacao) return false;
      if (nq) {
        const hay = norm([e.orgao, e.cargo, e.banca ?? ''].join(' '));
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
  }, [editais, area, q, filters]);

  // Agrupa por órgão (fallback: texto do órgão, para editais sem vínculo).
  // Grupos ordenados pela melhor situação interna (vigente primeiro).
  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; sigla: string; orgaoSlug: string | null; editais: CatalogEdital[] }>();
    for (const e of filtered) {
      const key = e.orgaoSlug ?? `txt:${e.orgao}`;
      const g = map.get(key);
      if (g) g.editais.push(e);
      else map.set(key, { key, sigla: e.orgao, orgaoSlug: e.orgaoSlug, editais: [e] });
    }
    return [...map.values()].sort((a, b) => {
      const sa = Math.min(...a.editais.map((e) => SITUACAO_ORDER[e.situacao]));
      const sb = Math.min(...b.editais.map((e) => SITUACAO_ORDER[e.situacao]));
      return sa - sb || a.sigla.localeCompare(b.sigla);
    });
  }, [filtered]);

  function set<K extends keyof FilterValues>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const forceOpen = q.trim() !== '' || activeCount > 0 || area !== 'todas';

  function toggleGroup(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedRaw([...next].join('|'));
  }

  if (isLoading) {
    return (
      <div style={s.list}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={84} borderRadius={theme.radiusSm} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p style={s.muted}>Não foi possível carregar o banco de editais. Tente de novo.</p>;
  }

  if ((editais?.length ?? 0) === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyTitle}>Banco de editais em construção</p>
        <p style={s.emptyHint}>Em breve, concursos prontos aqui. Por ora, crie seu concurso manualmente, importe um PDF ou cole o edital.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="outline" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onImportarPdf}>Importar edital em PDF →</Button>
          <Button variant="outline" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={onImportar}>Importar edital colado →</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Busca textual — órgão, cargo ou banca */}
      <div style={{ marginBottom: 10 }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por órgão, cargo ou banca…"
          icon={<Search size={15} color={theme.inkFaint} strokeWidth={2} />}
          aria-label="Buscar editais"
        />
      </div>

      {/* Filtros avançados — mesmo padrão colapsível das jurisprudências.
          Toggle e "Limpar" são botões IRMÃOS (interativo dentro de interativo
          é HTML inválido e confunde teclado/leitor de tela). */}
      <div style={s.filterCard}>
        <div style={s.filterHead}>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            style={s.filterToggle}
          >
            <Funnel size={15} color={theme.inkSoft} strokeWidth={1.7} />
            <span style={s.filterTitle}>Filtros</span>
            {activeCount > 0 && <Badge variant="brand" tone="solid">{activeCount}</Badge>}
            <ChevronDown size={14} color={theme.inkFaint} strokeWidth={1.7}
              style={{ marginLeft: 'auto', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {activeCount > 0 && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} style={s.clearBtn}>Limpar</button>
          )}
        </div>

        {filtersOpen && (
          <div style={s.filterBody}>
            <div style={s.filterGrid}>
              <div>
                <label style={s.filterLabel}>Banca</label>
                <Select value={filters.banca} onChange={(e) => set('banca', e.target.value)}>
                  <option value="">Todas</option>
                  {options.bancas.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </div>
              <div>
                <label style={s.filterLabel}>Estado (UF)</label>
                <Select value={filters.uf} onChange={(e) => set('uf', e.target.value)}>
                  <option value="">Todos</option>
                  {options.ufs.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </div>
              <div>
                <label style={s.filterLabel}>Escolaridade</label>
                <Select value={filters.nivel} onChange={(e) => set('nivel', e.target.value)}>
                  <option value="">Todas</option>
                  {options.niveis.map((n) => <option key={n} value={n}>Nível {n}</option>)}
                </Select>
              </div>
              <div>
                <label style={s.filterLabel}>Situação</label>
                <Select value={filters.situacao} onChange={(e) => set('situacao', e.target.value)}>
                  <option value="">Todas</option>
                  <option value="vigente">Edital vigente</option>
                  <option value="em_expectativa">Em expectativa</option>
                  <option value="encerrado">Encerrado</option>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filtro por área */}
      {areas.length > 1 && (
        <div style={s.chips}>
          <button className="touch-target" onClick={() => setArea('todas')} style={{ ...s.chip, ...(area === 'todas' ? s.chipOn : {}) }}>
            Todas
          </button>
          {areas.map((a) => (
            <button key={a} className="touch-target" onClick={() => setArea(a)} style={{ ...s.chip, ...(area === a ? s.chipOn : {}) }}>
              {a}
            </button>
          ))}
        </div>
      )}

      {grupos.length === 0 ? (
        <p style={s.muted}>Nenhum edital encontrado com esses filtros.</p>
      ) : (
        <div style={s.groupList}>
          {grupos.map((g) => {
            const orgaoInfo = g.orgaoSlug ? orgaoBySlug.get(g.orgaoSlug) : undefined;
            const open = forceOpen || expanded.has(g.key);
            const temVigente = g.editais.some((e) => e.situacao === 'vigente');
            return (
              <div key={g.key} style={s.group}>
                {/* O toggle e o link "Ver órgão" são irmãos dentro do cartão —
                    link dentro de <button> é HTML inválido (foco/AT quebram). */}
                <div style={s.groupHead}>
                  <button
                    onClick={() => toggleGroup(g.key)}
                    style={s.groupToggle}
                    aria-expanded={open}
                  >
                    <ChevronRight size={15} color={theme.inkSoft} strokeWidth={2}
                      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }} />
                    <Landmark size={15} color={theme.inkSoft} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    <span style={s.groupSigla}>{orgaoInfo?.sigla ?? g.sigla}</span>
                    {orgaoInfo && <span style={s.groupNome}>{orgaoInfo.nome}</span>}
                    <span style={s.groupCount}>
                      {g.editais.length} {g.editais.length === 1 ? 'cargo' : 'cargos'}
                    </span>
                    {/* Fechado, o grupo ainda avisa que há edital publicado lá dentro. */}
                    {!open && temVigente && <span style={s.groupVigente}>Edital vigente</span>}
                  </button>
                  {g.orgaoSlug && (
                    <Link href={`/editais/orgao/${g.orgaoSlug}`} style={s.groupArrow}>
                      Ver órgão →
                    </Link>
                  )}
                </div>
                {open && (
                  <div style={{ ...s.list, animation: 'focali-slide-down 0.18s ease' }}>
                    {g.editais.map((e) => (
                      <EditalCard key={e.id} edital={e} hideOrgao />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={s.footerHint}>
        Não achou seu concurso?{' '}
        <button className="touch-target" onClick={onImportarPdf} style={s.footerLink}>Importe um PDF →</button>
        {' ou '}
        <button className="touch-target" onClick={onImportar} style={s.footerLink}>cole o edital →</button>
      </p>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 14, color: theme.inkSoft, padding: '12px 0' },
  empty: { textAlign: 'center', padding: '40px 12px' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.6 },

  filterCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden', marginBottom: 12 },
  filterHead: { display: 'flex', alignItems: 'center', width: '100%' },
  filterToggle: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  filterTitle: { fontSize: 14, fontWeight: 600, color: theme.ink },
  clearBtn: { fontSize: 12, fontWeight: 600, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: '11px 16px', flexShrink: 0 },
  filterBody: { padding: '4px 16px 16px', borderTop: `0.5px solid ${theme.line}` },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 14px', marginTop: 10 },
  filterLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },

  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  chip: { padding: '6px 14px', borderRadius: theme.radiusPill, border: `1px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' },
  chipOn: { background: theme.tealBg, border: `1px solid ${theme.teal}`, color: theme.teal, fontWeight: 600 },

  groupList: { display: 'flex', flexDirection: 'column', gap: 10 },
  group: { minWidth: 0 },
  groupHead: { display: 'flex', alignItems: 'center', width: '100%', border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, background: theme.card, boxShadow: theme.shadow, minWidth: 0, marginBottom: 8 },
  groupToggle: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1, minWidth: 0, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 44, borderRadius: theme.radiusSm },
  groupVigente: { fontSize: 11, fontWeight: 700, color: theme.onTeal, background: theme.teal, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  groupSigla: { fontSize: 15, fontWeight: 800, color: theme.ink, letterSpacing: -0.2, flexShrink: 0 },
  groupNome: { fontSize: 13, color: theme.inkFaint, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  groupCount: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, background: theme.muted, borderRadius: theme.radiusPill, padding: '2px 9px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  groupArrow: { display: 'inline-flex', alignItems: 'center', alignSelf: 'stretch', fontSize: 12, fontWeight: 600, color: theme.teal, flexShrink: 0, whiteSpace: 'nowrap', padding: '12px 14px', textDecoration: 'none' },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },

  footerHint: { fontSize: 13, color: theme.inkFaint, margin: '16px 0 0', textAlign: 'center' },
  footerLink: { background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
