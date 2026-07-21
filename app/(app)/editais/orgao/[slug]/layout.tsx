// app/(app)/editais/orgao/[slug]/layout.tsx
// Metadata SEO da página do órgão — gerada no servidor a partir do catálogo.
// JSON-LD BreadcrumbList (Banco → Órgão) reusa o fetch via React cache().
import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE = 'https://www.focali.com.br';

const getOrgaoSeo = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orgaos_catalog')
    .select('sigla, nome, descricao')
    .eq('slug', slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await getOrgaoSeo(slug);
    if (!data) return { title: 'Órgão não encontrado | Focali' };
    const title = `Concursos ${data.sigla} — ${data.nome} | Focali`;
    const description = data.descricao
      ?? `Editais e concursos do órgão ${data.nome} (${data.sigla}): cargos, vagas, bancas e grade de estudos na Focali.`;
    return {
      title,
      description,
      alternates: { canonical: `/editais/orgao/${slug}` },
      // Sem openGraph próprio, o compartilhamento cai no OG genérico da home.
      openGraph: { title, description, url: `/editais/orgao/${slug}` },
    };
  } catch {
    return { title: 'Órgão | Focali' };
  }
}

export default async function OrgaoSlugLayout(
  { children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let jsonLd: object | null = null;
  try {
    const data = await getOrgaoSeo(slug);
    if (data) {
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Banco de Editais', item: `${BASE}/editais` },
          { '@type': 'ListItem', position: 2, name: data.sigla, item: `${BASE}/editais/orgao/${slug}` },
        ],
      };
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
