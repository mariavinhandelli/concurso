// app/(app)/editais/orgao/[slug]/page.tsx
// Página do ÓRGÃO no Hub de Editais: ficha institucional (nome, UF, esfera,
// poder, site oficial) e os editais de cada cargo — a hierarquia
// órgão → cargos → especificações navegável de cima para baixo.
'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Landmark } from 'lucide-react';
import {
  getOrgaoBySlug, listCatalogEditais,
  type CatalogEdital, type OrgaoCatalog,
} from '@/services/editaisCatalog.service';
import { EditalCard } from '@/components/features/editais/EditalCard';
import { pushRecent } from '@/lib/recents';
import { theme } from '@/lib/theme';
import { PageContainer } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';

const ESFERA_LABEL: Record<string, string> = {
  estadual: 'Estadual',
  federal: 'Federal',
  municipal: 'Municipal',
};

const PODER_LABEL: Record<string, string> = {
  executivo: 'Poder Executivo',
  judiciario: 'Poder Judiciário',
  legislativo: 'Poder Legislativo',
  controle: 'Controle Externo',
};

export default function OrgaoPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data: orgao, isLoading, isError } = useQuery<OrgaoCatalog | null>({
    queryKey: ['orgao', slug],
    queryFn: () => getOrgaoBySlug(slug),
  });
  const { data: editais } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
    enabled: Boolean(orgao),
  });

  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!orgao || trackedSlug.current === orgao.slug) return;
    trackedSlug.current = orgao.slug;
    pushRecent({
      kind: 'edital',
      id: `orgao:${orgao.slug}`,
      label: orgao.sigla,
      sublabel: orgao.nome,
      href: `/editais/orgao/${orgao.slug}`,
    });
  }, [orgao]);

  if (isLoading) {
    return (
      <PageContainer width="narrow">
        <Skeleton width={120} height={16} />
        <div style={{ height: 14 }} />
        <Skeleton width="55%" height={30} />
        <div style={{ height: 20 }} />
        {[1, 2, 3].map((i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton height={84} borderRadius={theme.radiusSm} /></div>)}
      </PageContainer>
    );
  }

  if (isError || !orgao) {
    return (
      <PageContainer width="narrow">
        <button onClick={() => router.push('/targets')} style={s.back}>← Banco de editais</button>
        <p style={{ color: theme.inkFaint, fontSize: 14 }}>
          {isError ? 'Não foi possível carregar o órgão. Tente de novo.' : 'Órgão não encontrado.'}
        </p>
      </PageContainer>
    );
  }

  const doOrgao = (editais ?? []).filter((e) => e.orgaoSlug === orgao.slug);

  return (
    <PageContainer width="narrow">
      <button onClick={() => router.push('/targets')} style={s.back}>← Banco de editais</button>

      {/* ── Ficha do órgão ── */}
      <div style={s.headerRow}>
        <span style={s.iconWrap}><Landmark size={22} color={theme.teal} strokeWidth={1.8} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={s.h1}>{orgao.sigla}</h1>
          <p style={s.nome}>{orgao.nome}</p>
          <div style={s.tagRow}>
            {orgao.uf && <span style={s.metaChip}>{orgao.uf}</span>}
            {orgao.esfera && <span style={s.metaChip}>{ESFERA_LABEL[orgao.esfera] ?? orgao.esfera}</span>}
            {orgao.poder && <span style={s.metaChip}>{PODER_LABEL[orgao.poder] ?? orgao.poder}</span>}
            {orgao.siteUrl && (
              <a href={orgao.siteUrl} target="_blank" rel="noopener noreferrer" style={s.siteLink}>
                Site oficial <ExternalLink size={11} strokeWidth={2.2} style={{ verticalAlign: -1 }} />
              </a>
            )}
          </div>
        </div>
      </div>

      {orgao.descricao && <p style={s.descricao}>{orgao.descricao}</p>}

      {/* ── Cargos / editais ── */}
      <h2 style={s.sectionTitle}>
        Concursos e cargos
        <span style={s.sectionMeta}>
          {doOrgao.length} {doOrgao.length === 1 ? 'edital' : 'editais'}
        </span>
      </h2>

      {!editais ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map((i) => <Skeleton key={i} height={84} borderRadius={theme.radiusSm} />)}
        </div>
      ) : doOrgao.length === 0 ? (
        <p style={s.mutedText}>Nenhum edital curado para este órgão ainda.</p>
      ) : (
        <div style={s.list}>
          {doOrgao.map((e) => (
            <EditalCard key={e.id} edital={e} hideOrgao onOpen={() => router.push(`/editais/${e.slug}`)} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

const s: Record<string, CSSProperties> = {
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '10px 12px', marginBottom: 10, fontFamily: 'inherit', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: theme.radiusSm, marginLeft: -12, transition: 'background .12s' },

  headerRow: { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 },
  iconWrap: { width: 46, height: 46, borderRadius: theme.radiusSm, background: theme.tealBg, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0, overflowWrap: 'break-word' },
  nome: { fontSize: 14, color: theme.inkSoft, margin: '3px 0 8px', lineHeight: 1.4 },
  tagRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaChip: { fontSize: 12, fontWeight: 500, color: theme.inkSoft, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, padding: '3px 8px' },
  siteLink: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: theme.teal, textDecoration: 'none', padding: '3px 2px' },

  descricao: { fontSize: 13, color: theme.inkFaint, lineHeight: 1.6, margin: '0 0 22px', maxWidth: 560 },

  sectionTitle: { display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 15, fontWeight: 700, color: theme.ink, margin: '0 0 12px' },
  sectionMeta: { fontSize: 12, fontWeight: 500, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  mutedText: { fontSize: 13, color: theme.inkFaint },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
};
