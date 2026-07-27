// app/(app)/progresso/layout.tsx
// M1 — destino ÚNICO de progresso. Antes "como estou indo?" tinha quatro
// endereços (Home/Panorama, /performance, /conquistas, /historico) com métricas
// repetidas; agora é uma página com três abas. As rotas antigas redirecionam
// para cá (deep links, push e bookmarks continuam valendo).
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Tab = 'evolucao' | 'conquistas' | 'historico';

const TABS: { value: Tab; label: string; href: string }[] = [
  { value: 'evolucao',   label: 'Evolução',   href: '/progresso' },
  { value: 'conquistas', label: 'Conquistas', href: '/progresso/conquistas' },
  { value: 'historico',  label: 'Histórico',  href: '/progresso/historico' },
];

function tabFromPath(pathname: string): Tab {
  if (pathname.startsWith('/progresso/conquistas')) return 'conquistas';
  if (pathname.startsWith('/progresso/historico')) return 'historico';
  return 'evolucao';
}

export default function ProgressoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tab = tabFromPath(pathname);

  return (
    <PageContainer width="wide" style={{ minWidth: 0 }}>
      <PageHeader
        title="Progresso"
        subtitle="Evolução, conquistas e histórico — sua preparação inteira num lugar só."
      />
      <div style={{ marginBottom: 24, maxWidth: 480 }}>
        <SegmentedControl
          options={TABS.map(({ value, label }) => ({ value, label }))}
          value={tab}
          onChange={(v) => {
            const alvo = TABS.find((t) => t.value === v);
            if (alvo && alvo.value !== tab) router.push(alvo.href);
          }}
        />
      </div>
      {children}
    </PageContainer>
  );
}
