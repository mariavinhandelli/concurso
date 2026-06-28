import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: 'Focali',
  description: 'Clareza para evoluir. Plataforma de estudos de alta performance para concursos.',
  metadataBase: new URL('https://www.focali.com.br'),
  openGraph: {
    title: 'Focali — Clareza para evoluir.',
    description: 'Plataforma de estudos de alta performance para concursos. Organize seu foco, acompanhe seu progresso e evolua com inteligência.',
    url: 'https://www.focali.com.br',
    siteName: 'Focali',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Focali — Clareza para evoluir.',
    description: 'Plataforma de estudos de alta performance para concursos.',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}