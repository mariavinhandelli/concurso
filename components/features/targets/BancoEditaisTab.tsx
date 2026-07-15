'use client';

// Banco de editais: catálogo navegável com busca textual e filtros avançados
// (área, banca, UF, escolaridade, situação). Clique num edital abre a página
// /editais/[slug] — o Dashboard do Edital — onde a ativação é uma decisão
// informada, nunca o primeiro clique.

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Funnel, Search } from 'lucide-react';
import { listCatalogEditais, type CatalogEdital } from '@/services/editaisCatalog.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const SITUACAO_LABEL: Record<CatalogEdital['situacao'], string> = {
  vigente: 'Edital vigente',
  em_expectativa: 'Em expectativa',
  encerrado: 'Encerrado',
};

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

interface Props {
  onImportar: () => void;
  onImportarPdf: () => void;
}

export function BancoEditaisTab({ onImportar, onImportarPdf }: Props) {
  const router = useRouter();
  const [area, setArea] = useState<string>('todas');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: editais, isLoading, isError } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
  });

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

  function set<K extends keyof FilterValues>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <div style={s.list}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...s.skeleton, animationDelay: `${i * 0.1}s` }} />
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

      {/* Filtros avançados — mesmo padrão colapsível das jurisprudências */}
      <div style={s.filterCard}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFiltersOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFiltersOpen((v) => !v); }}
          style={s.filterHead}
        >
          <Funnel size={15} color={theme.inkSoft} strokeWidth={1.7} />
          <span style={s.filterTitle}>Filtros</span>
          {activeCount > 0 && <Badge variant="brand" tone="solid">{activeCount}</Badge>}
          {activeCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setFilters(EMPTY_FILTERS); }}
              style={s.clearBtn}
            >Limpar</button>
          )}
          <ChevronDown size={14} color={theme.inkFaint} strokeWidth={1.7}
            style={{ marginLeft: 'auto', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
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
          <button onClick={() => setArea('todas')} style={{ ...s.chip, ...(area === 'todas' ? s.chipOn : {}) }}>
            Todas
          </button>
          {areas.map((a) => (
            <button key={a} onClick={() => setArea(a)} style={{ ...s.chip, ...(area === a ? s.chipOn : {}) }}>
              {a}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p style={s.muted}>Nenhum edital encontrado com esses filtros.</p>
      ) : (
        <div style={s.list}>
          {filtered.map((e) => (
            <EditalCard key={e.id} edital={e} onOpen={() => router.push(`/editais/${e.slug}`)} />
          ))}
        </div>
      )}

      <p style={s.footerHint}>
        Não achou seu concurso?{' '}
        <button onClick={onImportarPdf} style={s.footerLink}>Importe um PDF →</button>
        {' ou '}
        <button onClick={onImportar} style={s.footerLink}>cole o edital →</button>
      </p>
    </>
  );
}

function EditalCard({ edital: e, onOpen }: { edital: CatalogEdital; onOpen: () => void }) {
  const [hov, setHov] = useState(false);
  const meta = [
    e.banca,
    e.uf,
    e.situacao === 'em_expectativa' && e.ultimaEdicao ? `última edição ${e.ultimaEdicao}` : e.ano ? String(e.ano) : null,
    `${e.subjectCount} matéria${e.subjectCount === 1 ? '' : 's'}`,
    `${e.topicCount} tópicos`,
  ].filter(Boolean).join(' · ');

  const extra = [
    e.vagas != null ? `${e.vagas.toLocaleString('pt-BR')} vagas` : null,
    e.examDate ? `prova em ${new Date(e.examDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...s.card,
        borderColor: hov ? theme.teal : theme.line,
        boxShadow: hov ? theme.shadowHover : theme.shadow,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={s.cardTitleRow}>
          <span style={s.cardTitle}>{[e.orgao, e.cargo].filter(Boolean).join(' · ')}</span>
          <span style={{
            ...s.situacaoTag,
            ...(e.situacao === 'vigente' ? s.situacaoVigente
              : e.situacao === 'em_expectativa' ? s.situacaoExpectativa
              : s.situacaoEncerrado),
          }}>
            {SITUACAO_LABEL[e.situacao]}
          </span>
          {e.isActivated && <span style={{ ...s.activatedTag, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ativado <Check size={12} strokeWidth={2.5} /></span>}
        </div>
        <div style={s.cardMeta}>{meta}</div>
        {extra && <div style={s.cardExtra}>{extra}</div>}
      </div>
      <span style={{ ...s.cardArrow, color: hov ? theme.teal : theme.inkFaint }}>
        Ver detalhes →
      </span>
    </button>
  );
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 14, color: theme.inkSoft, padding: '12px 0' },
  skeleton: { height: 84, borderRadius: theme.radiusSm, background: theme.muted, animation: 'focali-pulse 1.4s ease infinite' },

  empty: { textAlign: 'center', padding: '40px 12px' },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: theme.inkSoft, margin: '0 0 6px' },
  emptyHint: { fontSize: 13, color: theme.inkFaint, maxWidth: 360, margin: '0 auto 16px', lineHeight: 1.6 },

  filterCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden', marginBottom: 12 },
  filterHead: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 16px', cursor: 'pointer', userSelect: 'none' },
  filterTitle: { fontSize: 14, fontWeight: 600, color: theme.ink },
  clearBtn: { fontSize: 12, fontWeight: 600, color: theme.teal, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' },
  filterBody: { padding: '4px 16px 16px', borderTop: `0.5px solid ${theme.line}` },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 14px', marginTop: 10 },
  filterLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },

  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  chip: { padding: '6px 14px', borderRadius: theme.radiusPill, border: `1px solid ${theme.line}`, background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' },
  chipOn: { background: theme.tealBg, border: `1px solid ${theme.teal}`, color: theme.teal, fontWeight: 600 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', width: '100%', minWidth: 0, transition: 'border-color .15s, box-shadow .15s' },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  situacaoTag: { fontSize: 11, fontWeight: 700, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.2 },
  situacaoVigente: { color: theme.onTeal, background: theme.teal },
  situacaoExpectativa: { color: theme.warn, background: theme.warnBg },
  situacaoEncerrado: { color: theme.inkFaint, background: theme.muted },
  activatedTag: { fontSize: 11, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '2px 8px', flexShrink: 0 },
  cardMeta: { fontSize: 13, color: theme.inkSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardExtra: { fontSize: 12, color: theme.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardArrow: { fontSize: 13, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', transition: 'color .15s' },

  footerHint: { fontSize: 13, color: theme.inkFaint, margin: '16px 0 0', textAlign: 'center' },
  footerLink: { background: 'transparent', border: 'none', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
