// lib/streak-calculator.ts
// Algoritmo puro de streak: sem acesso a banco, sem auth.
// Recebe um Set de datas (YYYY-MM-DD) e calcula dias consecutivos.

import { toLocalDateString } from '@/lib/local-date';

export interface StreakResult {
  current: number;
  reviewedToday: boolean;
}

export function calculateStreak(
  reviewDays: Set<string>,
  today: string = toLocalDateString(),
): StreakResult {
  const reviewedToday = reviewDays.has(today);

  const cursor = new Date();
  if (!reviewedToday) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (!reviewDays.has(toLocalDateString(yesterday))) {
      return { current: 0, reviewedToday: false };
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  let current = 0;
  while (reviewDays.has(toLocalDateString(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, reviewedToday };
}
