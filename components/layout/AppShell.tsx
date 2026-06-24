// components/layout/AppShell.tsx
// Monta o shell: sidebar (largura reage ao colapso) + topbar + conteúdo.
'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUI } from './UIContext';
import { theme } from '@/lib/theme';

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed } = useUI();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: collapsed ? 72 : 244,
          transition: 'margin-left .24s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        <Topbar />
        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}