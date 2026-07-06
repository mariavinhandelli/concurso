'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { useUser } from '@/components/layout/UserContext';
import { useTimer } from '@/components/features/timer/TimerContext';
import { StreakBar } from '@/components/features/streak/StreakBar';
import { OnboardingGate } from '@/components/features/home/OnboardingWizard';
import { PlanoHoje } from '@/components/features/home/PlanoHoje';
import { TodayBlock } from '@/components/features/home/TodayBlock';
import { CoberturaEdital } from '@/components/features/home/CoberturaEdital';
import { MarcoEditalCelebracao } from '@/components/features/home/MarcoEditalCelebracao';
import { RaioXCard } from '@/components/features/home/RaioXCard';
import { MissoesSemana } from '@/components/features/home/MissoesSemana';
import { CoachSemanal } from '@/components/features/home/CoachSemanal';
import { UltimaNotaCard } from '@/components/features/home/UltimaNotaCard';
import { TimePieCard } from '@/components/features/home/TimePieCard';
import { JourneyStats } from '@/components/features/home/JourneyStats';
import { ExamCountdown } from '@/components/features/dashboard/ExamCountdown';

// Componente mínimo isolado no Suspense — usa useSearchParams apenas para
// o auto-start do timer via ?topicId=, sem bloquear a renderização da Home.
function TimerAutoStart() {
  const params = useSearchParams();
  const { status, start } = useTimer();
  const didAutoStart = useRef(false);

  useEffect(() => {
    const topicId = params.get('topicId');
    if (topicId && !didAutoStart.current && status === 'idle') {
      didAutoStart.current = true;
      start({ mode: 'teoria', topicId, subjectId: params.get('subjectId') });
      window.history.replaceState(null, '', '/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, status]);

  return null;
}

function HomeContent() {
  const router = useRouter();
  const { name: nome } = useUser();
  const { isMobile } = useUI();

  // Pré-carrega as rotas mais acessadas a partir da Home para navegação instantânea.
  useEffect(() => {
    router.prefetch('/reviews');
    router.prefetch('/flashcards');
    router.prefetch('/conquistas');
  }, [router]);

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div style={{ ...styles.wrap, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      {/* Auto-start isolado — não bloqueia o restante da página */}
      <Suspense fallback={null}><TimerAutoStart /></Suspense>

      {/* Onboarding de primeiro uso — só aparece para usuário sem alvo e sem sessões */}
      <OnboardingGate />
      <MarcoEditalCelebracao />

      <div style={styles.topbar}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>{nome ? `Olá, ${nome}` : 'Olá'}</h1>
          <p style={styles.sub}>{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</p>
        </div>
        <div style={{
          ...styles.countdownSlot,
          flexShrink: isMobile ? 1 : 0,
          flexBasis: isMobile ? '100%' : 'auto',
          minWidth: 0,
        }}>
          <ExamCountdown />
        </div>
      </div>

      <CoachSemanal />

      <PlanoHoje />

      <div style={{ marginTop: 16 }}>
        <TodayBlock />
      </div>

      <div style={{ marginTop: 16 }}>
        <UltimaNotaCard />
      </div>

      <div style={{ marginTop: 16 }}>
        <CoberturaEdital />
      </div>

      <div style={{ marginTop: 16 }}>
        <RaioXCard />
      </div>

      <div style={{ marginTop: 16 }}>
        <MissoesSemana />
      </div>

      <div style={{ ...styles.streakStrip, marginBottom: 16, marginTop: 16 }}>
        <StreakBar />
      </div>

      <TimePieCard />

      <div style={{ marginTop: 16 }}>
        <JourneyStats />
      </div>
    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 960, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '4px 0 0', fontWeight: 500 },
  countdownSlot: { flexShrink: 0, minWidth: 0 },
  streakStrip: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16, marginBottom: 16, minWidth: 0 },
};
