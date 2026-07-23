'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { theme } from '@/lib/theme';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useUI } from '@/components/layout/UIContext';
import { useUser } from '@/components/layout/UserContext';
import { useTimer } from '@/components/features/timer/TimerContext';
import { useCoachDecision } from '@/hooks/useCoach';
import { useLocalToday } from '@/hooks/useLocalToday';
import { parseLocalDate } from '@/lib/local-date';
import { SemanaPanel } from '@/components/features/home/SemanaPanel';
import { OnboardingGate } from '@/components/features/home/OnboardingWizard';
import { CoachSlot } from '@/components/features/home/CoachSlot';
import { PlanoHoje } from '@/components/features/home/PlanoHoje';
import { TodayBlock } from '@/components/features/home/TodayBlock';
import { MetaSugeridaHint } from '@/components/features/home/MetaSugeridaHint';
import { CoberturaEdital } from '@/components/features/home/CoberturaEdital';
import { MarcoEditalCelebracao } from '@/components/features/home/MarcoEditalCelebracao';
import { RaioXCard } from '@/components/features/home/RaioXCard';
import { UltimaNotaCard } from '@/components/features/home/UltimaNotaCard';
import { TimePieCard } from '@/components/features/home/TimePieCard';
import { JourneyStats } from '@/components/features/home/JourneyStats';
import { PlanoProntoBanner } from '@/components/features/home/PlanoProntoBanner';
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
        <ChevronDown size={16} color={theme.inkFaint} strokeWidth={2.2} style={{ marginLeft: 'auto', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
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

  // Decisor único de coaching (Rodada 3): 1 card no topo + sinal de modo retorno.
  const decision = useCoachDecision();
  const [expandido, setExpandido] = useState(false);
  const returnMode = decision.returnMode && !expandido;

  // "Panorama" começa recolhido (reduz a rolagem diária) e a preferência persiste.
  const [panorama, setPanorama] = usePersistedState<'open' | 'closed'>(
    'home:panorama', 'closed', (v) => (v === 'open' ? 'open' : 'closed'),
  );
  const panoramaOpen = panorama === 'open';

  // Pré-carrega as rotas mais acessadas a partir da Home para navegação instantânea.
  useEffect(() => {
    router.prefetch('/revisar');
    router.prefetch('/flashcards');
    router.prefetch('/conquistas');
  }, [router]);

  // H16 — useLocalToday re-renderiza exatamente à meia-noite; sem isso, uma
  // aba aberta durante a virada mostrava a saudação do dia anterior.
  const todayStr = useLocalToday();
  const hoje = parseLocalDate(todayStr).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <PageContainer width="default">
      {/* Auto-start isolado — não bloqueia o restante da página */}
      <Suspense fallback={null}><TimerAutoStart /></Suspense>

      {/* Onboarding de primeiro uso — só aparece para usuário sem alvo e sem sessões */}
      <OnboardingGate />
      <MarcoEditalCelebracao />

      <PageHeader
        title={nome ? `Olá, ${nome}` : 'Olá'}
        subtitle={hoje.charAt(0).toUpperCase() + hoje.slice(1)}
        actions={(
          <div style={{ flexShrink: isMobile ? 1 : 0, flexBasis: isMobile ? '100%' : 'auto', minWidth: 0 }}>
            <ExamCountdown />
          </div>
        )}
      />

      {/* Decisor único: no máximo UM card de coaching no topo (Rodada 3) */}
      <CoachSlot decision={decision} />

      {/* Flash de boas-vindas ao plano recém-criado pelo onboarding — antes da
          "Esta semana" (streak/missões zeradas), não depois. */}
      <PlanoProntoBanner />

      {/* ── ZONA 1 · Agora — o que fazer neste momento ── */}
      <ZoneHeader label="Agora" />
      <PlanoHoje />

      {decision.loading ? (
        /* Enquanto o decisor não resolve, segura a renderização das zonas abaixo:
           evita pintar o painel completo e colapsá-lo em seguida (layout shift)
           quando o usuário está voltando de um hiato. */
        null
      ) : returnMode ? (
        /* Modo retorno (hiato): acolhe + 1 ação; o resto fica atrás de "ver tudo"
           para não entregar a montanha nem a parede de zeros a quem voltou de longe. */
        <button style={styles.verTudo} onClick={() => setExpandido(true)}>
          Ver painel completo ↓
        </button>
      ) : (
        <>
          <div style={{ marginTop: 16 }}>
            <TodayBlock />
            <MetaSugeridaHint />
          </div>

          {/* ── ZONA 2 · Esta semana — streak + missões + coach num só painel ── */}
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
        </>
      )}
    </PageContainer>
  );
}

export default function Home() {
  return <HomeContent />;
}

const styles: Record<string, React.CSSProperties> = {
  verTudo: { marginTop: 16, width: '100%', padding: '11px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font },
};

const zoneStyles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px 10px' },
  headerBtn: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '2px 2px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: theme.font, textAlign: 'left' },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.inkSoft, flexShrink: 0 },
  hint: { fontSize: 13, color: theme.inkFaint, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
