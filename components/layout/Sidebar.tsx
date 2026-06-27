'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { useUI } from './UIContext';

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

const NAV = [
  { href: '/', label: 'Home', icon: <path d="m2 8l9.732-4.866a.6.6 0 0 1 .536 0L22 8m-2 3v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" /> },
  { href: '/calendar', 
    label: 'Calendário', 
    icon: (
      <> 
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 3.75H2.25a1.5 1.5 0 0 0-1.5 1.5v16.5a1.5 1.5 0 0 0 1.5 1.5h19.5a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5m-21 6h22.5M6.75 6V.75M17.25 6V.75"></path>
    <path d="M5.625 14.25a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75m0 6a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75M12 14.25a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75m0 6a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75m6.375-4.5a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75m0 6a.375.375 0 0 1 0-.75m0 .75a.375.375 0 0 0 0-.75"></path>
  </>
  )
    },

  { 
    href: '/schedule', 
    label: 'Cronograma', 
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
  { href: '/targets', label: 'Edital Verticalizado', icon: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h1M4 12h1m-1 5.5h1" /> },
  { href: '/notebook', label: 'Cadernos de Erros', icon: <path d="M5 20.25c0 .414.336.75.75.75h10.652C17.565 21 18 20.635 18 19.4v-1.445M5 20.25A2.25 2.25 0 0 1 7.25 18h10.152q.339 0 .598-.045M5 20.25V6.2c0-1.136-.072-2.389 1.092-2.982C6.52 3 7.08 3 8.2 3h9.2c1.236 0 1.6.437 1.6 1.6v11.8c0 .995-.282 1.425-1 1.555M10 8l4 4m0-4l-4 4" /> },
  { href: '/flashcards', label: 'Flashcards', icon: <path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" /> },
  { href: '/reviews', label: 'Revisões', icon: <path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" /> },
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
  const { collapsed, toggleCollapsed, isMobile, mobileOpen, setMobileOpen } = useUI();
  const [hover, setHover] = useState<string | null>(null);

  // No mobile o drawer é sempre largura cheia (nunca "só ícones") e a seta de colapso
  // não tem função; quem comanda é o estado mobileOpen via translateX.
  const isCollapsed = isMobile ? false : collapsed;
  const W = isMobile ? 244 : (collapsed ? 72 : 244);

  function go(href: string) {
    router.push(href);
    if (isMobile) setMobileOpen(false); // fecha o drawer ao navegar
  }

  return (
    <aside
      style={{
        ...styles.aside,
        width: W,
        // Mobile: drawer sobreposto que desliza. Desktop: largura fixa, transform neutro.
        transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: isMobile && mobileOpen ? '4px 0 24px -6px rgba(20,28,30,.4)' : 'none',
        transition: 'width .24s cubic-bezier(.2,.7,.3,1), transform .26s cubic-bezier(.2,.7,.3,1)',
      }}
    >
      <div style={{ ...styles.brand, justifyContent: isCollapsed ? 'center' : 'space-between' }}>
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
            <div style={styles.brandName}>focali</div>
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
          // Mobile: botão de fechar (X) no lugar da seta de colapso.
          <button onClick={() => setMobileOpen(false)} style={styles.collapseBtn} aria-label="Fechar menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SB.iconIdle} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button onClick={toggleCollapsed} style={styles.collapseBtn} aria-label="Recolher menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SB.iconIdle} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <nav style={styles.nav}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          const isHover = hover === n.href;
          return (
            <button
              key={n.href}
              onClick={() => go(n.href)}
              onMouseEnter={() => setHover(n.href)}
              onMouseLeave={() => setHover(null)}
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
              {!isCollapsed && <span>{n.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  aside: { flexShrink: 0, height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 30, background: SB.bg, borderRight: `0.5px solid ${SB.border}`, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-poppins), sans-serif', overflow: 'hidden' },
  brand: { display: 'flex', alignItems: 'center', height: 40, marginBottom: 18, padding: '0 4px' },
  brandInner: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center', flexShrink: 0 },
  brandName: { fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: -0.5, whiteSpace: 'nowrap', fontFamily: 'var(--font-poppins), sans-serif' },
  collapseBtn: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  item: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', height: 40, borderRadius: 10, border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, transition: 'background .15s, color .15s', fontFamily: 'inherit', whiteSpace: 'nowrap' },
};