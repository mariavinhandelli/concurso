// services/userFeatures.service.ts
// Leitura (client-side) do feature store da IA invisível. Nunca lança: qualquer
// falha degrada para DEFAULT_FEATURES — nenhuma decisão adaptativa pode quebrar
// ou atrasar a UX. A tabela é somente-leitura para o cliente (escrita é do cron).

import { tryGetUser } from '@/lib/supabase/requireUser';
import { DEFAULT_FEATURES, mapUserFeaturesRow, type UserFeatures, type UserFeaturesRow } from '@/lib/user-features';

export type { UserFeatures } from '@/lib/user-features';
export { DEFAULT_FEATURES, srsModifierFor } from '@/lib/user-features';

export async function getUserFeatures(): Promise<UserFeatures> {
  try {
    const ctx = await tryGetUser();
    if (!ctx) return DEFAULT_FEATURES;
    const { data } = await ctx.supabase
      .from('user_features')
      .select('days_since_study, active_days_14d, median_session_min, peak_hour, churn_score, plan_scale, floor_minutes, srs_adjust')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    return mapUserFeaturesRow((data as UserFeaturesRow | null) ?? null);
  } catch {
    return DEFAULT_FEATURES;
  }
}
