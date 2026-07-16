'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import {
  X, ChevronLeft, House, RefreshCw, Layers, CalendarClock, FolderOpen, List,
  Gavel, Book, Pencil, ChartNoAxesColumn, Trophy, Users, History, type LucideIcon,
} from 'lucide-react';
import { useUI } from './UIContext';
import { zIndex } from '@/lib/theme';

// Cores da sidebar — agora resolvem via CSS variables (acompanham a paleta ativa).
const SB = {
  bg: 'var(--sidebar-bg)',
  activeBg: 'var(--sidebar-active)',
  hoverBg: 'var(--sidebar-hover)',
  textActive: 'var(--sidebar-ink)',
  textIdle: 'var(--sidebar-ink-idle)',
  iconIdle: 'var(--sidebar-icon)',
  border: 'var(--sidebar-border)',
  tagText: 'var(--sidebar-tag)',
  logoInk: 'var(--sidebar-logo-ink)',
};

type NavItem =
  | { type?: 'item'; href: string; label: string; icon: LucideIcon }
  | { type: 'sep'; label: string };

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: House },

  { type: 'sep', label: 'Estudar hoje' },
  { href: '/revisar', label: 'Revisões', icon: RefreshCw },
  { href: '/flashcards', label: 'Flashcards', icon: Layers },

  { type: 'sep', label: 'Organizar' },
  { href: '/schedule', label: 'Agenda', icon: CalendarClock },
  { href: '/subjects', label: 'Matérias', icon: FolderOpen },
  { href: '/targets', label: 'Concursos', icon: List },

  { type: 'sep', label: 'Conteúdo' },
  { href: '/jurisprudencias', label: 'Jurisprudências', icon: Gavel },
  { href: '/vademecum', label: 'Vade Mecum', icon: Book },
  { href: '/caderno', label: 'Caderno', icon: Pencil },

  { type: 'sep', label: 'Progresso' },
  { href: '/performance', label: 'Performance', icon: ChartNoAxesColumn },
  { href: '/conquistas', label: 'Conquistas', icon: Trophy },
  { href: '/amigos', label: 'Amigos', icon: Users },
  { href: '/historico', label: 'Histórico', icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleCollapsed, isMobile, isTablet, mobileOpen, setMobileOpen } = useUI();
  const [hover, setHover] = useState<string | null>(null);

  // No mobile o drawer é sempre largura cheia (nunca "só ícones").
  // O auto-colapso em tablet (768–899 px) é feito via CSS (.app-sidebar).
  const isCollapsed = isMobile ? false : (isTablet || collapsed);
  const W = isMobile ? 244 : (isCollapsed ? 72 : 244);

  function go(href: string) {
    router.push(href);
    if (isMobile) setMobileOpen(false); // fecha o drawer ao navegar
  }

  return (
    <aside
      className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}
      style={{
        ...styles.aside,
        width: W,
        // transform gerenciado por CSS (.app-sidebar / .app-sidebar.mobile-open) — sem FOIC.
        boxShadow: mobileOpen ? '4px 0 24px -6px rgba(20,28,30,.4)' : 'none',
        transition: 'width .24s cubic-bezier(.2,.7,.3,1), transform .26s cubic-bezier(.2,.7,.3,1)',
      }}
    >
      <div className="sidebar-brand" style={{ ...styles.brand, justifyContent: isCollapsed ? 'center' : 'space-between' }}>
        {!isCollapsed && (
          <div style={styles.brandInner}>
            <div style={styles.logo}>
              <svg width="22" height="22" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="sb-g1" x1="118" y1="96" x2="319" y2="245" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#22C55E"/><stop offset="1" stopColor="#A7F5D0"/>
                  </linearGradient>
                  <linearGradient id="sb-g2" x1="118" y1="242" x2="287" y2="303" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#A7F5D0"/><stop offset="1" stopColor="#93C5FD"/>
                  </linearGradient>
                  <linearGradient id="sb-g3" x1="175" y1="290" x2="312" y2="421" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#6366F1"/><stop offset="1" stopColor="#4338CA"/>
                  </linearGradient>
                </defs>
                <path d="M118 151C118 120.624 142.624 96 173 96H331C359.719 96 383 119.281 383 148C383 176.719 359.719 200 331 200H222C193.281 200 170 223.281 170 252V252H118V151Z" fill="url(#sb-g1)"/>
                <path d="M170 252C170 223.281 193.281 200 222 200H292C320.719 200 344 223.281 344 252C344 280.719 320.719 304 292 304H170V252Z" fill="url(#sb-g2)"/>
                <path d="M175 304H227V361C227 391.376 202.376 416 172 416C142.177 416 118 391.823 118 362C118 330 143 304 175 304Z" fill="url(#sb-g3)"/>
              </svg>
            </div>
            <div className="sidebar-brand-name" style={styles.brandName}>focali</div>
          </div>
        )}
        {isCollapsed && (
          <div style={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="sb-g1c" x1="118" y1="96" x2="319" y2="245" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#22C55E"/><stop offset="1" stopColor="#A7F5D0"/>
                </linearGradient>
                <linearGradient id="sb-g2c" x1="118" y1="242" x2="287" y2="303" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#A7F5D0"/><stop offset="1" stopColor="#93C5FD"/>
                </linearGradient>
                <linearGradient id="sb-g3c" x1="175" y1="290" x2="312" y2="421" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#6366F1"/><stop offset="1" stopColor="#4338CA"/>
                </linearGradient>
              </defs>
              <path d="M118 151C118 120.624 142.624 96 173 96H331C359.719 96 383 119.281 383 148C383 176.719 359.719 200 331 200H222C193.281 200 170 223.281 170 252V252H118V151Z" fill="url(#sb-g1c)"/>
              <path d="M170 252C170 223.281 193.281 200 222 200H292C320.719 200 344 223.281 344 252C344 280.719 320.719 304 292 304H170V252Z" fill="url(#sb-g2c)"/>
              <path d="M175 304H227V361C227 391.376 202.376 416 172 416C142.177 416 118 391.823 118 362C118 330 143 304 175 304Z" fill="url(#sb-g3c)"/>
            </svg>
          </div>
        )}
        {isMobile ? (
          <button onClick={() => setMobileOpen(false)} style={styles.collapseBtn} aria-label="Fechar menu">
            <X size={20} color={SB.iconIdle} strokeWidth={1.9} />
          </button>
        ) : (
          // sidebar-collapse-btn: oculto em tablet via CSS (auto-colapso por CSS já faz o trabalho)
          <button className="sidebar-collapse-btn" onClick={toggleCollapsed} style={styles.collapseBtn} aria-label="Recolher menu">
            <ChevronLeft size={18} color={SB.iconIdle} strokeWidth={1.8} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
        )}
      </div>

      <nav
        className="sidebar-nav"
        style={{ ...styles.nav, ...(isCollapsed ? { scrollbarGutter: 'auto' } : {}) }}
        aria-label="Navegação principal"
      >
        {NAV.map((n, i) => {
          if (n.type === 'sep') {
            if (isCollapsed) {
              return <div key={`sep-${i}`} style={styles.sepLine} />;
            }
            return (
              <div key={`sep-${i}`} style={styles.sepWrap}>
                <span style={styles.sepLabel}>{n.label}</span>
              </div>
            );
          }

          const active = pathname === n.href;
          const isHover = hover === n.href;
          return (
            <button
              key={n.href}
              className="sidebar-item"
              onClick={() => go(n.href)}
              onMouseEnter={() => setHover(n.href)}
              onMouseLeave={() => setHover(null)}
              title={isCollapsed ? n.label : undefined}
              style={{
                ...styles.item,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: active ? SB.textActive : SB.textIdle,
                background: active ? SB.activeBg : isHover ? SB.hoverBg : 'transparent',
                fontWeight: active ? 600 : 500,
              }}
            >
              <n.icon size={18} color={active ? SB.textActive : SB.iconIdle} strokeWidth={1.7} style={{ flexShrink: 0, width: 18, maxWidth: 18 }} />
              {!isCollapsed && <span className="sidebar-label">{n.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  aside: { flexShrink: 0, height: '100dvh', position: 'fixed', top: 0, left: 0, zIndex: zIndex.drawer, background: SB.bg, borderRight: `0.5px solid ${SB.border}`, padding: '20px 14px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-poppins), sans-serif', overflow: 'hidden' },
  brand: { display: 'flex', alignItems: 'center', height: 40, marginBottom: 18, padding: '0 4px', flexShrink: 0 },
  brandInner: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32, borderRadius: 9, background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 1px 6px rgba(0,0,0,0.18)' },
  brandName: { fontWeight: 700, fontSize: 20, color: SB.textActive, letterSpacing: -0.5, whiteSpace: 'nowrap', fontFamily: 'var(--font-poppins), sans-serif' },
  collapseBtn: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2, overscrollBehavior: 'contain', scrollbarGutter: 'stable' },
  item: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', height: 40, borderRadius: 10, border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, transition: 'background .15s, color .15s', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  sepWrap: { padding: '10px 12px 4px', display: 'flex', alignItems: 'center', gap: 8 },
  sepLabel: { fontSize: 11, fontWeight: 700, color: SB.tagText, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sepLine: { height: '0.5px', background: SB.border, margin: '6px 8px' },
};
