// services/leiInteracoes.service.ts
// Interações PESSOAIS com artigos de lei do Vade Mecum: grifos semânticos,
// anotações, favorito e revisão espaçada. Artigo referenciado por chave
// estável "slug:numero" (ex.: 'cf-88:37'). Revisão reusa o motor de
// jurisprudências (lib/juris-review.ts) — mesmos intervalos 1/3/15/45.

import { requireUser } from '@/lib/supabase/requireUser';
import {
  calculateNextJurisReview, fromJurisDbRow, toJurisDbRow,
  type JurisRating,
} from '@/lib/juris-review';
import { toLocalDateString } from '@/lib/local-date';

export type GrifoCor = 'regra' | 'prazo' | 'competencia' | 'excecao';
export type GrifoEstilo = 'grifo' | 'sublinhado';

export interface LeiGrifo {
  id: string;
  bloco: string;        // id do bloco dentro do artigo ("b3")
  start: number;        // offset no texto plano do bloco
  end: number;
  cor: GrifoCor | null; // null quando estilo = 'sublinhado'
  estilo: GrifoEstilo;
  nota: string | null;
  criado_em: string;
}

export interface LeiInteracao {
  id: string;
  user_id: string;
  artigo_key: string;
  favorito: boolean;
  grifos: LeiGrifo[];
  anotacoes: string | null;
  is_review_active: boolean;
  next_review_date: string | null;
  interval_days: number;
  repetitions: number;
  last_reviewed: string | null;
  created_at: string;
  updated_at: string;
}

// Todas as interações do usuário com artigos de uma lei, indexadas por chave.
export async function listInteracoesByLei(slug: string): Promise<Map<string, LeiInteracao>> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('lei_interacoes')
    .select('*')
    .eq('user_id', userId)
    .like('artigo_key', `${slug}:%`);
  if (error) throw new Error('Erro ao buscar interações: ' + error.message);

  const map = new Map<string, LeiInteracao>();
  for (const row of (data ?? []) as LeiInteracao[]) map.set(row.artigo_key, row);
  return map;
}

async function upsertInteracao(artigoKey: string, patch: Record<string, unknown>): Promise<LeiInteracao> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('lei_interacoes')
    .upsert(
      { user_id: userId, artigo_key: artigoKey, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,artigo_key' },
    )
    .select()
    .single();
  if (error) throw new Error('Erro ao salvar interação: ' + error.message);
  return data as LeiInteracao;
}

// ─── Grifos (RPCs atômicas — sem race de read-modify-write) ─────────────────

export async function addGrifo(
  artigoKey: string,
  grifo: Omit<LeiGrifo, 'id' | 'criado_em'>,
): Promise<LeiGrifo[]> {
  const { supabase } = await requireUser();
  const completo: LeiGrifo = {
    ...grifo,
    id: crypto.randomUUID(),
    criado_em: new Date().toISOString(),
  };
  const { data, error } = await supabase.rpc('append_lei_grifo', {
    p_artigo_key: artigoKey,
    p_grifo: completo,
  });
  if (error) throw new Error('Erro ao salvar grifo: ' + error.message);
  return (data ?? []) as LeiGrifo[];
}

export async function removeGrifo(artigoKey: string, grifoId: string): Promise<LeiGrifo[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('remove_lei_grifo', {
    p_artigo_key: artigoKey,
    p_grifo_id: grifoId,
  });
  if (error) throw new Error('Erro ao remover grifo: ' + error.message);
  return (data ?? []) as LeiGrifo[];
}

// ─── Anotações e favorito ────────────────────────────────────────────────────

export async function saveAnotacaoArtigo(artigoKey: string, anotacoes: string): Promise<void> {
  await upsertInteracao(artigoKey, { anotacoes: anotacoes.trim() || null });
}

export async function toggleFavoritoArtigo(artigoKey: string, novoValor: boolean): Promise<void> {
  await upsertInteracao(artigoKey, { favorito: novoValor });
}

// ─── Revisão espaçada (motor de juris-review) ────────────────────────────────

export async function ativarRevisaoArtigo(artigoKey: string): Promise<LeiInteracao> {
  // Entra na fila vencendo hoje; o primeiro rating define o intervalo real.
  return upsertInteracao(artigoKey, {
    is_review_active: true,
    next_review_date: toLocalDateString(),
  });
}

export async function desativarRevisaoArtigo(artigoKey: string): Promise<void> {
  await upsertInteracao(artigoKey, { is_review_active: false, next_review_date: null });
}

export async function submitRevisaoArtigo(artigoKey: string, rating: JurisRating): Promise<LeiInteracao> {
  const { supabase, userId } = await requireUser();
  const { data: atual, error } = await supabase
    .from('lei_interacoes')
    .select('interval_days, repetitions')
    .eq('user_id', userId)
    .eq('artigo_key', artigoKey)
    .maybeSingle();
  if (error) throw new Error('Erro ao ler estado de revisão: ' + error.message);

  const state = fromJurisDbRow(atual ?? { interval_days: 0, repetitions: 0 });
  const result = calculateNextJurisReview(state, rating);
  return upsertInteracao(artigoKey, { ...toJurisDbRow(result), is_review_active: true });
}

// Artigos com revisão vencida (para a fila e para badges).
export async function listRevisoesDue(): Promise<LeiInteracao[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('lei_interacoes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .lte('next_review_date', toLocalDateString())
    .order('next_review_date', { ascending: true });
  if (error) throw new Error('Erro ao buscar revisões: ' + error.message);
  return (data ?? []) as LeiInteracao[];
}

export async function countRevisoesDue(): Promise<number> {
  const { supabase, userId } = await requireUser();
  const { count, error } = await supabase
    .from('lei_interacoes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_review_active', true)
    .lte('next_review_date', toLocalDateString());
  if (error) return 0;
  return count ?? 0;
}

// M12: artigos favoritados (chave 'slug:numero') — para os Favoritos globais do palette.
export async function listFavoriteLeiArtigos(): Promise<{ artigoKey: string }[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('lei_interacoes')
    .select('artigo_key')
    .eq('user_id', userId)
    .eq('favorito', true)
    .order('updated_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({ artigoKey: r.artigo_key as string }));
}

// M8 fase 2: artigos com anotação — para a busca unificada "Tudo" do Caderno.
export async function listAnotacoesLei(): Promise<{ artigoKey: string; anotacoes: string; updated_at: string }[]> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('lei_interacoes')
    .select('artigo_key, anotacoes, updated_at')
    .eq('user_id', userId)
    .not('anotacoes', 'is', null)
    .order('updated_at', { ascending: false });
  if (error) return [];
  return (data ?? [])
    .filter((r) => (r.anotacoes ?? '').trim())
    .map((r) => ({ artigoKey: r.artigo_key as string, anotacoes: r.anotacoes as string, updated_at: r.updated_at as string }));
}
