// services/flashcard-streak.service.ts
// Busca as datas de revisão do banco e delega o cálculo para lib/streak-calculator.ts.

import { tryGetUser } from '@/lib/supabase/requireUser';
import { toLocalDateString } from '@/lib/local-date';
import { calculateStreak } from '@/lib/streak-calculator';
import * as repo from '@/services/flashcards.repository';

export interface FlashcardStreak {
  current: number;
  reviewedToday: boolean;
}

export async function getFlashcardStreak(): Promise<FlashcardStreak> {
  const auth = await tryGetUser();
  if (!auth) return { current: 0, reviewedToday: false };

  // Janela de 90 dias é suficiente para streaks realistas.
  const since = new Date();
  since.setDate(since.getDate() - 90);
  since.setHours(0, 0, 0, 0);

  const rows = await repo.fetchReviewDates(auth.supabase, auth.userId, since);

  const reviewDays = new Set<string>();
  for (const row of rows) {
    if (row.last_reviewed) {
      reviewDays.add(toLocalDateString(new Date(row.last_reviewed)));
    }
  }

  return calculateStreak(reviewDays);
}
