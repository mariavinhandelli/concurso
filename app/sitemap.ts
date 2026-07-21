// app/sitemap.ts
// Sitemap das páginas PÚBLICAS: Banco de Editais (páginas de edital e de
// órgão, lidas do catálogo com a anon key — RLS pública) + páginas legais.
// Revalida diariamente; novos editais entram sem redeploy.
import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 86400;

const BASE = 'https://www.focali.com.br';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixas: MetadataRoute.Sitemap = [
    { url: `${BASE}/editais`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/termos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacidade`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    // Client "puro" (sem cookies): sitemap roda fora do contexto de request.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const [editaisRes, orgaosRes] = await Promise.all([
      supabase.from('editais_catalog').select('slug').eq('is_active', true),
      // Só órgãos com pelo menos um edital ativo — órgão vazio renderiza
      // "nenhum edital curado", página thin que não deve ser indexada.
      supabase.from('orgaos_catalog').select('slug, editais_catalog!inner(id)').eq('editais_catalog.is_active', true),
    ]);
    const editais = (editaisRes.data ?? []).map((e) => ({
      url: `${BASE}/editais/${e.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    const orgaos = (orgaosRes.data ?? []).map((o) => ({
      url: `${BASE}/editais/orgao/${o.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [...fixas, ...editais, ...orgaos];
  } catch {
    return fixas; // catálogo indisponível → sitemap mínimo, nunca quebra
  }
}
