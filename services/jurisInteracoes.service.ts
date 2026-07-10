// services/jurisInteracoes.service.ts
// Interações PESSOAIS com jurisprudências do banco global: favorito, estrelas
// pessoais, anotações, tags, trechos destacados e revisão espaçada.
// Tudo isolado por usuário via RLS (auth.uid() = user_id) + filtro explícito.

import { createClient } from '@/lib/supabase/client';
import {
  calculateNextJurisReview, fromJurisDbRow, toJurisDbRow, isJurisDue, jurisDaysOverdue,
  type JurisRating,
} from '@/lib/juris-review';
import { localDateInDays, toLocalDateString } from '@/lib/local-date';
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

// Aceita o novo valor do chamador para evitar race condition de read-then-write.
export async function toggleFavorito(jurisId: string, novoValor: boolean): Promise<void> {
  await upsertInteracao(jurisId, { favorito: novoValor });
}

export async function setEstrelasPessoais(jurisId: string, estrelas: 1 | 2 | 3 | 4 | 5 | null): Promise<void> {
  await upsertInteracao(jurisId, { estrelas_pessoais: estrelas });
}

export async function saveAnotacao(jurisId: string, anotacoes: string, tags: string[]): Promise<void> {
  await upsertInteracao(jurisId, { anotacoes: anotacoes.trim() || null, tags_pessoais: tags });
}

// Usa RPCs atômicas no Postgres para evitar race condition de read-modify-write.
export async function addDestaque(jurisId: string, campo: string, trecho: string, nota?: string): Promise<Destaque[]> {
  const supabase = createClient();
  const destaque: Destaque = {
    id: crypto.randomUUID(),
    campo, trecho,
    nota: nota?.trim() || null,
    criado_em: new Date().toISOString(),
  };
  const { data, error } = await supabase.rpc('append_juris_destaque', {
    p_juris_id: jurisId,
    p_destaque: destaque,
  });
  if (error) throw new Error('Erro ao salvar destaque: ' + error.message);
  return (data ?? []) as Destaque[];
}

export async function removeDestaque(jurisId: string, destaqueId: string): Promise<Destaque[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('remove_juris_destaque', {
    p_juris_id: jurisId,
    p_destaque_id: destaqueId,
  });
  if (error) throw new Error('Erro ao remover destaque: ' + error.message);
  return (data ?? []) as Destaque[];
}

