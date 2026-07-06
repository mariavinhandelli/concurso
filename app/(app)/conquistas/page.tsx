'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { theme } from '@/lib/theme';
import { useBreakpoints } from '@/components/layout/UIContext';
import {
  getBadgeState,
  type Badge,
  type BadgeFamily,
  type RhythmStats,
} from '@/services/badges.service';

// ─── Constantes ───────────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<BadgeFamily, { title: string; subtitle: string }> = {
  volume:       { title: 'Volume',           subtitle: 'Questões resolvidas ao longo da jornada.' },
  tempo:        { title: 'Tempo de estudo',  subtitle: 'Horas cronometradas acumuladas.' },
  maestria:     { title: 'Maestria',         subtitle: 'Volume com qualidade — acerto sustentado.' },
  consistencia: { title: 'Consistência',     subtitle: 'Dias seguidos de estudo — o hábito que sustenta tudo.' },
};

// Escala de tipografia — 6 steps, sem frações
// xs: 12  sm: 13  md: 14  lg: 16  xl: 20  2xl: 28/32
const T = { xs: 12, sm: 13, md: 14, lg: 16, xl: 20, h: 28, hero: 32 } as const;

const TIER_COLORS: Record<string, string> = {
  bronze: '#A9744F',
  prata:  '#8C97A1',
  ouro:   '#C9A227',
};

// Cor da barra de progresso para cada família (com tema, sem hardcode)
const FAMILY_PROG_COLOR: Record<BadgeFamily, string> = {
  volume:       'var(--teal)',
  tempo:        'var(--teal)',
  maestria:     'var(--warn)',
  consistencia: 'var(--ok)',
};

