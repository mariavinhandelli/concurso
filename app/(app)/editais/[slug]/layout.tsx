// app/(app)/editais/[slug]/layout.tsx
// Metadata SEO da página do edital — gerada no servidor a partir do catálogo
// (leitura anônima liberada por RLS). O conteúdo em si continua client-side.
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

const SITUACAO_LABEL: Record<string, string> = {
  vigente: 'edital vigente',
  em_expectativa: 'em expectativa',
  encerrado: 'encerrado',
};

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('editais_catalog')
      .select('orgao, cargo, banca, situacao, vagas, aviso')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return { title: 'Edital não encontrado | Focali' };

    const titulo = [data.orgao, data.cargo].filter(Boolean).join(' — ');
    const partes = [
      SITUACAO_LABEL[data.situacao] ?? null,
      data.banca ? `banca ${data.banca}` : null,
      data.vagas != null ? `${data.vagas} vagas` : null,
    ].filter(Boolean).join(', ');
    return {
      title: `Concurso ${titulo} | Focali`,
      description:
        `Concurso ${titulo}${partes ? ` (${partes})` : ''}: edital verticalizado, pesos por disciplina, linha do tempo, provas anteriores e plano de estudos na Focali.`,
      alternates: { canonical: `/editais/${slug}` },
    };
  } catch {
    return { title: 'Edital | Focali' };
  }
}

export default function EditalSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
