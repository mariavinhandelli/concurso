// services/retomada.service.ts
// Modo Retomada (M4): detecta quando o usuário volta após um hiato (≥ 4 dias sem
// estudar) para que a Home o receba com acolhimento — e não com a montanha de
// revisões vencidas, que é justamente o gatilho de abandono no momento mais
// frágil. Não altera nenhum dado de revisão; apenas informa o estado para a UI
// oferecer um "recomeço leve" (fila com teto).

import { tryGetUser } from '@/lib/supabase/requireUser';
import { toLocalDateString, parseLocalDate } from '@/lib/local-date';
import { countDueReviews } from '@/services/reviews.service';
import { countDueCards } from '@/services/flashcards.service';
import { countRevisoesDue } from '@/services/leiInteracoes.service';
import { countRevisoesHoje } from '@/services/jurisRevisao.service';

export const HIATO_MIN_DIAS = 4;

export interface RetomadaStatus {
  isHiato: boolean;
  diasAusente: number;   // dias desde a última sessão registrada
  pendencias: number;    // total acumulado nas quatro filas de revisão
}

const NEUTRO: RetomadaStatus = { isHiato: false, diasAusente: 0, pendencias: 0 };

export async function getRetomadaStatus(): Promise<RetomadaStatus> {
  const auth = await tryGetUser();
  if (!auth) return NEUTRO;

  const { data } = await auth.supabase
    .from('study_logs')
    .select('started_at')
    .eq('user_id', auth.userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Nunca estudou → é caso de onboarding, não de retomada.
  if (!data?.started_at) return NEUTRO;

  const hoje = toLocalDateString();
  const ultimo = toLocalDateString(new Date(data.started_at));
  const diasAusente = Math.round(
    (parseLocalDate(hoje).getTime() - parseLocalDate(ultimo).getTime()) / 86_400_000,
  );

  if (diasAusente < HIATO_MIN_DIAS) return { ...NEUTRO, diasAusente };

  // Só busca as contagens quando de fato houve hiato (evita 4 queries à toa).
  const [rev, cards, lei, juris] = await Promise.all([
    countDueReviews().catch(() => 0),
    countDueCards().catch(() => 0),
    countRevisoesDue().catch(() => 0),
    countRevisoesHoje().catch(() => 0),
  ]);

  return { isHiato: true, diasAusente, pendencias: rev + cards + lei + juris };
}
