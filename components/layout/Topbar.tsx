// components/layout/Topbar.tsx
// Barra superior: fundo ivory + sombra na borda inferior (profundidade).
// À esquerda (só mobile): hambúrguer que abre o drawer.
// À direita: registrar estudo (+), notificações, toggle de tema, e avatar com menu.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';
import { useUI } from './UIContext';
import { useTimer } from '@/components/features/timer/TimerContext';
import { ManualLogModal } from '@/components/features/timer/ManualLogModal';
import { NotificationBell } from './NotificationBell';

export function Topbar() {
  const router = useRouter();
  const { theme: mode, toggleTheme, avatarUrl, setAvatarUrl, isMobile, toggleMobile } = useUI();
  const timer = useTimer();
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setAvatarUrl(data.user?.user_metadata?.avatar_url ?? null);
    });
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    // Limpa o timer ANTES de navegar — o router.push desmonta o componente
    // antes do onAuthStateChange disparar, então o abandon() precisa ser síncrono aqui.
    timer.abandon();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initial = (email?.[0] ?? '?').toUpperCase();

  return (
    <header style={{ ...styles.bar, padding: isMobile ? '0 16px' : '0 28px' }}>
      {/* Esquerda: hambúrguer (só mobile). No desktop fica vazio e o space-between empurra tudo pra direita. */}
      <div style={styles.left}>
        {isMobile && (
          <button onClick={toggleMobile} style={styles.iconBtn} title="Abrir menu" aria-label="Abrir menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        )}
      </div>

      <div style={styles.right}>
        {/* Registrar estudo manual (+) — no mobile colapsa pra só o ícone */}
        <button
          onClick={() => setLogOpen(true)}
          style={{ ...styles.addBtn, padding: isMobile ? 0 : '0 16px 0 13px', width: isMobile ? 38 : undefined, justifyContent: 'center' }}
          title="Registrar estudo"
          aria-label="Registrar estudo"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {!isMobile && <span style={styles.addLabel}>Registrar</span>}
        </button>

        {/* Notificações */}
        <NotificationBell />

        {/* Tema (dark) */}
        <button onClick={toggleTheme} style={styles.iconBtn} title="Alternar tema" aria-label="Alternar tema">
          {mode === 'light' ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={theme.warn}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </button>

        <div style={styles.sep} />

        {/* Avatar + menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen((v) => !v)} style={styles.avatarBtn} aria-label="Menu da conta">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarFallback}>{initial}</span>
            )}
          </button>

          {menuOpen && (
            <div style={styles.menu}>
              <div style={styles.menuHead}>
                <div style={styles.menuName}>Minha conta</div>
                <div style={styles.menuEmail}>{email ?? '—'}</div>
              </div>
              <button style={styles.menuItem} onClick={() => { setMenuOpen(false); router.push('/profile'); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>
                Meu perfil
              </button>
              <button style={styles.menuItem} onClick={() => { setMenuOpen(false); router.push('/settings'); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.3 2.5h4l.3-2.5a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z" /></svg>
                Configurações
              </button>
              <div style={styles.menuSep} />
              <button style={{ ...styles.menuItem, color: theme.danger }} onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.danger} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /></svg>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {logOpen && (
        <ManualLogModal
          onClose={() => setLogOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 60, flexShrink: 0, background: theme.bg,
    boxShadow: '0 1px 0 ' + theme.line + ', 0 6px 16px -10px rgba(40,40,30,.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', position: 'sticky', top: 0, zIndex: 20, fontFamily: theme.font,
  },
  left: { display: 'flex', alignItems: 'center' },
  right: { display: 'flex', alignItems: 'center', gap: 6 },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 7, height: 38,
    borderRadius: 10, border: 'none', background: theme.teal, cursor: 'pointer',
    marginRight: 4, fontFamily: 'inherit',
  },
  addLabel: { color: '#fff', fontSize: 13.5, fontWeight: 600 },
  iconBtn: {
    position: 'relative', width: 38, height: 38, borderRadius: 10, border: 'none',
    background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer',
    transition: 'background .15s',
  },
  sep: { width: 1, height: 22, background: theme.line, margin: '0 8px' },
  avatarBtn: {
    width: 36, height: 36, borderRadius: '50%', border: `0.5px solid ${theme.card}`,
    background: theme.teal, cursor: 'pointer', overflow: 'hidden', padding: 0,
    display: 'grid', placeItems: 'center',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: { color: '#fff', fontWeight: 600, fontSize: 15 },
  menu: {
    position: 'absolute', top: 46, right: 0, width: 240, background: theme.card,
    border: `0.5px solid ${theme.line}`, borderRadius: 14, boxShadow: theme.shadowHover,
    padding: 6, zIndex: 40,
  },
  menuHead: { padding: '10px 12px 12px', borderBottom: `0.5px solid ${theme.line}`, marginBottom: 6 },
  menuName: { fontSize: 13, fontWeight: 700, color: theme.ink },
  menuEmail: { fontSize: 12, color: theme.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px',
    borderRadius: 9, border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 13.5, fontWeight: 500, color: theme.inkSoft, textAlign: 'left', fontFamily: 'inherit',
  },
  menuSep: { height: '0.5px', background: theme.line, margin: '6px 0' },
};