// app/(app)/progresso/conquistas/page.tsx — aba CONQUISTAS (M1).
// Header e container vêm do layout de /progresso; esta página é só o conteúdo.
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, List, Clock, Flame, Star, Medal, Target, Share2 } from 'lucide-react';
import { theme } from '@/lib/theme';
import { track, EV } from '@/lib/analytics';
import { useBreakpoints } from '@/components/layout/UIContext';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Card } from '@/components/ui/Card';
import { ShareProgressCard, type ShareBadgeInfo } from '@/components/features/home/ShareProgressCard';
import {
  getBadgeState,
  getBadgeRarity,
  type Badge,
  type BadgeFamily,
} from '@/services/badges.service';

// ─── Constantes ───────────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<BadgeFamily, { title: string; subtitle: string }> = {
  edital:       { title: 'Seu edital',       subtitle: 'Marcos do concurso-alvo — cobertura e domínio do que cai na prova.' },
  volume:       { title: 'Volume',           subtitle: 'Questões resolvidas ao longo da jornada.' },
  tempo:        { title: 'Tempo de estudo',  subtitle: 'Horas cronometradas acumuladas.' },
  maestria:     { title: 'Maestria',         subtitle: 'Volume com qualidade — acerto sustentado.' },
  consistencia: { title: 'Consistência',     subtitle: 'Dias seguidos de estudo — o hábito que sustenta tudo.' },
};

// Escala de tipografia — 6 steps, sem frações
// xs: 12  sm: 13  md: 14  lg: 16  xl: 20  2xl: 28/32
const T = { xs: 12, sm: 13, md: 14, lg: 16, xl: 20, h: 28, hero: 32 } as const;

// Tokens (globals.css) — acompanham light/dark e passam contraste AA. Antes
// eram hex cravados aqui, invisíveis para o sistema de temas.
const TIER_COLORS: Record<NonNullable<Badge['tier']>, string> = {
  bronze: 'var(--tier-bronze)',
  prata:  'var(--tier-prata)',
  ouro:   'var(--tier-ouro)',
};

// Cor da barra de progresso para cada família (com tema, sem hardcode)
const FAMILY_PROG_COLOR: Record<BadgeFamily, string> = {
  edital:       'var(--clay)',
  volume:       'var(--teal)',
  tempo:        'var(--teal)',
  maestria:     'var(--warn)',
  consistencia: 'var(--ok)',
};

