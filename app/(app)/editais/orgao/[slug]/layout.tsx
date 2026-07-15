// app/(app)/editais/orgao/[slug]/layout.tsx
// Metadata SEO da página do órgão — gerada no servidor a partir do catálogo.
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('orgaos_catalog')
      .select('sigla, nome, descricao')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return { title: 'Órgão não encontrado | Focali' };
    return {
      title: `Concursos ${data.sigla} — ${data.nome} | Focali`,
      description: data.descricao
        ?? `Editais e concursos do órgão ${data.nome} (${data.sigla}): cargos, vagas, bancas e grade de estudos na Focali.`,
      alternates: { canonical: `/editais/orgao/${slug}` },
    };
  } catch {
    return { title: 'Órgão | Focali' };
  }
}

export default function OrgaoSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
