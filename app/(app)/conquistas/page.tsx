// app/(app)/conquistas/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { getBadgeState, type BadgeState, type Badge, type BadgeFamily } from '@/services/badges.service';

const FAMILY_LABELS: Record<BadgeFamily, { title: string; subtitle: string }> = {
  volume: { title: 'Volume', subtitle: 'Questões resolvidas ao longo da jornada.' },
  tempo: { title: 'Tempo de estudo', subtitle: 'Horas cronometradas acumuladas.' },
  maestria: { title: 'Maestria', subtitle: 'Volume com qualidade — acerto sustentado.' },
  consistencia: { title: 'Consistência', subtitle: 'Dias seguidos de estudo — o hábito que sustenta tudo.' },
};

const TIER_COLORS: Record<string, string> = {
  bronze: '#A9744F',
  prata: '#8C97A1',
  ouro: '#C9A227',
};

export default function ConquistasPage() {
  const { isMobile } = useUI();
  const [state, setState] = useState<BadgeState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBadgeState().then((s) => {
      setState(s);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ ...styles.page, padding: isMobile ? '20px 16px' : '34px 40px' }}>
        <div style={styles.header}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Conquistas</h1>
          <p style={styles.sub}>Carregando suas conquistas…</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ ...styles.page, padding: isMobile ? '20px 16px' : '34px 40px' }}>
        <div style={styles.header}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Conquistas</h1>
          <p style={styles.sub}>Você precisa estar logado para ver suas conquistas.</p>
        </div>
      </div>
    );
  }

  const pct = state.totalCount > 0 ? (state.unlockedCount / state.totalCount) * 100 : 0;

  // Agrupa por família, preservando a ordem volume → tempo → maestria.
  const families: BadgeFamily[] = ['volume', 'tempo', 'maestria', 'consistencia'];
  const byFamily = families.map((f) => ({
    family: f,
    badges: state.badges.filter((b) => b.family === f),
  }));

  return (
    <div style={{ ...styles.page, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 30 }}>Conquistas</h1>
        <p style={styles.sub}>Marcos da sua preparação — esforço e qualidade, lado a lado.</p>
      </div>

      {/* Resumo de progresso geral */}
      <div style={styles.summary}>
        <div style={styles.summaryTop}>
          <span style={styles.summaryCount}>
            {state.unlockedCount}<span style={styles.summaryTotal}> / {state.totalCount}</span>
          </span>
          <span style={styles.summaryLabel}>conquistadas</span>
        </div>
        <div style={styles.summaryTrack}>
          <div style={{ ...styles.summaryFill, width: `${pct}%` }} />
        </div>
      </div>

      {/* Grupos por família */}
      {byFamily.map(({ family, badges }) => (
        <section key={family} style={styles.section}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>{FAMILY_LABELS[family].title}</h2>
            <p style={styles.sectionSub}>{FAMILY_LABELS[family].subtitle}</p>
          </div>
          <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
            {badges.map((b) => (
              <BadgeCard key={b.id} badge={b} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const { unlocked, family, tier, progress } = badge;

  // Cor de destaque: tier para maestria, teal para o resto.
  const accent = unlocked
    ? family === 'maestria' && tier
      ? TIER_COLORS[tier]
      : theme.teal
    : theme.inkFaint;

 const restante = Math.max(0, badge.target - badge.current);
  const faltaTexto =
    badge.hint !== undefined && badge.hint !== ''
      ? badge.hint
      : badge.unit === '%'
      ? `faltam ${restante}% de acerto`
      : badge.unit === 'horas'
      ? `faltam ${restante}h`
      : badge.unit === 'dias'
      ? `faltam ${restante} dias`
      : `faltam ${restante.toLocaleString('pt-BR')} questões`;

  return (
    <div
      style={{
        ...styles.badge,
        opacity: unlocked ? 1 : 0.55,
        borderColor: unlocked ? accent + '55' : theme.line,
      }}
    >
      <div style={{ ...styles.iconWrap, background: unlocked ? accent + '18' : theme.muted }}>
        <BadgeIcon family={family} color={accent} />
      </div>

      <div style={styles.badgeBody}>
        <span style={styles.badgeLabel}>{badge.label}</span>
        <span style={styles.badgeDesc}>{badge.description}</span>
      </div>

      {unlocked ? (
        <div style={{ ...styles.statusPill, color: accent, background: accent + '14' }}>
          <CheckIcon color={accent} />
          Conquistada
        </div>
      ) : (
        <div style={styles.lockedFoot}>
          <div style={styles.progTrack}>
            <div style={{ ...styles.progFill, width: `${progress * 100}%` }} />
          </div>
          <span style={styles.faltaText}>{faltaTexto}</span>
        </div>
      )}
    </div>
  );
}

function BadgeIcon({ family, color }: { family: BadgeFamily; color: string }) {
  const common = { width: 22, height: 22, fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (family === 'volume') {
    // pilha / lista de questões
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M9 5h10M9 12h10M9 19h10" />
        <path d="M4 5h.01M4 12h.01M4 19h.01" />
      </svg>
    );
  }
  if (family === 'tempo') {
    // relógio
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    );
  }
  if (family === 'consistencia') {
    // raio — energia / sequência
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M6 9.7a8 8 0 1 0 10.4-1.4Q16 12 12 13q3-6-2-12q0 5-4 8.7" />
      </svg>
    );
  }
  // maestria — alvo
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M11.146 7.023C11.526 6.34 11.716 6 12 6s.474.34.854 1.023l.098.176c.108.194.162.29.246.354c.085.064.19.088.4.135l.19.044c.738.167 1.107.25 1.195.532s-.164.577-.667 1.165l-.13.152c-.143.167-.215.25-.247.354s-.021.215 0 .438l.02.203c.076.785.114 1.178-.115 1.352c-.23.174-.576.015-1.267-.303l-.178-.082c-.197-.09-.295-.135-.399-.135s-.202.045-.399.135l-.178.082c-.691.319-1.037.477-1.267.303s-.191-.567-.115-1.352l.02-.203c.021-.223.032-.334 0-.438s-.104-.187-.247-.354l-.13-.152c-.503-.588-.755-.882-.667-1.165c.088-.282.457-.365 1.195-.532l.19-.044c.21-.047.315-.07.4-.135c.084-.064.138-.16.246-.354z" />
      <path d="M19 9A7 7 0 1 1 5 9a7 7 0 0 1 14 0Z" />
      <path d="m12 16.068l-3.771 3.905c-.54.56-.81.839-1.04.935c-.52.22-1.099.032-1.373-.448c-.12-.21-.158-.59-.232-1.35c-.043-.43-.064-.644-.128-.824a1.43 1.43 0 0 0-.835-.864c-.173-.067-.38-.088-.795-.132c-.734-.078-1.101-.117-1.305-.241c-.463-.284-.646-.883-.433-1.422c.094-.237.364-.517.904-1.076L5.456 12M12 16.068l3.771 3.905c.54.56.81.839 1.04.935c.52.22 1.099.032 1.373-.448c.12-.21.157-.59.232-1.35c.043-.43.064-.644.128-.824c.144-.402.446-.715.835-.864c.173-.067.38-.088.795-.132c.734-.078 1.101-.117 1.305-.241c.463-.284.646-.883.433-1.422c-.094-.237-.364-.517-.904-1.076L18.544 12" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 24 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },

  summary: {
    background: theme.card,
    border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: '20px 24px',
    marginBottom: 32,
  },
  summaryTop: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  summaryCount: { fontSize: 26, fontWeight: 800, color: theme.ink, letterSpacing: -0.5 },
  summaryTotal: { fontSize: 20, fontWeight: 600, color: theme.inkFaint },
  summaryLabel: { fontSize: 13.5, color: theme.inkSoft, fontWeight: 500 },
  summaryTrack: { height: 8, borderRadius: 99, background: theme.muted, overflow: 'hidden' },
  summaryFill: { height: '100%', borderRadius: 99, background: theme.ok, transition: 'width .4s ease' },

  section: { marginBottom: 32 },
  sectionHead: { marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: theme.ink, margin: 0, letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: theme.inkSoft, margin: '3px 0 0', fontWeight: 500 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },

  badge: {
    background: theme.card,
    border: `1px solid ${theme.line}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    transition: 'opacity .2s ease',
    minWidth: 0,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  badgeBody: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  badgeLabel: { fontSize: 15, fontWeight: 700, color: theme.ink, letterSpacing: -0.2 },
  badgeDesc: { fontSize: 12.5, color: theme.inkSoft, lineHeight: 1.45, fontWeight: 500 },

  statusPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    fontSize: 12, fontWeight: 700,
    padding: '5px 10px', borderRadius: 99,
  },

  lockedFoot: { display: 'flex', flexDirection: 'column', gap: 7 },
  progTrack: { height: 6, borderRadius: 99, background: theme.muted, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 99, background: theme.inkFaint, transition: 'width .4s ease' },
  faltaText: { fontSize: 11.5, color: theme.inkFaint, fontWeight: 600 },
};