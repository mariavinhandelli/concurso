// services/reviews.queries.server.ts
// Queries server-side do módulo de revisão.
// Usa lib/supabase/server.ts (cookie-based auth) — nunca importado no client.
// Permite prefetch em Server Components via HydrationBoundary (sem waterfall de hidratação).

import { createClient } from '@/lib/supabase/server';
import { calculateNextReview, daysOverdue } from '@/lib/spaced-repetition';
import { fromDbRow } from '@/lib/spaced-repetition.mapper';
import * as repo from '@/services/reviews.repository';
import type { ReviewItem } from '@/services/reviews.service';

export async function listDueReviewsServer(): Promise<ReviewItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Paralelo: matérias arquivadas + tópicos devidos — sem waterfall sequencial.
  const [archivedResult, rows] = await Promise.all([
    supabase.from('subjects').select('id').eq('user_id', user.id).eq('status', 'arquivado'),
    repo.fetchDueTopicReviews(supabase, user.id),
  ]);

  const excludeSet = new Set((archivedResult.data ?? []).map(s => s.id));
  const filtered = excludeSet.size > 0 ? rows.filter(t => !excludeSet.has(t.subject_id)) : rows;

  return filtered.map(t => {
    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects;
    const srState = fromDbRow({ ease_factor: t.ease_factor, interval_days: t.interval_days, repetitions: t.repetitions });
    return {
      id: t.id,
      name: t.name,
      subjectId: t.subject_id,
      subjectName: subj?.name ?? 'Matéria',
      subjectColor: subj?.color ?? '#C9B8DD',
      nextReviewDate: t.next_review_date,
      overdueDays: daysOverdue(t.next_review_date),
      nextIntervals: {
        dificil:       calculateNextReview(srState, 'dificil').intervalDays,
        intermediario: calculateNextReview(srState, 'bom').intervalDays,
        facil:         calculateNextReview(srState, 'facil').intervalDays,
      },
    };
  });
}
