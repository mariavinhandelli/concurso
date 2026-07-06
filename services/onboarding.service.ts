// services/onboarding.service.ts
// Detecta usuário novo (sem concurso-alvo e sem nenhuma sessão registrada)
// para apresentar o wizard de primeiro uso na Home.

import { tryGetUser } from '@/lib/supabase/requireUser';

export interface OnboardingStatus {
  isNew: boolean;
  userId: string | null;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const ctx = await tryGetUser();
  if (!ctx) return { isNew: false, userId: null };
  const { supabase, userId } = ctx;

  const [targets, logs] = await Promise.all([
    supabase.from('target_exams').select('id').eq('user_id', userId).limit(1),
    supabase.from('study_logs').select('id').eq('user_id', userId).limit(1),
  ]);

  // Em caso de erro, não insistir com o wizard — a Home continua utilizável.
  if (targets.error || logs.error) return { isNew: false, userId };

  const isNew = (targets.data?.length ?? 0) === 0 && (logs.data?.length ?? 0) === 0;
  return { isNew, userId };
}
