// app/(app)/editais/layout.tsx
// Metadata do Banco de Editais (público/indexável). As páginas de edital e
// de órgão sobrescrevem via generateMetadata próprio.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Banco de Editais de Concursos | Focali',
  description:
    'Editais de concursos públicos organizados por órgão: grade verticalizada, pesos por disciplina, linha do tempo de retificações, provas anteriores e histórico. PC-GO, PM-GO, TJ-GO, TCE-GO e mais.',
  alternates: { canonical: '/editais' },
  // Sem openGraph próprio, o compartilhamento cai no OG genérico da home.
  openGraph: {
    title: 'Banco de Editais de Concursos | Focali',
    description:
      'Editais de concursos organizados por órgão: grade verticalizada, pesos por disciplina, linha do tempo e provas anteriores.',
    url: '/editais',
  },
};

export default function EditaisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
