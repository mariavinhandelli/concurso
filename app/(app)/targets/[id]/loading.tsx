// Auditoria de performance (02/08) — skeleton aproximado do layout real
// (em vez do spinner genérico de app/(app)/loading.tsx) reduz o salto de
// layout (CLS) quando o conteúdo real substitui o placeholder.
import { PageContainer } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';

export default function TargetDetailLoading() {
  return (
    <PageContainer width="narrow">
      <Skeleton height={32} width="60%" style={{ marginBottom: 8 }} />
      <Skeleton height={16} width="35%" style={{ marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={72} borderRadius={12} />
        ))}
      </div>
      <Skeleton height={220} borderRadius={12} style={{ marginBottom: 16 }} />
      <Skeleton height={160} borderRadius={12} />
    </PageContainer>
  );
}
