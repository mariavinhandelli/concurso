// components/layout/AppShell.tsx
// Monta o shell: sidebar (largura reage ao colapso no desktop, vira drawer no mobile)
// + topbar + conteúdo. No mobile o conteúdo ocupa 100% e um overlay fecha o drawer.
'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUI } from './UIContext';
import { theme } from '@/lib/theme';

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed, isMobile, mobileOpen, setMobileOpen } = useUI();

  // No mobile o conteúdo nunca cede espaço pra sidebar (ela vira drawer sobreposto).
  const marginLeft = isMobile ? 0 : collapsed ? 72 : 244;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>
      <Sidebar />

      {/* Overlay do drawer — só no mobile, quando aberto. Fecha ao tocar. */}
      {isMobile && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden={!mobileOpen}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 29, // abaixo da sidebar (30), acima de todo o resto
            background: 'rgba(20, 28, 30, .46)',
            backdropFilter: 'blur(2px)',
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? 'auto' : 'none',
            transition: 'opacity .24s ease',
          }}
        />
      )}

      <div
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
    </div>
  );
}