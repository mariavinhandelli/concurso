// services/jurisRevisao.service.ts
// Apenas a CONTAGEM de revisões de jurisprudência vencidas hoje. Isolada do
// jurisInteracoes.service (perf F1): aquele módulo importa jurisprudencias.service
// → data/jurisprudencias.ts (~766KB). A Home só precisa do número, então
// PlanoHoje/retomada importam daqui e ficam livres daquele bundle.
import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { toLocalDateString } from '@/lib/local-date';

// Join !inner com jurisprudencias filtrando deleted_at null nas 3 funções
// abaixo: sem isso, uma jurisprudência soft-deletada mantém sua interação
// "ativa" contando aqui, mas o hydrate da fila real já a omite silenciosamente
// (jurisInteracoes.service.ts) — a contagem e a fila divergiam (bug real,
// verificado: contagem=1, fila=0, após soft-delete de uma jurisprudência com
// revisão agendada).
export async function countRevisoesHoje(): Promise<number> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return 0;

  const hoje = toLocalDateString();

  const { count, error } = await supabase
    .from('juris_interacoes')
    .select('id, jurisprudencias!inner(deleted_at)', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .lte('next_review_date', hoje)
    .is('jurisprudencias.deleted_at', null);

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

  const { data } = await supabase
    .from('juris_interacoes')
    .select('next_review_date, jurisprudencias!inner(deleted_at)')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .not('next_review_date', 'is', null)
    .is('jurisprudencias.deleted_at', null)
    .order('next_review_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.next_review_date ?? null;
}

export async function getOldestDueJurisDate(): Promise<string | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const { data } = await supabase
    .from('juris_interacoes')
    .select('next_review_date, jurisprudencias!inner(deleted_at)')
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .lte('next_review_date', toLocalDateString())
    .is('jurisprudencias.deleted_at', null)
    .order('next_review_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.next_review_date ?? null;
}