type Filter = 'todas' | 'em-andamento' | 'conquistadas';
const FAMILIES: BadgeFamily[] = ['volume', 'tempo', 'maestria', 'consistencia'];
const FILTER_TABS: { id: Filter; label: string }[] = [
  { id: 'todas',        label: 'Todas' },
  { id: 'em-andamento', label: 'Em andamento' },
  { id: 'conquistadas', label: 'Conquistadas' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEta(days: number): string {
  if (days <= 30) return `~${days} dias`;
  if (days <= 90) return `~${Math.ceil(days / 7)} sem.`;
  return `~${Math.ceil(days / 30)} meses`;
}

function summaryMsg(pct: number): string {
  if (pct === 0)  return 'Comece sua coleção — cada conquista conta.';
  if (pct < 25)   return 'Você está nos primeiros passos. Continue.';
  if (pct < 50)   return 'No caminho certo — mais da metade pela frente.';
  if (pct < 75)   return 'Mais da metade conquistada. Impressionante.';
  if (pct < 100)  return 'Quase lá — a linha de chegada está próxima.';
  return 'Coleção completa. Conquista máxima.';
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConquistasPage() {
  const { isMobile } = useBreakpoints();

  const { data: state, isLoading: loading, isError: error } = useQuery({
    queryKey: ['badge-state'],
    queryFn:  getBadgeState,
    staleTime: 5 * 60_000,
  });

  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('todas');

  useEffect(() => {
    if (!state) return;
    try {
      const stored  = localStorage.getItem('conquistas:seen_ids');
      const seenSet = new Set<string>(stored ? (JSON.parse(stored) as string[]) : []);
      const unlocked = state.badges.filter(b => b.unlocked).map(b => b.id);
      setNewIds(new Set(unlocked.filter(id => !seenSet.has(id))));
      localStorage.setItem('conquistas:seen_ids', JSON.stringify(unlocked));
    } catch { /* localStorage indisponível */ }
  }, [state]);

  const badges        = state?.badges        ?? [];
  const unlockedCount = state?.unlockedCount ?? 0;
  const totalCount    = state?.totalCount    ?? 0;
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filteredBadges = useMemo(() =>
    filter === 'conquistadas' ? badges.filter(b =>  b.unlocked) :
    filter === 'em-andamento' ? badges.filter(b => !b.unlocked) :
    badges,
    [filter, badges],
  );

  const byFamily = useMemo(() =>
    FAMILIES
      .map(f => ({
        family:            f,
        badges:            filteredBadges.filter(b => b.family === f),
        allBadgesInFamily: badges.filter(b => b.family === f),
      }))
      .filter(g => g.badges.length > 0),
    [filteredBadges, badges],
  );

  const nextUp = useMemo(() =>
    filter !== 'conquistadas' && unlockedCount < totalCount
      ? badges.filter(b => !b.unlocked).sort((a, b) => b.progress - a.progress).slice(0, 3)
      : [],
    [filter, badges, unlockedCount, totalCount],
  );

  const pad = isMobile ? '20px 16px' : '32px 40px';

  if (loading) return <SkeletonPage isMobile={isMobile} pad={pad} />;

  if (error || !state) return (
    <div style={{ ...s.page, padding: pad }}>
      <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : T.h }}>Conquistas</h1>
      <p style={s.sub}>
        {error
          ? 'Não foi possível carregar suas conquistas. Tente novamente.'
          : 'Você precisa estar logado para ver suas conquistas.'}
      </p>
    </div>
  );

  return (
    <div style={{ ...s.page, padding: pad }}>

      <div style={s.header}>
        <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : T.h }}>Conquistas</h1>
        <p style={s.sub}>Marcos da sua preparação — esforço e qualidade, lado a lado.</p>
      </div>

      <SummaryCard unlockedCount={unlockedCount} totalCount={totalCount} pct={pct} />

      {nextUp.length > 0 && <NextUpSection badges={nextUp} isMobile={isMobile} />}

      <FilterTabs value={filter} onChange={setFilter} />

      {byFamily.map(({ family, badges: fb, allBadgesInFamily }) => (
        <FamilySection
          key={family}
          family={family}
          badges={fb}
          allBadgesInFamily={allBadgesInFamily}
          rhythm={state.rhythm}
          newIds={newIds}
          isMobile={isMobile}
        />
      ))}

      {byFamily.length === 0 && (
        <div style={s.emptyWrap}>
          <span style={s.emptyIcon}>
            {filter === 'conquistadas' ? '🏅' : '🎯'}
          </span>
          <p style={s.emptyTitle}>
            {filter === 'conquistadas'
              ? 'Nenhuma conquista desbloqueada ainda.'
              : 'Nenhuma conquista em andamento.'}
          </p>
          <p style={s.emptyHint}>
            {filter === 'conquistadas'
              ? 'Continue estudando — as primeiras conquistas chegam rápido.'
              : 'Todas as conquistas já foram desbloqueadas. Parabéns!'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonPage({ isMobile, pad }: { isMobile: boolean; pad: string }) {
  const r: React.CSSProperties = { background: theme.muted, borderRadius: 8 };
  return (
    <div style={{ ...s.page, padding: pad }}>
      <div style={{ marginBottom: 24 }}>
        <div className="skel" style={{ ...r, height: 32, width: isMobile ? 140 : 180, marginBottom: 8 }} />
        <div className="skel" style={{ ...r, height: 14, width: 260 }} />
      </div>
      {/* SummaryCard skeleton — altura calibrada ao conteúdo real (32+16+12+10+16 = ~110px + padding) */}
      <div style={{ ...s.card, marginBottom: 32, padding: '20px 24px' }}>
        <div className="skel" style={{ ...r, height: 36, width: 140, marginBottom: 16 }} />
        <div className="skel" style={{ ...r, height: 12, width: '100%', borderRadius: 99 }} />
        <div className="skel" style={{ ...r, height: 13, width: 220, marginTop: 10 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skel" style={{ ...r, height: 96, borderRadius: 14 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel" style={{ ...r, height: 168, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ unlockedCount, totalCount, pct }: {
  unlockedCount: number; totalCount: number; pct: number;
}) {
  return (
    <div style={{ ...s.card, padding: '20px 24px', marginBottom: 32 }}>
      <div style={s.summaryTop}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          {/* P0: count sobe de 28→32px — hero number com mais impacto */}
          <span style={s.summaryCount}>{unlockedCount}</span>
          <span style={s.summaryTotal}>/ {totalCount}</span>
          <span style={s.summaryLabel}>conquistadas</span>
        </div>
        <span style={s.summaryPct}>{pct}%</span>
      </div>
      {/* P1: barra de 8→12px — mais proeminente no card hero */}
      <div style={s.summaryTrack}>
        <div
          className="conquistas-summary-fill"
          style={{ '--prog': String(pct / 100) } as React.CSSProperties}
        />
      </div>
      {/* P1: mensagem contextual baseada no progresso */}
      <p style={s.summaryMsg}>{summaryMsg(pct)}</p>
    </div>
  );
}

// ─── NextUp ───────────────────────────────────────────────────────────────────

function NextUpSection({ badges, isMobile }: { badges: Badge[]; isMobile: boolean }) {
  return (
    <section style={{ marginBottom: 32 }}>
      {/* P0: removido uppercase/10.5px micro-label → label normal 13px semibold */}
      <p style={s.sectionLabel}>Próximas conquistas</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${badges.length}, 1fr)`,
        gap: 16,
      }}>
        {badges.map((b, i) => <NextUpCard key={b.id} badge={b} index={i} />)}
      </div>
    </section>
  );
}

function NextUpCard({ badge, index }: { badge: Badge; index: number }) {
  const pct       = Math.round(badge.progress * 100);
  const remaining = Math.max(0, badge.target - badge.current);
  const eta       = badge.etaDays ? formatEta(badge.etaDays) : null;
  const progColor = FAMILY_PROG_COLOR[badge.family];

  return (
    <div
      className="conquistas-card conquistas-fade-up"
      style={{ '--card-delay': `${index * 70}ms`, ...s.nextUpCard } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={s.nextUpTitle}>{badge.label}</span>
        <span style={s.nextUpPct}>{pct}%</span>
      </div>
      {/* P1: barra 6→8px */}
      <div style={s.nextUpTrack}>
        <div
          className="conquistas-nextup-fill"
          style={{
            '--prog':       String(badge.progress),
            '--prog-color': progColor,
          } as React.CSSProperties}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: eta ? 'space-between' : 'flex-start', alignItems: 'center', marginTop: 10 }}>
        <span style={s.nextUpRemain}>
          {remaining.toLocaleString('pt-BR')} {badge.unit} restantes
        </span>
        {eta && <span style={s.nextUpEta}>{eta}</span>}
      </div>
    </div>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

function FilterTabs({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  return (
    <div style={s.filterWrap}>
      {FILTER_TABS.map(t => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="conquistas-filter-tab"
            style={{
              // P1: active usa muted+inkStrong em vez de color-mix quasi-invisível
              color:       active ? theme.ink     : theme.inkSoft,
              background:  active ? theme.muted   : 'transparent',
              borderColor: active ? theme.lineStrong : theme.line,
              fontWeight:  active ? 600 : 500,
              fontFamily:  theme.font,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── FamilySection ────────────────────────────────────────────────────────────

function FamilySection({
  family, badges, allBadgesInFamily, rhythm, newIds, isMobile,
}: {
  family: BadgeFamily; badges: Badge[]; allBadgesInFamily: Badge[];
  rhythm: RhythmStats; newIds: Set<string>; isMobile: boolean;
}) {
  const unlockedInFamily = allBadgesInFamily.filter(b => b.unlocked).length;
  const { title, subtitle } = FAMILY_LABELS[family];

  return (
    <section style={s.section}>
      <div style={s.sectionHead}>
        <div>
          <h2 style={s.sectionTitle}>{title}</h2>
          <p style={s.sectionSub}>{subtitle}</p>
        </div>
        {/* P1: counter → pill com background — visível, não texto fantasma */}
        <span style={s.familyPill}>
          {unlockedInFamily}
          <span style={s.familyPillSep}>/</span>
          {allBadgesInFamily.length}
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 16,
      }}>
        {badges.map((b, i) => (
          <BadgeCard
            key={b.id}
            badge={b}
            isNew={newIds.has(b.id)}
            cardIndex={i}
            rhythm={rhythm}
          />
        ))}
      </div>
    </section>
  );
}

// ─── BadgeCard ────────────────────────────────────────────────────────────────

function BadgeCard({ badge, isNew, cardIndex }: {
  badge: Badge; isNew: boolean; cardIndex: number; rhythm: RhythmStats;
}) {
  const { unlocked, family, tier, progress } = badge;

  const accent = unlocked
    ? (family === 'maestria' && tier ? TIER_COLORS[tier] : theme.teal)
    : theme.inkFaint;
  const aa = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;

  // P0: barra de progresso usa cor da família, não cinza --ink-faint
  const progressColor = family === 'maestria' && tier
    ? TIER_COLORS[tier]
    : FAMILY_PROG_COLOR[family];

  const restante   = Math.max(0, badge.target - badge.current);
  const faltaTexto = badge.hint
    ?? (badge.unit === 'horas'  ? `${restante}h restantes`
     : badge.unit === 'dias'    ? `${restante} dias restantes`
     : `${restante.toLocaleString('pt-BR')} restantes`);
  const eta = badge.etaDays ? formatEta(badge.etaDays) : null;

  return (
    <div
      className={[
        'conquistas-card',
        'conquistas-fade-up',
        isNew && unlocked ? 'conquistas-badge-new' : '',
      ].join(' ').trim()}
      style={{
        '--card-delay':   `${cardIndex * 50}ms`,
        // CSS variables — lidas pelo .conquistas-card base, sem precisar de !important no hover
        '--badge-border': unlocked ? aa(30) : theme.line,
        ...s.badge,
      } as React.CSSProperties}
    >
      {/* P1: container 44→48px, borderRadius 12→14 */}
      <div style={{ ...s.iconWrap, background: unlocked ? aa(10) : theme.muted }}>
        <BadgeIcon family={family} color={accent} />
      </div>

      <div style={s.badgeBody}>
        {/* P0: fontSize 14.5→14, sem letterSpacing −0.2 */}
        <span style={s.badgeLabel}>{badge.label}</span>
        <span style={s.badgeDesc}>{badge.description}</span>
      </div>

      {unlocked ? (
        /* P1: pill 12→13px, padding 5→6px — um pouco mais de presença */
        <div style={{ ...s.statusPill, color: accent, background: aa(9) }}>
          <CheckIcon color={accent} />
          Conquistada
        </div>
      ) : (
        <div style={s.lockedFoot}>
          {/* P1: track 6→8px */}
          <div style={s.progTrack}>
            <div
              className="conquistas-prog-fill"
              style={{
                '--prog':       String(progress),
                '--prog-color': progressColor,  // P0: cor da família, não cinza
              } as React.CSSProperties}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            {/* P0: 12.5→13px */}
            <span style={s.faltaText}>{faltaTexto}</span>
            <span style={s.progPct}>{Math.round(progress * 100)}%</span>
          </div>
          {/* P0: 11.5→12px */}
          {eta && <span style={s.etaText}>{eta} no seu ritmo</span>}
        </div>
      )}
    </div>
  );
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function BadgeIcon({ family, color }: { family: BadgeFamily; color: string }) {
  // P1: 22→28px (58% fill de container 48px — dentro do sweet spot 55-67%)
  // P1: strokeWidth 1.8→2 (consistência em telas 1x/2x)
  const c = {
    width: 28, height: 28, fill: 'none', stroke: color,
    strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  if (family === 'volume') return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...c}>
      <path d="M9 5h10M9 12h10M9 19h10" />
      <path d="M4 5h.01M4 12h.01M4 19h.01" />
    </svg>
  );
  if (family === 'tempo') return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...c}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  );
  if (family === 'consistencia') return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...c}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5" />
    </svg>
  );
  // Maestria — versão simplificada para 28px (path complexo anterior sumia em tamanho pequeno)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...c}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      aria-hidden="true"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1080, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },

  header: { marginBottom: 24 },
  // P0: letterSpacing –0.6 mantido (correto em heading grande)
  h1:     { fontSize: T.h, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  // P0: 14px (md) mantido
  sub:    { fontSize: T.md, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },

  card: {
    background:   theme.card,
    border:       `0.5px solid ${theme.line}`,
    borderRadius: theme.radius,
    boxShadow:    theme.shadow,
  },

  summaryTop:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  // P0: 28→32px — hero number com mais impacto
  summaryCount: { fontSize: T.hero, fontWeight: 800, color: theme.ink, letterSpacing: -0.8 },
  summaryTotal: { fontSize: T.xl,   fontWeight: 600, color: theme.inkFaint },
  summaryLabel: { fontSize: T.sm,   color: theme.inkSoft, fontWeight: 500, marginLeft: 4 },
  summaryPct:   { fontSize: T.sm,   fontWeight: 600, color: theme.inkSoft },
  // P1: 8→12px — barra hero mais proeminente
  summaryTrack: { height: 12, borderRadius: 99, background: theme.muted, overflow: 'hidden' },
  // P1: mensagem contextual
  summaryMsg:   { fontSize: T.sm, color: theme.inkSoft, fontWeight: 500, margin: '10px 0 0' },

  // P0: 10.5px uppercase → 13px semibold normal — remove clichê 2018
  sectionLabel: { fontSize: T.sm, fontWeight: 600, color: theme.inkSoft, margin: '0 0 12px', letterSpacing: 0 },

  nextUpCard: {
    background:   theme.card,
    // border-color via CSS variable (--badge-border fallback var(--line)); box-shadow via CSS
    border:       `0.5px solid`,
    borderRadius: theme.radius,
    // P1: 14px 16px → 16px (múltiplo de 8)
    padding:      16,
    minWidth:     0,
  },
  nextUpTitle:  { fontSize: T.sm, fontWeight: 700, color: theme.ink, lineHeight: 1.3 },
  nextUpPct:    { fontSize: T.sm, fontWeight: 700, color: theme.inkSoft, flexShrink: 0, marginLeft: 8 },
  // P1: 6→8px
  nextUpTrack:  { height: 8, borderRadius: 99, background: theme.muted, overflow: 'hidden' },
  nextUpRemain: { fontSize: T.xs, color: theme.inkSoft, fontWeight: 500 },
  // P0: 11→12px (xs)
  nextUpEta:    { fontSize: T.xs, color: theme.inkFaint, fontWeight: 600, flexShrink: 0, marginLeft: 8 },

  filterWrap: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },

  // P1: 36→40px (múltiplo de 8)
  section:      { marginBottom: 40 },
  // P1: 14→16px (múltiplo de 8)
  sectionHead:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  // P0: 17→16px (lg — step limpo da escala)
  sectionTitle: { fontSize: T.lg, fontWeight: 700, color: theme.ink, margin: 0, letterSpacing: -0.3 },
  sectionSub:   { fontSize: T.sm, color: theme.inkSoft, margin: '4px 0 0', fontWeight: 500 },
  // P1: pill com background — visível, não texto fantasma
  familyPill:   {
    fontSize: T.xs, fontWeight: 700, color: theme.inkSoft,
    background: theme.muted, padding: '4px 10px', borderRadius: 99,
    flexShrink: 0, whiteSpace: 'nowrap',
  },
  familyPillSep: { color: theme.inkFaint, margin: '0 3px', fontWeight: 400 },

  badge: {
    background:    theme.card,
    // border-color vem de --badge-border via CSS (.conquistas-card); box-shadow via --badge-shadow
    border:        `0.5px solid`,
    borderRadius:  theme.radius,
    // P1: 18→20px (múltiplo de 4, mais respiração)
    padding:       20,
    display:       'flex',
    flexDirection: 'column',
    // P1: 12→16px (múltiplo de 8)
    gap:           16,
    minWidth:      0,
  },
  // P1: 44→48px container, borderRadius 12→14
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  // P1: gap 4→6px
  badgeBody:  { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  // P0: 14.5→14px, sem letterSpacing −0.2
  badgeLabel: { fontSize: T.md, fontWeight: 700, color: theme.ink },
  badgeDesc:  { fontSize: T.xs, color: theme.inkSoft, lineHeight: 1.5, fontWeight: 500 },

  // P1: 12→13px, padding 5px→6px — mais presença no momento de celebração
  statusPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    fontSize: T.sm, fontWeight: 700, padding: '6px 12px', borderRadius: 99,
  },

  lockedFoot: { display: 'flex', flexDirection: 'column' },
  // P1: 6→8px
  progTrack:  { height: 8, borderRadius: 99, background: theme.muted, overflow: 'hidden' },
  // P0: 12.5→13px (sm)
  faltaText:  { fontSize: T.sm, color: theme.inkSoft, fontWeight: 600 },
  progPct:    { fontSize: T.xs, color: theme.inkFaint, fontWeight: 600 },
  // P0: 11.5→12px (xs)
  etaText:    { fontSize: T.xs, color: theme.inkFaint, fontWeight: 500, marginTop: 8 },

  emptyWrap:  { textAlign: 'center', padding: '56px 0' },
  emptyIcon:  { fontSize: 40, display: 'block', marginBottom: 16 },
  emptyTitle: { fontSize: T.md, color: theme.ink, fontWeight: 600, margin: '0 0 8px' },
  emptyHint:  { fontSize: T.sm, color: theme.inkSoft, fontWeight: 500, margin: 0, lineHeight: 1.5 },
};
