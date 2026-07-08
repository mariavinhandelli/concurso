// app/(app)/layout.tsx
// Shell das telas logadas: providers de UI + usuário + timer global + sidebar + topbar + conteúdo.
import { UIProvider } from '@/components/layout/UIContext';
import { UserProvider } from '@/components/layout/UserContext';
import { AppShell } from '@/components/layout/AppShell';
import { TimerProvider } from '@/components/features/timer/TimerContext';
import { FloatingTimer } from '@/components/features/timer/FloatingTimer';
import { FocusMode } from '@/components/features/timer/FocusMode';
import { ToastProvider } from '@/components/ui/ToastProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <UserProvider>
        <TimerProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <FloatingTimer />
            <FocusMode />
          </ToastProvider>
        </TimerProvider>
      </UserProvider>
    </UIProvider>
  );
}