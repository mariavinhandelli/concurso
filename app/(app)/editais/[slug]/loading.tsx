// Auditoria de performance (02/08) — skeleton aproximado do layout real
// (em vez do spinner genérico de app/(app)/loading.tsx) reduz o salto de
// layout (CLS) quando o conteúdo real substitui o placeholder.
import { PageContainer } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditalDetailLoading() {
  return (
    <PageContainer width="narrow">
      <Skeleton height={32} width="70%" style={{ marginBottom: 8 }} />
      <Skeleton height={16} width="40%" style={{ marginBottom: 24 }} />
      <Skeleton height={140} borderRadius={12} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={48} borderRadius={10} />
        ))}
      </div>
    </PageContainer>
  );
}
