// services/jurisRevisao.service.ts
// Apenas a CONTAGEM de revisões de jurisprudência vencidas hoje. Isolada do
// jurisInteracoes.service (perf F1): aquele módulo importa jurisprudencias.service
// → data/jurisprudencias.ts (~766KB). A Home só precisa do número, então
// PlanoHoje/retomada importam daqui e ficam livres daquele bundle.
import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { toLocalDateString } from '@/lib/local-date';

export async function countRevisoesHoje(): Promise<number> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return 0;

  const hoje = toLocalDateString();

  const { count, error } = await supabase
    .from('juris_interacoes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_review_active', true)
    .lte('next_review_date', hoje);

  if (error) return 0;
  return count ?? 0;
}
