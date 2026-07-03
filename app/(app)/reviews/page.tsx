// app/(app)/reviews/page.tsx
// Server Component: prefetch em servidor → cliente recebe dados já prontos via HydrationBoundary.
// Elimina o waterfall hidratação → fetch → spinner visível ao usuário.

import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { REVIEWS_DUE_KEY } from '@/hooks/reviews.keys';
import { listDueReviewsServer } from '@/services/reviews.queries.server';
import { ReviewsClient } from './ReviewsClient';

export default async function ReviewsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: REVIEWS_DUE_KEY,
    queryFn: listDueReviewsServer,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReviewsClient />
    </HydrationBoundary>
  );
}