// Agenda a primeira revisão com intervalo manual (1/7/15/30 ou personalizado).
export async function activateRevisao(jurisId: string, intervalDays: number): Promise<void> {
  const days = Math.round(intervalDays);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    throw new Error('Intervalo inválido. Use um valor entre 1 e 365 dias.');
  }
  await upsertInteracao(jurisId, {
    is_review_active: true,
    next_review_date: localDateInDays(days),
    interval_days: days,
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
// Passa currentState para evitar um GET extra quando o chamador já tem os dados.
export async function submitRevisao(
  jurisId: string,
  rating: JurisRating,
  currentState?: Pick<JurisInteracao, 'interval_days' | 'repetitions'> | null,
): Promise<void> {
  const resolved = currentState ?? (await getInteracao(jurisId));
  const state = fromJurisDbRow({
    interval_days: resolved?.interval_days ?? 0,
    repetitions: resolved?.repetitions ?? 0,
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
  return hydrateInteracoes(data ?? []);
}

// M8 fase 2: julgados com anotação pessoal — para a busca unificada "Tudo".
export async function listAnotacoesJuris(): Promise<JurisComInteracao[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('juris_interacoes')
    .select('*')
    .eq('user_id', user.id)
    .not('anotacoes', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Erro ao listar anotações: ' + error.message);
  return hydrateInteracoes((data ?? []).filter((r) => (r.anotacoes ?? '').trim()) as JurisInteracao[]);
}

export async function listRevisoesHoje(): Promise<JurisComInteracao[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const hoje = toLocalDateString(); // YYYY-MM-DD no fuso local

  const { data, error } = await supabase
    .from('juris_interacoes')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .lte('next_review_date', hoje)
    .order('next_review_date', { ascending: true });

  if (error) throw new Error('Erro ao listar revisões: ' + error.message);
  return hydrateInteracoes(data ?? []);
}

// countRevisoesHoje foi movido para services/jurisRevisao.service.ts (perf F1) —
// contagem pura, sem puxar data/jurisprudencias para a Home.

export async function listFavoritosByIds(ids: string[]): Promise<Record<string, boolean>> {
  if (ids.length === 0) return {};
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from('juris_interacoes')
    .select('jurisprudencia_id, favorito')
    .eq('user_id', user.id)
    .in('jurisprudencia_id', ids);

  const map: Record<string, boolean> = {};
  for (const row of data ?? []) map[row.jurisprudencia_id] = row.favorito;
  return map;
}

const CHUNK_SIZE = 200;

// Busca favorito + dias de atraso de revisão para uma lista de ids.
// Chunked em lotes de 200 para evitar limite de comprimento de URL do PostgREST.
export async function listInteracoesSummaryByIds(
  ids: string[],
): Promise<Record<string, { favorito: boolean; overdueDays: number }>> {
  if (ids.length === 0) return {};
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const rows = (
    await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from('juris_interacoes')
          .select('jurisprudencia_id, favorito, is_review_active, next_review_date')
          .eq('user_id', user.id)
          .in('jurisprudencia_id', chunk)
          .then(({ data }) => data ?? []),
      ),
    )
  ).flat();

  const today = toLocalDateString();
  const todayMs = new Date(today + 'T00:00:00Z').getTime();
  const map: Record<string, { favorito: boolean; overdueDays: number }> = {};
  for (const row of rows) {
    let overdueDays = 0;
    if (row.is_review_active && row.next_review_date && row.next_review_date < today) {
      const dueMs = new Date(row.next_review_date + 'T00:00:00Z').getTime();
      overdueDays = Math.max(0, Math.floor((todayMs - dueMs) / 86_400_000));
    }
    map[row.jurisprudencia_id] = { favorito: row.favorito ?? false, overdueDays };
  }
  return map;
}

export interface SimuladoInsights {
  ultimoScore: number | null;       // % de acerto da última sessão
  ultimaData: string | null;        // ISO da última sessão
  disciplinaMaisFraga: string | null; // disciplina com menor taxa de acerto (>= 5 questões)
  taxaDisciplinaMaisFraga: number | null;
  /** Contagem das sessões usadas nesta amostra — limitada a 20, NÃO é o total histórico. */
  totalSessoesRecentes: number;
}

export async function getSimuladoInsights(): Promise<SimuladoInsights> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ultimoScore: null, ultimaData: null, disciplinaMaisFraga: null, taxaDisciplinaMaisFraga: null, totalSessoesRecentes: 0 };

  const { data, error } = await supabase
    .from('juris_simulado_sessions')
    .select('certas, total, respostas, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return { ultimoScore: null, ultimaData: null, disciplinaMaisFraga: null, taxaDisciplinaMaisFraga: null, totalSessoesRecentes: 0 };
  }

  const ultima = data[0];
  const ultimoScore = ultima.total > 0 ? Math.round((ultima.certas / ultima.total) * 100) : null;

  // Acerto por disciplina em todas as sessões retornadas
  const discMap = new Map<string, { total: number; certas: number }>();
  for (const s of data as SimuladoSession[]) {
    for (const r of s.respostas) {
      const stat = discMap.get(r.disciplina) ?? { total: 0, certas: 0 };
      stat.total++;
      if (r.acertou) stat.certas++;
      discMap.set(r.disciplina, stat);
    }
  }
  let piorDisc: string | null = null;
  let piorTaxa: number | null = null;
  for (const [disc, stat] of discMap.entries()) {
    if (stat.total < 5) continue; // ignora disciplinas com poucos dados
    const taxa = stat.certas / stat.total;
    if (piorTaxa === null || taxa < piorTaxa) { piorTaxa = taxa; piorDisc = disc; }
  }

  return {
    ultimoScore,
    ultimaData: ultima.created_at,
    disciplinaMaisFraga: piorDisc,
    taxaDisciplinaMaisFraga: piorTaxa !== null ? Math.round(piorTaxa * 100) : null,
    totalSessoesRecentes: data.length,
  };
}

export async function listSimuladoSessions(): Promise<SimuladoSession[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('juris_simulado_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Erro ao listar sessões: ' + error.message);
  return (data ?? []) as SimuladoSession[];
}

async function hydrateInteracoes(rows: JurisInteracao[]): Promise<JurisComInteracao[]> {
  if (rows.length === 0) return [];
  const missingIds = rows
    .map((r) => r.jurisprudencia_id)
    .filter((id) => !getJurisprudenciaById(id));
  const supabaseMap = new Map<string, Jurisprudencia>();
  if (missingIds.length > 0) {
    const supabase = createClient();
    const { data, error } = await supabase.from('jurisprudencias').select('*').in('id', missingIds).is('deleted_at', null);
    if (error) throw new Error('Erro ao buscar jurisprudências: ' + error.message);
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

export interface SimuladoResposta {
  jurisId: string;
  tribunal: string;
  disciplina: string;
  enunciado: string;
  gabarito: boolean;
  resposta: boolean;
  acertou: boolean;
}

export interface SimuladoSession {
  id: string;
  user_id: string;
  total: number;
  certas: number;
  elapsed_secs: number;
  respostas: SimuladoResposta[];
  created_at: string;
}

export async function saveSimuladoSession(input: {
  total: number;
  certas: number;
  elapsedSecs: number;
  respostas: SimuladoResposta[];
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado para salvar o resultado.');

  const { error } = await supabase.from('juris_simulado_sessions').insert({
    user_id:      user.id,
    total:        input.total,
    certas:       input.certas,
    elapsed_secs: input.elapsedSecs,
    respostas:    input.respostas,
  });
  if (error) throw new Error('Erro ao salvar resultado: ' + error.message);
}

export { isJurisDue, jurisDaysOverdue, EMPTY_INTERACAO_FIELDS };
