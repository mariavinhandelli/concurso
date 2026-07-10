'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
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

// Componente para padronizar os SVGs
const IconWrapper = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

type NavItem =
  | { type?: 'item'; href: string; label: string; icon: React.ReactNode }
  | { type: 'sep'; label: string };

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: <path d="m2 8l9.732-4.866a.6.6 0 0 1 .536 0L22 8m-2 3v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" /> },

  { type: 'sep', label: 'Estudar hoje' },
  { href: '/revisar', label: 'Revisões', icon: <path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" /> },
  { href: '/flashcards', label: 'Flashcards', icon: <path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" /> },

  { type: 'sep', label: 'Organizar' },
  {
    href: '/schedule',
    label: 'Agenda',
    icon: (
      <>
        <path d="M11 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7" />
        <path strokeLinejoin="round" d="M2 7h20M5 5.01l.01-.011M8 5.01l.01-.011M11 5.01l.01-.011m10.657 11.668C21.047 15.097 19.635 14 17.99 14c-1.758 0-3.252 1.255-3.793 3" />
        <path strokeLinejoin="round" d="M19.995 16.772H21.4a.6.6 0 0 0 .6-.6V14.55m-7.666 4.783C14.953 20.903 16.366 22 18.01 22c1.758 0 3.252-1.255 3.793-3" />
        <path strokeLinejoin="round" d="M16.005 19.228H14.6a.6.6 0 0 0-.6.6v1.622" />
      </>
    )
  },
  {
    href: '/subjects',
    label: 'Matérias',
    icon: <path d="m3.882 18.043l4.041-5.623a4 4 0 0 1 3.249-1.665h8.752M3.882 18.043a3.65 3.65 0 0 0 2.777 1.277h8.343a4 4 0 0 0 3.405-1.9l2.918-4.734a1.287 1.287 0 0 0-1.115-1.931h-.286M3.882 18.043A3.65 3.65 0 0 1 3 15.661V7.424A2.744 2.744 0 0 1 5.744 4.68h2.653c.607 0 1.189.24 1.618.67l.911.91a1.83 1.83 0 0 0 1.294.537l4.044-.001a3.66 3.66 0 0 1 3.66 3.66v.299" />
  },
  { href: '/targets', label: 'Editais', icon: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h1M4 12h1m-1 5.5h1" /> },

  { type: 'sep', label: 'Conteúdo' },
  { href: '/jurisprudencias', label: 'Jurisprudências', icon: <><path d="M3 6h18M3 12h18M3 18h12" /><circle cx="19" cy="18" r="3" /><path d="M21 20.5L22.5 22" /></> },
  { href: '/vademecum', label: 'Vade Mecum', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M9 7h6M9 10.5h4" /></> },
  { href: '/caderno', label: 'Caderno', icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></> },

  { type: 'sep', label: 'Progresso' },
  { href: '/performance', label: 'Performance', icon: <path d="M15 9.429V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v8.286m6-3.857V21m0-11.571h4a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-4m0 0H9m0 0v-7.714M9 21H5a2 2 0 0 1-2-2v-3.714a2 2 0 0 1 2-2h4" /> },
  {
    href: '/conquistas',
    label: 'Conquistas',
    icon: (
      <>
        <path d="M12 17c-1.674 0-3.13 1.265-3.882 3.131c-.36.892.156 1.869.84 1.869h6.083c.685 0 1.2-.977.841-1.869C15.13 18.265 13.674 17 12 17Z" />
        <path strokeLinejoin="round" d="M18.5 5h1.202c1.201 0 1.801 0 2.115.377c.313.378.183.944-.078 2.077l-.39 1.7C20.76 11.708 18.61 13.608 16 14M5.5 5H4.298c-1.201 0-1.802 0-2.115.377c-.313.378-.183.944.078 2.077l.39 1.7C3.24 11.708 5.39 13.608 8 14" />
        <path d="M12 17c3.02 0 5.565-4.662 6.33-11.01c.211-1.754.317-2.632-.243-3.311S16.622 2 14.813 2H9.187c-1.81 0-2.714 0-3.274.679S5.46 4.236 5.67 5.991C6.435 12.338 8.98 17 12 17Z" />
      </>
    )
  },
  { href: '/amigos', label: 'Amigos', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { href: '/historico',
    label: 'Histórico',
    icon: (
      <>
        <path d="M4.281 14.385a8.25 8.25 0 1 0 .824-6.26l-.477.88m-.523-4.63v3.75a1 1 0 0 0 .523.88m4.227.12h-3.75a1 1 0 0 1-.477-.12"></path>
        <path d="M12.25 8v4.25l3.685 2.117"></path>
      </>
  )
},
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SB.iconIdle} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          // sidebar-collapse-btn: oculto em tablet via CSS (auto-colapso por CSS já faz o trabalho)
          <button className="sidebar-collapse-btn" onClick={toggleCollapsed} style={styles.collapseBtn} aria-label="Recolher menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SB.iconIdle} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <nav className="sidebar-nav" style={styles.nav} aria-label="Navegação principal">
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
              <IconWrapper color={active ? SB.textActive : SB.iconIdle}>
                {n.icon}
              </IconWrapper>
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
  brandName: { fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: -0.5, whiteSpace: 'nowrap', fontFamily: 'var(--font-poppins), sans-serif' },
  collapseBtn: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2, overscrollBehavior: 'contain', scrollbarGutter: 'stable' },
  item: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', height: 40, borderRadius: 10, border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, transition: 'background .15s, color .15s', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  sepWrap: { padding: '10px 12px 4px', display: 'flex', alignItems: 'center', gap: 8 },
  sepLabel: { fontSize: 11, fontWeight: 700, color: SB.tagText, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  sepLine: { height: '0.5px', background: SB.border, margin: '6px 8px' },
};
