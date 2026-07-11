'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { countDailyQueue } from '@/services/flashcards.service';
import { theme } from '@/lib/theme';

const SKEL: React.CSSProperties = {
  background: 'rgba(15,23,42,.07)',
  borderRadius: 8,
  animationName: 'skeleton-pulse',
  animationDuration: '1.5s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
};

export function FlashcardsToday() {
  const router = useRouter();
  const [counts, setCounts] = useState<{ pending: number; news: number } | null>(null);

  useEffect(() => {
    countDailyQueue().then(setCounts).catch(() => setCounts({ pending: 0, news: 0 }));
  }, []);

  const total = counts ? counts.pending + counts.news : 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Flashcards de hoje</span>
        <Link href="/flashcards" style={styles.manage}>Gerenciar</Link>
      </div>

      {counts === null ? (
        <div style={styles.skeletonBody}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ ...SKEL, width: 64, height: 38 }} />
            <div style={{ ...SKEL, width: 1, height: 28, borderRadius: 1 }} />
            <div style={{ ...SKEL, width: 64, height: 38 }} />
          </div>
          <div style={{ ...SKEL, width: '100%', height: 44, borderRadius: 12, marginTop: 'auto' }} />
        </div>
      ) : total === 0 ? (
        <div style={styles.allDone}>
          <span style={styles.checkDot}>✓</span> Nenhum card pendente hoje
        </div>
      ) : (
        <div style={styles.body}>
          <div style={styles.counts}>
            <div style={styles.countBox}>
              <span style={styles.num}>{counts.pending}</span>
              <span style={styles.label}>revisões</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.countBox}>
              <span style={{ ...styles.num, color: theme.teal }}>{counts.news}</span>
              <span style={styles.label}>novos</span>
            </div>
          </div>
          <button onClick={() => router.push('/flashcards?study=now')} style={styles.startBtn}>
            Iniciar revisão
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%', fontFamily: theme.font, display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  manage: { fontSize: 13, color: theme.teal, fontWeight: 500, textDecoration: 'none' },
  skeletonBody: { display: 'flex', flexDirection: 'column', flex: 1, gap: 12 },
  allDone: { color: theme.ok, fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 },
  checkDot: {
    width: 20, height: 20, borderRadius: '50%', background: theme.okBg, color: theme.ok,
    display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
  },
  body: { display: 'flex', flexDirection: 'column', height: '100%' },
  counts: { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 'auto' },
  countBox: { display: 'flex', flexDirection: 'column', gap: 2 },
  divider: { width: 1, height: 32, background: theme.line },
  num: { fontSize: 36, color: theme.ink, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  label: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  startBtn: {
    width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
    background: theme.teal, color: theme.onTeal, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 16, transition: 'all .15s',
  },
};
