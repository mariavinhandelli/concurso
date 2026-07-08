'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { theme } from '@/lib/theme';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useUI } from '@/components/layout/UIContext';
import { useUser } from '@/components/layout/UserContext';
import { useTimer } from '@/components/features/timer/TimerContext';
import { SemanaPanel } from '@/components/features/home/SemanaPanel';
import { OnboardingGate } from '@/components/features/home/OnboardingWizard';
import { RetaFinalCard } from '@/components/features/home/RetaFinalCard';
import { RetomadaCard } from '@/components/features/home/RetomadaCard';
import { PlanoHoje } from '@/components/features/home/PlanoHoje';
import { TodayBlock } from '@/components/features/home/TodayBlock';
import { CoberturaEdital } from '@/components/features/home/CoberturaEdital';
import { MarcoEditalCelebracao } from '@/components/features/home/MarcoEditalCelebracao';
import { RaioXCard } from '@/components/features/home/RaioXCard';
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

// Rótulo de zona: estrutura a Home em blocos mentais ("Agora", "Esta semana",
// "Panorama") em vez de uma pilha única de cards. O "Panorama" é colapsável.
function ZoneHeader({
  label, hint, collapsible, open, onToggle,
}: {
  label: string;
  hint?: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const inner = (
    <>
      <span style={zoneStyles.label}>{label}</span>
      {hint && <span style={zoneStyles.hint}>{hint}</span>}
      {collapsible && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
      )}
    </>
  );
  if (collapsible) {
    return <button onClick={onToggle} style={zoneStyles.headerBtn} aria-expanded={open}>{inner}</button>;
  }
  return <div style={zoneStyles.header}>{inner}</div>;
}

function HomeContent() {
  const router = useRouter();
  const { name: nome } = useUser();
  const { isMobile } = useUI();

  // "Panorama" começa recolhido (reduz a rolagem diária) e a preferência persiste.
  const [panorama, setPanorama] = usePersistedState<'open' | 'closed'>(
    'home:panorama', 'closed', (v) => (v === 'open' ? 'open' : 'closed'),
  );
  const panoramaOpen = panorama === 'open';

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

      <RetaFinalCard />

      <RetomadaCard />

      {/* ── ZONA 1 · Agora — o que fazer neste momento ── */}
      <ZoneHeader label="Agora" />
      <PlanoHoje />
      <div style={{ marginTop: 16 }}>
        <TodayBlock />
      </div>

      {/* ── ZONA 2 · Esta semana — streak (laço central) + missões + coach num só painel ── */}
      <div style={{ marginTop: 28 }}>
        <ZoneHeader label="Esta semana" />
      </div>
      <SemanaPanel />

      {/* ── ZONA 3 · Panorama — progresso e estatísticas (colapsável) ── */}
      <div style={{ marginTop: 28 }}>
        <ZoneHeader
          label="Panorama"
          hint={panoramaOpen ? undefined : 'progresso, cobertura e estatísticas'}
          collapsible
          open={panoramaOpen}
          onToggle={() => setPanorama(panoramaOpen ? 'closed' : 'open')}
        />
      </div>
      {panoramaOpen && (
        <div style={{ marginTop: 4 }}>
          <CoberturaEdital />
          <div style={{ marginTop: 16 }}>
            <RaioXCard />
          </div>
          <div style={{ marginTop: 16 }}>
            <UltimaNotaCard />
          </div>
          <div style={{ marginTop: 16 }}>
            <TimePieCard />
          </div>
          <div style={{ marginTop: 16 }}>
            <JourneyStats />
          </div>
        </div>
      )}
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
};

const zoneStyles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px 10px' },
  headerBtn: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '2px 2px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: theme.font, textAlign: 'left' },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.inkSoft, flexShrink: 0 },
  hint: { fontSize: 12.5, color: theme.inkFaint, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
