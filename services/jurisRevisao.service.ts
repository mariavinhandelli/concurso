// services/jurisRevisao.service.ts
// Apenas a CONTAGEM de revisões de jurisprudência vencidas hoje. Isolada do
// jurisInteracoes.service (perf F1): aquele módulo importa jurisprudencias.service
// → data/jurisprudencias.ts (~766KB). A Home só precisa do número, então
// PlanoHoje/retomada importam daqui e ficam livres daquele bundle.
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCachedUser } from '@/lib/supabase/authCache';
import { toLocalDateString } from '@/lib/local-date';

// A auditoria de 23/07 dropou a FK juris_interacoes.jurisprudencia_id →
// jurisprudencias(id) (migração juris_interacoes_drop_fk_static_bank): as 154
// jurisprudências do banco oficial vivem só no bundle estático, então toda
// interação com elas violava a FK (23503 engolido). Sem essa FK, o embed
// PostgREST `jurisprudencias!inner(...)` usado aqui antes NÃO resolve mais —
// falha sempre com PGRST200 ("could not find relationship"), por isso o
// Plano de Hoje ficava preso em "não consegui verificar" mesmo com retry (o
// erro é de schema, não de rede). Substituído por exclusão explícita das
// jurisprudências PRÓPRIAS soft-deletadas (RLS já escopa a leitura por
// created_by = auth.uid()) — sem depender de FK/embed.
async function getDeletedJurisIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('jurisprudencias')
    .select('id')
    .not('deleted_at', 'is', null);
  if (error) throw new Error('Erro ao verificar jurisprudências excluídas: ' + error.message);
  return (data ?? []).map((r) => r.id as string);
}

export async function countRevisoesHoje(): Promise<number> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return 0;

  const hoje = toLocalDateString();
  const deletedIds = await getDeletedJurisIds(supabase);

  const base = supabase
    .from('juris_interacoes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .lte('next_review_date', hoje);
  const query = deletedIds.length > 0 ? base.not('jurisprudencia_id', 'in', `(${deletedIds.join(',')})`) : base;

  const { count, error } = await query;
  // H11 — não engolir erro como 0: viraria "tudo em dia" falso no Plano de Hoje.
  if (error) throw new Error('Erro ao contar revisões de jurisprudência: ' + error.message);
  return count ?? 0;
}

// Data da próxima jurisprudência agendada (para o empty state da fila de
// revisão) — sem o filtro lte: pode cair no futuro, diferente de getOldestDueJurisDate.
export async function getNextScheduledJurisDate(): Promise<string | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const deletedIds = await getDeletedJurisIds(supabase);
  const base = supabase
    .from('juris_interacoes')
    .select('next_review_date')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null);
  const query = deletedIds.length > 0 ? base.not('jurisprudencia_id', 'in', `(${deletedIds.join(',')})`) : base;

  const { data } = await query.order('next_review_date', { ascending: true }).limit(1).maybeSingle();
  return data?.next_review_date ?? null;
}

export async function getOldestDueJurisDate(): Promise<string | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const deletedIds = await getDeletedJurisIds(supabase);
  const base = supabase
    .from('juris_interacoes')
    .select('next_review_date')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .lte('next_review_date', toLocalDateString());
  const query = deletedIds.length > 0 ? base.not('jurisprudencia_id', 'in', `(${deletedIds.join(',')})`) : base;

  const { data } = await query.order('next_review_date', { ascending: true }).limit(1).maybeSingle();
  return data?.next_review_date ?? null;
}
