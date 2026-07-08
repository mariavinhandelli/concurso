// components/layout/AppShell.tsx
// Monta o shell: sidebar (largura reage ao colapso no desktop, vira drawer no mobile)
// + topbar + conteúdo. No mobile o conteúdo ocupa 100% e um overlay fecha o drawer.
'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUI } from './UIContext';
import { CommandPalette } from '@/components/features/command/CommandPalette';
import { theme } from '@/lib/theme';

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed, isMobile, isTablet, mobileOpen, setMobileOpen } = useUI();

  // marginLeft controlado por JS apenas para desktop (colapsado vs expandido).
  // O reset para 0 no mobile é feito via CSS (.shell-main) para evitar FOIC.
  const marginLeft = isMobile ? 0 : (isTablet || collapsed ? 72 : 244);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>
      <Sidebar />

      {/* Overlay do drawer — renderizado sempre, CSS oculta no desktop via pointer-events.
          Evita condicional JS (que causava FOIC no mobile). */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 29,
          background: 'rgba(20, 28, 30, .46)',
          backdropFilter: mobileOpen && isMobile ? 'blur(2px)' : 'none',
          opacity: mobileOpen && isMobile ? 1 : 0,
          pointerEvents: mobileOpen && isMobile ? 'auto' : 'none',
          transition: 'opacity .24s ease',
        }}
      />

      <div
        className="shell-main"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          marginLeft,
          transition: 'margin-left .24s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        <Topbar />
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
