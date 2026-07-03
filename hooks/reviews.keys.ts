// hooks/reviews.keys.ts
// Query keys do módulo de revisão — sem 'use client' para poder ser importado
// tanto em Server Components (page.tsx SSR) quanto em Client Components (useReviews).
export const REVIEWS_DUE_KEY = ['reviews', 'due'] as const;
export const FLASHCARD_COUNT_KEY = ['flashcards', 'count', 'daily'] as const;
