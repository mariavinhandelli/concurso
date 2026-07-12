// lib/analytics.ts
// Instrumentação de produto (Rodada 3). track() é fire-and-forget e NUNCA lança —
// nenhum evento pode quebrar ou atrasar uma ação do usuário. Chame direto, sem
// await: track(EV.studyCompleted, { minutes }). Só roda no cliente (usa o browser
// client) e só registra se houver sessão. Nomes centralizados em EV para evitar
// drift de string — adicionar um evento = adicionar uma constante aqui.

import { createClient } from '@/lib/supabase/client';

export const EV = {
  appOpened: 'app_opened',
  studyStarted: 'study_started',
  studyCompleted: 'study_completed',
  goalAdjusted: 'goal_adjusted',
  pushEnabled: 'push_enabled',
  pushDisabled: 'push_disabled',
  dormantOpened: 'dormant_module_opened',
  celebrationShown: 'celebration_shown',
  pactSet: 'pact_set',
  coachShown: 'coach_shown',
  lightPlanShown: 'light_plan_shown',
  socialEnabled: 'social_enabled',
  friendRequested: 'friend_requested',
  friendAccepted: 'friend_accepted',
  turmaCreated: 'turma_created',
  turmaJoined: 'turma_joined',
} as const;

export type EventName = typeof EV[keyof typeof EV];

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  // Dispara em segundo plano; o call-site nunca espera nem trata erro.
  void (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('events').insert({
        user_id: user.id,
        name,
        props,
        client_ts: new Date().toISOString(),
      });
    } catch {
      /* instrumentação é best-effort — silencia qualquer falha */
    }
  })();
}
