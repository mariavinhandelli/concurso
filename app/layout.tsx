import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { QueryProvider } from "@/components/providers/QueryProvider";

// Removido weight "500" — economiza ~40 KB; browsers interpolam 400 ou 600 sem impacto visual.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: 'Focali',
  description: 'Clareza para evoluir. Plataforma de estudos de alta performance para concursos.',
  metadataBase: new URL('https://www.focali.com.br'),
  manifest: '/manifest.json',
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/*
          Script síncrono — roda ANTES do primeiro paint e aplica data-mode /
          data-palette ao <html>, eliminando o flash de tema errado (FOUC).
          Não pode ser async/defer; precisa bloquear o parser intencionalmente.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('ui:mode')||localStorage.getItem('ui:theme')||'light';var p=localStorage.getItem('ui:palette')||'petroleo';var vp=['petroleo','rose','menta','grafite'];if(!vp.includes(p))p='petroleo';if(m!=='dark')m='light';var r=document.documentElement;r.setAttribute('data-mode',m);r.setAttribute('data-palette',p);}catch(e){}})();`,
          }}
        />
        <QueryProvider>{children}</QueryProvider>
        <PwaRegister />
      </body>
    </html>
  );
}