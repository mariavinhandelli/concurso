// app/(app)/page.tsx
'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

import { useTimer } from '@/components/features/timer/TimerContext';
import { StreakBar } from '@/components/features/streak/StreakBar';
import { NextTopicCard } from '@/components/features/home/NextTopicCard';
import { TodayBlock } from '@/components/features/home/TodayBlock';
import { TimePieCard } from '@/components/features/home/TimePieCard';
import { ExamCountdown } from '@/components/features/dashboard/ExamCountdown';

function HomeContent() {
  const params = useSearchParams();
  const timer = useTimer();
  const { isMobile } = useUI();

  const topicId = params.get('topicId');
  const subjectId = params.get('subjectId');
  const didAutoStart = useRef(false);

  // Saudação com nome do perfil.
  const [nome, setNome] = useState<string>('');
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser()
      .then(({ data }) => {
        const meta = data.user?.user_metadata;
        const display = meta?.display_name || meta?.full_name || meta?.name || '';
        setNome(display ? String(display).split(' ')[0].slice(0, 40) : '');
      })
      .catch(() => {});
  }, []);

  // Auto-iniciar o timer global quando vier com ?topicId= (ex: "Estudar este tópico").
  // Só dispara se não houver sessão em andamento, e limpa a URL pra um F5 não repetir.
  useEffect(() => {
    if (topicId && !didAutoStart.current && timer.status === 'idle') {
      didAutoStart.current = true;
      timer.start({ mode: 'teoria', topicId, subjectId });
      window.history.replaceState(null, '', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, timer.status]);

  // Data de hoje por extenso (pt-BR).
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div style={{ ...styles.wrap, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      {/* cabeçalho: saudação + data da prova no topo */}
      <div style={styles.topbar}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>{nome ? `Olá, ${nome}` : 'Olá'}</h1>
          <p style={styles.sub}>{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</p>
        </div>
        {/* No mobile o countdown vira uma linha própria, ocupando 100% e podendo encolher. */}
        <div style={{
          ...styles.countdownSlot,
          flexShrink: isMobile ? 1 : 0,
          flexBasis: isMobile ? '100%' : 'auto',
          minWidth: 0,
        }}>
          <ExamCountdown />
        </div>
      </div>

      {/* Próximo tópico sugerido */}
      <div style={{ marginBottom: 16 }}>
        <NextTopicCard />
      </div>

      {/* Constância — faixa contínua de ponta a ponta, sozinha */}
      <div style={styles.streakStrip}>
        <StreakBar />
      </div>

      {/* Bloco de hoje: pendentes (revisões + flashcards) + meta e acerto */}
      <TodayBlock />

      {/* Tempo de estudo por disciplina — pizza + navegação de período */}
      <div style={{ marginTop: 16 }}>
        <TimePieCard />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 980, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, gap: 16, flexWrap: 'wrap' },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '4px 0 0', fontWeight: 500 },
  countdownSlot: { flexShrink: 0 },
  streakStrip: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16, marginBottom: 16, minWidth: 0 },
};