// services/jurisInteracoes.service.ts
// Interações PESSOAIS com jurisprudências do banco global: favorito, estrelas
// pessoais, anotações, tags, trechos destacados e revisão espaçada.
// Tudo isolado por usuário via RLS (auth.uid() = user_id) + filtro explícito.

import { createClient } from '@/lib/supabase/client';
import {
  calculateNextJurisReview, fromJurisDbRow, toJurisDbRow, isJurisDue, jurisDaysOverdue,
  type JurisRating,
} from '@/lib/juris-review';
import { localDateInDays } from '@/lib/local-date';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';
import { getJurisprudenciaById } from '@/services/jurisprudencias.service';

export interface Destaque {
  id: string;
  campo: string;
  trecho: string;
  nota: string | null;
  criado_em: string;
}

export interface JurisInteracao {
  id: string;
  user_id: string;
  jurisprudencia_id: string;
  favorito: boolean;
  estrelas_pessoais: 1 | 2 | 3 | 4 | 5 | null;
  anotacoes: string | null;
  tags_pessoais: string[];
  destaques: Destaque[];
  is_review_active: boolean;
  next_review_date: string | null;
  interval_days: number;
  repetitions: number;
  last_reviewed: string | null;
  created_at: string;
  updated_at: string;
}

export interface JurisComInteracao extends Jurisprudencia {
  interacao: JurisInteracao | null;
}

const EMPTY_INTERACAO_FIELDS = {
  favorito: false,
  estrelas_pessoais: null,
  anotacoes: null,
  tags_pessoais: [] as string[],
  destaques: [] as Destaque[],
  is_review_active: false,
  next_review_date: null,
  interval_days: 0,
  repetitions: 0,
  last_reviewed: null,
};

// Busca a interação do usuário com uma jurisprudência (ou null se nunca interagiu).
export async function getInteracao(jurisId: string): Promise<JurisInteracao | null> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('juris_interacoes')
    .select('*')
    .eq('jurisprudencia_id', jurisId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error('Erro ao buscar interação: ' + error.message);
  return data as JurisInteracao | null;
}

async function upsertInteracao(jurisId: string, patch: Record<string, unknown>): Promise<JurisInteracao> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Você precisa estar logado.');

  const { data, error } = await supabase
    .from('juris_interacoes')
    .upsert(
      { user_id: user.id, jurisprudencia_id: jurisId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,jurisprudencia_id' },
    )
    .select()
    .single();

  if (error) throw new Error('Erro ao salvar interação: ' + error.message);
  return data as JurisInteracao;
}

export async function toggleFavorito(jurisId: string): Promise<boolean> {
  const atual = await getInteracao(jurisId);
  const novoValor = !(atual?.favorito ?? false);
  await upsertInteracao(jurisId, { favorito: novoValor });
  return novoValor;
}

export async function setEstrelasPessoais(jurisId: string, estrelas: 1 | 2 | 3 | 4 | 5 | null): Promise<void> {
  await upsertInteracao(jurisId, { estrelas_pessoais: estrelas });
}

export async function saveAnotacao(jurisId: string, anotacoes: string, tags: string[]): Promise<void> {
  await upsertInteracao(jurisId, { anotacoes: anotacoes.trim() || null, tags_pessoais: tags });
}

export async function addDestaque(jurisId: string, campo: string, trecho: string, nota?: string): Promise<Destaque[]> {
  const atual = await getInteracao(jurisId);
  const destaque: Destaque = {
    id: crypto.randomUUID(),
    campo, trecho,
    nota: nota?.trim() || null,
    criado_em: new Date().toISOString(),
  };
  const destaques = [...(atual?.destaques ?? []), destaque];
  const saved = await upsertInteracao(jurisId, { destaques });
  return saved.destaques;
}

export async function removeDestaque(jurisId: string, destaqueId: string): Promise<Destaque[]> {
  const atual = await getInteracao(jurisId);
  const destaques = (atual?.destaques ?? []).filter((d) => d.id !== destaqueId);
  const saved = await upsertInteracao(jurisId, { destaques });
  return saved.destaques;
}

// Agenda a primeira revisão com intervalo manual (1/7/15/30 ou personalizado).
export async function activateRevisao(jurisId: string, intervalDays: number): Promise<void> {
  await upsertInteracao(jurisId, {
    is_review_active: true,
    next_review_date: localDateInDays(intervalDays),
    interval_days: intervalDays,
    repetitions: 0,
  });
}

export async function desativarRevisao(jurisId: string): Promise<void> {
  await upsertInteracao(jurisId, {
    is_review_active: false,
    next_review_date: null,
    interval_days: 0,
    repetitions: 0,
  });
}

// Avalia a revisão (Errei/Difícil/Ok/Dominei) e reagenda automaticamente.
export async function submitRevisao(jurisId: string, rating: JurisRating): Promise<void> {
  const atual = await getInteracao(jurisId);
  const state = fromJurisDbRow({
    interval_days: atual?.interval_days ?? 0,
    repetitions: atual?.repetitions ?? 0,
  });
  const result = calculateNextJurisReview(state, rating);
  await upsertInteracao(jurisId, { ...toJurisDbRow(result), is_review_active: true });
}

// ---------- Listas combinadas (interação + conteúdo da jurisprudência) ----------

export async function listFavoritas(): Promise<JurisComInteracao[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('juris_interacoes')
    .select('*')
    .eq('user_id', user.id)
    .eq('favorito', true)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Erro ao listar favoritas: ' + error.message);
  return mapWithLocal(data ?? []);
}

export async function listRevisoesHoje(): Promise<JurisComInteracao[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('juris_interacoes')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .order('next_review_date', { ascending: true });

  if (error) throw new Error('Erro ao listar revisões: ' + error.message);
  return (await mapWithLocal(data ?? [])).filter((j) => j.interacao && isJurisDue(j.interacao.next_review_date));
}

export async function countRevisoesHoje(): Promise<number> {
  const items = await listRevisoesHoje();
  return items.length;
}

async function mapWithLocal(rows: JurisInteracao[]): Promise<JurisComInteracao[]> {
  if (rows.length === 0) return [];
  const missingIds = rows
    .map((r) => r.jurisprudencia_id)
    .filter((id) => !getJurisprudenciaById(id));
  const supabaseMap = new Map<string, Jurisprudencia>();
  if (missingIds.length > 0) {
    const supabase = createClient();
    const { data } = await supabase.from('jurisprudencias').select('*').in('id', missingIds);
    for (const item of (data ?? []) as Jurisprudencia[]) supabaseMap.set(item.id, item);
  }
  const out: JurisComInteracao[] = [];
  for (const interacao of rows) {
    const juris = getJurisprudenciaById(interacao.jurisprudencia_id) ?? supabaseMap.get(interacao.jurisprudencia_id);
    if (!juris) continue;
    out.push({ ...juris, interacao });
  }
  return out;
}

export { isJurisDue, jurisDaysOverdue, EMPTY_INTERACAO_FIELDS };
