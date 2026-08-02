// Auditoria de performance (02/08) — skeleton aproximado do layout real
// (em vez do spinner genérico de app/(app)/loading.tsx) reduz o salto de
// layout (CLS) quando o conteúdo real substitui o placeholder.
import { PageContainer } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';

export default function JurisprudenciaDetailLoading() {
  return (
    <PageContainer width="default">
      <Skeleton height={14} width={140} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Skeleton height={22} width={90} borderRadius={6} />
        <Skeleton height={22} width={110} borderRadius={6} />
      </div>
      <Skeleton height={30} width="80%" style={{ marginBottom: 20 }} />
      <Skeleton height={200} borderRadius={12} />
    </PageContainer>
  );
}
