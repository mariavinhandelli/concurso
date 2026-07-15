// app/(app)/editais/page.tsx
// Banco de Editais — versão PÚBLICA e linkável do catálogo (SEO/aquisição).
// Logada, a usuária costuma chegar pela aba "Banco de editais" em /targets;
// esta página reusa exatamente o mesmo componente. As ações de importação
// levam para /targets (que exige login).
'use client';

import { useRouter } from 'next/navigation';
import { BancoEditaisTab } from '@/components/features/targets/BancoEditaisTab';
import { PageContainer, PageHeader } from '@/components/ui/Page';

export default function EditaisPage() {
  const router = useRouter();
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Banco de Editais"
        subtitle="Concursos organizados por órgão, com grade verticalizada, pesos por disciplina, linha do tempo e provas anteriores."
      />
      <BancoEditaisTab
        onImportar={() => router.push('/targets')}
        onImportarPdf={() => router.push('/targets')}
      />
    </PageContainer>
  );
}
