// app/(app)/editais/[slug]/layout.tsx
// Metadata SEO da página do edital — gerada no servidor a partir do catálogo
// (leitura anônima liberada por RLS). O conteúdo em si continua client-side.
// O JSON-LD BreadcrumbList (Banco → Órgão → Cargo) reusa o MESMO fetch da
// metadata via React cache() — uma query por request, não duas.
import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE = 'https://www.focali.com.br';

const SITUACAO_LABEL: Record<string, string> = {
  vigente: 'edital vigente',
  em_expectativa: 'em expectativa',
  encerrado: 'encerrado',
};

interface EditalSeoRow {
  orgao: string;
  cargo: string;
  banca: string | null;
  situacao: string;
  vagas: number | null;
  orgaos_catalog: { slug: string; sigla: string } | { slug: string; sigla: string }[] | null;
}

const getEditalSeo = cache(async (slug: string): Promise<EditalSeoRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('editais_catalog')
    .select('orgao, cargo, banca, situacao, vagas, orgaos_catalog(slug, sigla)')
    .eq('slug', slug)
    .maybeSingle();
  return (data as EditalSeoRow | null) ?? null;
});

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await getEditalSeo(slug);
    if (!data) return { title: 'Edital não encontrado | Focali' };

    const titulo = [data.orgao, data.cargo].filter(Boolean).join(' — ');
    const partes = [
      SITUACAO_LABEL[data.situacao] ?? null,
      data.banca ? `banca ${data.banca}` : null,
      data.vagas != null ? `${data.vagas} vagas` : null,
    ].filter(Boolean).join(', ');
    const title = `Concurso ${titulo} | Focali`;
    const description =
      `Concurso ${titulo}${partes ? ` (${partes})` : ''}: edital verticalizado, pesos por disciplina, linha do tempo, provas anteriores e plano de estudos na Focali.`;
    return {
      title,
      description,
      alternates: { canonical: `/editais/${slug}` },
      // Sem openGraph próprio, o compartilhamento cai no OG genérico da home.
      openGraph: { title, description, url: `/editais/${slug}` },
    };
  } catch {
    return { title: 'Edital | Focali' };
  }
}

export default async function EditalSlugLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let jsonLd: object | null = null;
  try {
    const data = await getEditalSeo(slug);
    if (data) {
      const orgaoRel = Array.isArray(data.orgaos_catalog) ? data.orgaos_catalog[0] : data.orgaos_catalog;
      const items = [
        { '@type': 'ListItem', position: 1, name: 'Banco de Editais', item: `${BASE}/editais` },
        ...(orgaoRel
          ? [{ '@type': 'ListItem', position: 2, name: orgaoRel.sigla, item: `${BASE}/editais/orgao/${orgaoRel.slug}` }]
          : []),
        {
          '@type': 'ListItem',
          position: orgaoRel ? 3 : 2,
          name: [data.orgao, data.cargo].filter(Boolean).join(' · '),
          item: `${BASE}/editais/${slug}`,
        },
      ];
      jsonLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
    }
  } catch { /* breadcrumb é enhancement — sem ele a página segue normal */ }

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {children}
    </>
  );
}
