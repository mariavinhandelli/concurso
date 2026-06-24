// app/(app)/layout.tsx
// Shell das telas logadas: provider de UI + timer global + sidebar + topbar + conteúdo.
import { UIProvider } from '@/components/layout/UIContext';
import { AppShell } from '@/components/layout/AppShell';
import { TimerProvider } from '@/components/features/timer/TimerContext';
import { FloatingTimer } from '@/components/features/timer/FloatingTimer';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <TimerProvider>
        <AppShell>{children}</AppShell>
        <FloatingTimer />
      </TimerProvider>
    </UIProvider>
  );
}