// components/layout/Topbar.tsx
// Barra superior: fundo ivory + sombra na borda inferior (profundidade).
// À esquerda (só mobile): hambúrguer que abre o drawer.
// À direita: registrar estudo (+), notificações, toggle de tema, e avatar com menu.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Menu, Plus, Zap, Clock, Moon, Sun, User, Settings, LogOut } from 'lucide-react';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { invalidateArchivedCache } from '@/services/archivedCache';
import { theme } from '@/lib/theme';
import { useUI } from './UIContext';
import { useUser } from './UserContext';
import { useTimer } from '@/components/features/timer/TimerContext';
import { ManualLogModal } from '@/components/features/timer/ManualLogModal';
import { QuickLogModal } from '@/components/features/timer/QuickLogModal';
import { NotificationBell } from './NotificationBell';
import { useToast } from '@/components/ui/ToastProvider';
import { OPEN_COMMAND_EVENT, OPEN_QUICKLOG_EVENT } from '@/components/features/command/CommandPalette';

export function Topbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme: mode, toggleTheme, toggleMobile } = useUI();
  const { email, avatarUrl, loaded: userLoaded } = useUser();
  const timer = useTimer();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // O Command Palette dispara este evento ao escolher "Registrar questões".
  useEffect(() => {
    function onQuickLog() { setQuickOpen(true); }
    window.addEventListener(OPEN_QUICKLOG_EVENT, onQuickLog);
    return () => window.removeEventListener(OPEN_QUICKLOG_EVENT, onQuickLog);
  }, []);

  async function handleLogout() {
    // Limpa o timer ANTES de navegar — o router.push desmonta o componente
    // antes do onAuthStateChange disparar, então o abandon() precisa ser síncrono aqui.
    timer.abandon();
    invalidateArchivedCache();
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Não foi possível sair. Verifique sua conexão e tente novamente.');
    }
  }

  const initial = (email?.[0] ?? '?').toUpperCase();

  return (
    <header className="topbar-bar" style={styles.bar}>
      {/* Esquerda: hambúrguer renderizado sempre; CSS oculta em desktop (topbar-hamburger). */}
      <div style={styles.left}>
        <button className="topbar-hamburger" onClick={toggleMobile} style={styles.iconBtn} title="Abrir menu" aria-label="Abrir menu">
          <Menu size={22} color={theme.inkSoft} strokeWidth={1.9} />
        </button>
      </div>

      <div style={styles.right}>
        {/* Busca global / Command Palette — atalho Ctrl/Cmd+K */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_EVENT))}
          style={styles.searchBtn}
          title="Buscar (Ctrl+K)"
          aria-label="Buscar"
        >
          <Search size={17} color={theme.inkSoft} strokeWidth={1.9} />
          <span className="topbar-search-hint" style={styles.searchHint}>Buscar</span>
          <kbd className="topbar-search-hint" style={styles.searchKbd}>Ctrl K</kbd>
        </button>

        {/* Registrar estudo — menu com Quick-Log (questões) e sessão completa.
            Label oculto em mobile via CSS (topbar-add-label / topbar-add-btn). */}
        <div ref={addRef} style={{ position: 'relative' }}>
          <button
            className="topbar-add-btn"
            onClick={() => setAddMenuOpen((v) => !v)}
            style={{ ...styles.addBtn, justifyContent: 'center' }}
            title="Registrar estudo"
            aria-label="Registrar estudo"
            aria-haspopup="menu"
            aria-expanded={addMenuOpen}
          >
            <Plus size={17} color={theme.onTeal} strokeWidth={2.2} />
            <span className="topbar-add-label" style={styles.addLabel}>Registrar estudo</span>
          </button>

          {addMenuOpen && (
            <div style={styles.addMenu} role="menu">
              <button
                style={styles.menuItem}
                role="menuitem"
                onClick={() => { setAddMenuOpen(false); setQuickOpen(true); }}
              >
                <Zap size={16} color={theme.warn} strokeWidth={1.8} />
                <span>
                  Questões rápidas
                  <span style={styles.menuHint}>total + acertos, em segundos</span>
                </span>
              </button>
              <button
                style={styles.menuItem}
                role="menuitem"
                onClick={() => { setAddMenuOpen(false); setLogOpen(true); }}
              >
                <Clock size={16} color={theme.inkSoft} strokeWidth={1.8} />
                <span>
                  Sessão completa
                  <span style={styles.menuHint}>data, duração, feedback</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Notificações */}
        <NotificationBell />

        {/* Tema (dark) */}
        <button onClick={toggleTheme} style={styles.iconBtn} title="Alternar tema" aria-label="Alternar tema">
          {mode === 'light' ? (
            <Moon size={19} color={theme.inkSoft} strokeWidth={1.8} />
          ) : (
            <Sun size={19} color={theme.warn} strokeWidth={1.8} />
          )}
        </button>

        <div style={styles.sep} />

        {/* Avatar + menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen((v) => !v)} style={styles.avatarBtn} aria-label="Menu da conta">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar do usuário" width={36} height={36} style={styles.avatarImg} />
            ) : userLoaded ? (
              <span style={styles.avatarFallback}>{initial}</span>
            ) : (
              <span aria-hidden="true" style={styles.avatarSkeleton} />
            )}
          </button>

          {menuOpen && (
            <div style={styles.menu}>
              <div style={styles.menuHead}>
                <div style={styles.menuName}>Minha conta</div>
                <div style={styles.menuEmail}>{email ?? '—'}</div>
              </div>
              <button style={styles.menuItem} onClick={() => { setMenuOpen(false); router.push('/profile'); }}>
                <User size={16} color={theme.inkSoft} strokeWidth={1.8} />
                Meu perfil
              </button>
              <button style={styles.menuItem} onClick={() => { setMenuOpen(false); router.push('/settings'); }}>
                <Settings size={16} color={theme.inkSoft} strokeWidth={1.8} />
                Configurações
              </button>
              <div style={styles.menuSep} />
              <button style={{ ...styles.menuItem, color: theme.danger }} onClick={handleLogout}>
                <LogOut size={16} color={theme.danger} strokeWidth={1.8} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {logOpen && (
        <ManualLogModal
          onClose={() => setLogOpen(false)}
          onSaved={() => { refreshHomeAfterSession(queryClient); router.refresh(); }}
        />
      )}

      {quickOpen && (
        <QuickLogModal
          onClose={() => setQuickOpen(false)}
          onSaved={() => { refreshHomeAfterSession(queryClient); router.refresh(); }}
          onSwitchToFull={() => { setQuickOpen(false); setLogOpen(true); }}
        />
      )}
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: '60px', flexShrink: 0, background: theme.bg,
    boxShadow: '0 1px 0 ' + theme.line + ', 0 6px 16px -10px rgba(40,40,30,.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', position: 'sticky', top: 0, zIndex: 20, fontFamily: theme.font,
  },
  left: { display: 'flex', alignItems: 'center' },
  right: { display: 'flex', alignItems: 'center', gap: '6px' },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '7px', height: '44px',
    borderRadius: '10px', borderStyle: 'none', background: theme.primary, cursor: 'pointer',
    marginRight: '4px', fontFamily: 'inherit', padding: '0 16px 0 13px',
  },
  addLabel: { color: theme.onTeal, fontSize: 14, fontWeight: 600 },
  searchBtn: { display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 10px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', fontFamily: 'inherit', marginRight: 2 },
  searchHint: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },
  searchKbd: { fontFamily: 'ui-monospace, monospace', fontSize: 11, color: theme.inkFaint, border: `0.5px solid ${theme.line}`, borderRadius: 5, padding: '2px 6px', background: theme.muted },
  addMenu: {
    position: 'absolute', top: '50px', right: 0, width: 'min(250px, calc(100vw - 32px))', background: theme.card,
    border: `0.5px solid ${theme.line}`, borderRadius: '14px', boxShadow: theme.shadowHover,
    padding: '6px', zIndex: 40,
  },
  menuHint: { display: 'block', fontSize: 12, fontWeight: 400, color: theme.inkFaint, marginTop: 1 },
  iconBtn: {
    position: 'relative', width: '44px', height: '44px', borderRadius: '10px', borderStyle: 'none',
    background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer',
    transition: 'background .15s',
  },
  sep: { width: '1px', height: '22px', background: theme.line, margin: '0 8px' },
  avatarBtn: {
    width: '44px', height: '44px', borderRadius: '50%', border: `0.5px solid ${theme.card}`,
    background: theme.primary, cursor: 'pointer', overflow: 'hidden', padding: 0,
    display: 'grid', placeItems: 'center',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: { color: theme.onTeal, fontWeight: 600, fontSize: 15 },
  avatarSkeleton: { width: '100%', height: '100%', borderRadius: '50%', background: theme.muted, animation: 'skeleton-pulse 1.4s ease infinite', display: 'block' },
  menu: {
    position: 'absolute', top: '46px', right: 0, width: 'min(240px, calc(100vw - 32px))', background: theme.card,
    border: `0.5px solid ${theme.line}`, borderRadius: '14px', boxShadow: theme.shadowHover,
    padding: '6px', zIndex: 40, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
  },
  menuHead: { padding: '10px 12px 12px', borderBottom: `0.5px solid ${theme.line}`, marginBottom: 6 },
  menuName: { fontSize: 13, fontWeight: 700, color: theme.ink },
  menuEmail: { fontSize: 12, color: theme.inkFaint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px',
    borderRadius: '9px', borderStyle: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, color: theme.inkSoft, textAlign: 'left', fontFamily: 'inherit',
  },
  menuSep: { height: '0.5px', background: theme.line, margin: '6px 0' },
};