type Filter = 'todas' | 'em-andamento' | 'conquistadas';
// "Seu edital" abre a página: é o marco que fala do CONCURSO da pessoa,
// não de volume genérico.
const FAMILIES: BadgeFamily[] = ['edital', 'volume', 'tempo', 'maestria', 'consistencia'];
// Empate no "Próximas conquistas" (usuário novo, tudo em 0%): da vitória mais
// alcançável para a mais distante.
const FAMILY_TIEBREAK: BadgeFamily[] = ['consistencia', 'volume', 'edital', 'tempo', 'maestria'];
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
  // M4 — badge escolhida para virar imagem compartilhável.
  const [shareBadge, setShareBadge] = useState<ShareBadgeInfo | null>(null);

  // M4 — raridade ("N% têm esta"): agregado global, cacheado por 1h — muda
  // devagar e é tempero, não estrutura.
  const { data: rarity = {} } = useQuery<Record<string, number>>({
    queryKey: ['badge-rarity'],
    queryFn: getBadgeRarity,
    staleTime: 60 * 60_000,
  });

  useEffect(() => { track(EV.achievementsViewed); }, []);

  // "Nova" agora vem do servidor (user_badges): desbloqueada NESTA computação.
  // Substitui o localStorage por dispositivo — funciona igual em qualquer
  // aparelho e sobrevive a limpeza de cache. O track de badge_unlocked também
  // mudou para o service (fonte única, sem dupla contagem).
  useEffect(() => {
    if (!state || state.newlyUnlocked.length === 0) return;
    setNewIds(new Set(state.newlyUnlocked.map(b => b.id)));
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

  // Uma conquista por família, a mais próxima de cada. Ordenar só por progresso
  // dava, para quem está começando (tudo em 0%), as TRÊS metas de volume —
  // 100 / 500 / 2.000 questões — escondendo "7 dias seguidos", a única vitória
  // alcançável na primeira semana. O desempate por família garante variedade e
  // coloca o marco mais fácil na frente.
  const nextUp = useMemo(() => {
    if (filter === 'conquistadas' || unlockedCount >= totalCount) return [];
    const maisProxima = new Map<BadgeFamily, Badge>();
    for (const b of badges) {
      if (b.unlocked) continue;
      const atual = maisProxima.get(b.family);
      // dentro da família: maior progresso; em empate (tudo 0%), a meta menor
      if (!atual || b.progress > atual.progress
        || (b.progress === atual.progress && b.target < atual.target)) {
        maisProxima.set(b.family, b);
      }
    }
    return [...maisProxima.values()]
      .sort((a, b) => b.progress - a.progress
        || FAMILY_TIEBREAK.indexOf(a.family) - FAMILY_TIEBREAK.indexOf(b.family))
      .slice(0, 3);
  }, [filter, badges, unlockedCount, totalCount]);

  if (loading) return <SkeletonPage isMobile={isMobile} />;

  if (error || !state) return (
    <p style={{ fontSize: T.md, color: theme.inkSoft, margin: 0 }}>
      {error
        ? 'Não foi possível carregar suas conquistas. Tente novamente.'
        : 'Você precisa estar logado para ver suas conquistas.'}
    </p>
  );

  return (
    <div style={{ minWidth: 0 }}>
      <SummaryCard unlockedCount={unlockedCount} totalCount={totalCount} pct={pct} />

      {nextUp.length > 0 && <NextUpSection badges={nextUp} isMobile={isMobile} />}

      <div style={s.filterWrap}>
        <SegmentedControl options={FILTER_TABS.map((t) => ({ value: t.id, label: t.label }))} value={filter} onChange={setFilter} equalWidth={false} />
      </div>

      {byFamily.map(({ family, badges: fb, allBadgesInFamily }) => (
        <FamilySection
          key={family}
          family={family}
          badges={fb}
          allBadgesInFamily={allBadgesInFamily}
          newIds={newIds}
          isMobile={isMobile}
          rarity={rarity}
          onShare={(b) => setShareBadge({
            label: b.label,
            description: b.description,
            unlockedAt: b.unlockedAt,
            unlockedCount,
          })}
        />
      ))}

      {shareBadge && (
        <ShareProgressCard badge={shareBadge} onClose={() => setShareBadge(null)} />
      )}

      {byFamily.length === 0 && (
        <div style={s.emptyWrap}>
          <span style={s.emptyIcon}>
            {filter === 'conquistadas' ? <Medal size={40} color={theme.inkFaint} strokeWidth={1.3} /> : <Target size={40} color={theme.inkFaint} strokeWidth={1.3} />}
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

function SkeletonPage({ isMobile }: { isMobile: boolean }) {
  const { isTablet } = useBreakpoints();
  const r: React.CSSProperties = { background: theme.muted, borderRadius: theme.radiusXs };
  return (
    // Só o conteúdo — header e container reais vêm do layout de /progresso.
    <div style={{ minWidth: 0 }}>
      {/* SummaryCard skeleton — altura calibrada ao conteúdo real (32+16+12+10+16 = ~110px + padding) */}
      <Card style={{ marginBottom: 32, padding: '20px 24px' }}>
        <div className="skel" style={{ ...r, height: 36, width: 140, marginBottom: 16 }} />
        <div className="skel" style={{ ...r, height: 12, width: '100%', borderRadius: theme.radiusPill }} />
        <div className="skel" style={{ ...r, height: 13, width: 220, marginTop: 10 }} />
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skel" style={{ ...r, height: 96, borderRadius: 14 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel" style={{ ...r, height: 168, borderRadius: theme.radius }} />
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
    <Card style={{ padding: '20px 24px', marginBottom: 32 }}>
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
      <div
        style={s.summaryTrack}
        role="progressbar"
        aria-label="Conquistas desbloqueadas"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="conquistas-summary-fill"
          style={{ '--prog': String(pct / 100) } as React.CSSProperties}
        />
      </div>
      {/* P1: mensagem contextual baseada no progresso */}
      <p style={s.summaryMsg}>{summaryMsg(pct)}</p>
    </Card>
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
        gridTemplateColumns: isMobile ? '1fr' : `repeat(auto-fit, minmax(200px, 1fr))`,
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
      <div
        style={s.nextUpTrack}
        role="progressbar"
        aria-label={badge.label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
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

// ─── FamilySection ────────────────────────────────────────────────────────────

function FamilySection({
  family, badges, allBadgesInFamily, newIds, isMobile, rarity, onShare,
}: {
  family: BadgeFamily; badges: Badge[]; allBadgesInFamily: Badge[];
  newIds: Set<string>; isMobile: boolean;
  rarity: Record<string, number>; onShare: (b: Badge) => void;
}) {
  const unlockedInFamily = allBadgesInFamily.filter(b => b.unlocked).length;
  const { title, subtitle } = FAMILY_LABELS[family];
  const { isTablet } = useBreakpoints();

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
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
        gap: 16,
      }}>
        {badges.map((b, i) => (
          <BadgeCard
            key={b.id}
            badge={b}
            isNew={newIds.has(b.id)}
            cardIndex={i}
            rarityPct={rarity[b.id]}
            onShare={() => onShare(b)}
          />
        ))}
      </div>
    </section>
  );
}

// ─── BadgeCard ────────────────────────────────────────────────────────────────

function BadgeCard({ badge, isNew, cardIndex, rarityPct, onShare }: {
  badge: Badge; isNew: boolean; cardIndex: number;
  rarityPct?: number; onShare: () => void;
}) {
  const { unlocked, family, tier, progress } = badge;

  const accent = unlocked
    ? (family === 'maestria' && tier ? TIER_COLORS[tier]
      : family === 'edital' ? theme.clay
      : theme.teal)
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
        <div style={s.unlockedFoot}>
          <div style={{ ...s.statusPill, color: accent, background: aa(9) }}>
            <CheckIcon color={accent} />
            Conquistada
          </div>
          {/* Data do desbloqueio (user_badges) — o colecionável ganha história.
              Raridade (M4): "N% têm" transforma o card em conversa. */}
          {(badge.unlockedAt || rarityPct !== undefined) && (
            <span style={s.unlockedDate}>
              {badge.unlockedAt && `em ${new Date(badge.unlockedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              {badge.unlockedAt && rarityPct !== undefined && ' · '}
              {rarityPct !== undefined && `${rarityPct}% têm`}
            </span>
          )}
          <button
            onClick={onShare}
            className="touch-target conquistas-share-btn"
            aria-label={`Compartilhar a conquista ${badge.label}`}
            title="Compartilhar"
          >
            <Share2 size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div style={s.lockedFoot}>
          {/* P1: track 6→8px */}
          <div
            style={s.progTrack}
            role="progressbar"
            aria-label={badge.label}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
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
  const c = { size: 28, color, strokeWidth: 2, 'aria-hidden': true as const };
  if (family === 'edital') return <Target {...c} />;
  if (family === 'volume') return <List {...c} />;
  if (family === 'tempo') return <Clock {...c} />;
  if (family === 'consistencia') return <Flame {...c} />;
  // Maestria
  return <Star {...c} />;
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Check size={16} color={color} strokeWidth={2} aria-hidden="true" />
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  summaryTop:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  // P0: 28→32px — hero number com mais impacto
  summaryCount: { fontSize: T.hero, fontWeight: 800, color: theme.ink, letterSpacing: -0.8 },
  summaryTotal: { fontSize: T.xl,   fontWeight: 600, color: theme.inkFaint },
  summaryLabel: { fontSize: T.sm,   color: theme.inkSoft, fontWeight: 500, marginLeft: 4 },
  summaryPct:   { fontSize: T.sm,   fontWeight: 600, color: theme.inkSoft },
  // P1: 8→12px — barra hero mais proeminente
  summaryTrack: { height: 12, borderRadius: theme.radiusPill, background: theme.muted, overflow: 'hidden' },
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
  nextUpTrack:  { height: 8, borderRadius: theme.radiusPill, background: theme.muted, overflow: 'hidden' },
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
    background: theme.muted, padding: '4px 10px', borderRadius: theme.radiusPill,
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
    fontSize: T.sm, fontWeight: 700, padding: '6px 12px', borderRadius: theme.radiusPill,
  },
  unlockedFoot: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  unlockedDate: { fontSize: T.xs, color: theme.inkFaint, fontWeight: 500, minWidth: 0 },

  lockedFoot: { display: 'flex', flexDirection: 'column' },
  // P1: 6→8px
  progTrack:  { height: 8, borderRadius: theme.radiusPill, background: theme.muted, overflow: 'hidden' },
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
