// components/layout/UIContext.tsx
// Estado global do shell — dividido em três contextos independentes:
//   ThemeContext  → mode (light/dark) + palette
//   ShellContext  → sidebar collapsed + drawer mobile
//   useBreakpoints → hook standalone, sem contexto (sem re-render cascata)
//
// useUI() permanece como facade de compatibilidade — lê os três e combina.
// Novos componentes devem usar useTheme(), useShell() ou useBreakpoints()
// diretamente para evitar re-renders desnecessários entre preocupações.
'use client';

import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useState, useSyncExternalStore, type ReactNode,
} from 'react';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type Palette = 'petroleo' | 'rose' | 'menta' | 'grafite';
export type Mode = 'light' | 'dark';

export const PALETTES: { id: Palette; name: string; hint: string; swatch: string }[] = [
  { id: 'petroleo', name: 'Focali',  hint: 'padrão',           swatch: 'linear-gradient(135deg, #143D45 50%, #22C55E 50%)' },
  { id: 'rose',     name: 'Rosé',    hint: 'rosa terroso',     swatch: 'linear-gradient(135deg, #cf8588 50%, #9B5C6E 50%)' },
  { id: 'menta',    name: 'Violeta', hint: 'índigo & menta',   swatch: 'linear-gradient(135deg, #6366F1 50%, #C5EEDD 50%)' },
  { id: 'grafite',  name: 'Grafite', hint: 'mono sóbrio',      swatch: 'linear-gradient(135deg, #1b221f 50%, #97A39D 50%)' },
];

const VALID_PALETTES: Palette[] = ['petroleo', 'rose', 'menta', 'grafite'];

// ─── Breakpoints — hook standalone (sem context, sem re-render cascata) ────────

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1199px)';

// Instâncias de nível de módulo — criadas uma vez, nunca recriadas por render.
// Garante que useSyncExternalStore receba funções estáveis e não re-inscreva a cada render.
const mqMobileList = typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY) : null;
const mqTabletList = typeof window !== 'undefined' ? window.matchMedia(TABLET_QUERY) : null;

function subscribeMobile(cb: () => void) {
  if (!mqMobileList) return () => {};
  mqMobileList.addEventListener('change', cb);
  return () => mqMobileList.removeEventListener('change', cb);
}
function subscribeTablet(cb: () => void) {
  if (!mqTabletList) return () => {};
  mqTabletList.addEventListener('change', cb);
  return () => mqTabletList.removeEventListener('change', cb);
}
const getIsMobile = () => mqMobileList?.matches ?? false;
const getIsTablet = () => mqTabletList?.matches ?? false;
const getSSRFalse = () => false;

export function useBreakpoints(): { isMobile: boolean; isTablet: boolean } {
  const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, getSSRFalse);
  const isTablet = useSyncExternalStore(subscribeTablet, getIsTablet, getSSRFalse);
  return { isMobile, isTablet };
}

// ─── ThemeContext ──────────────────────────────────────────────────────────────

interface ThemeState {
  mode: Mode;
  palette: Palette;
  toggleTheme: () => void;
  setPalette: (p: Palette) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function applyTheme(palette: Palette, mode: Mode) {
  document.documentElement.setAttribute('data-palette', palette);
  document.documentElement.setAttribute('data-mode', mode);
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');
  const [palette, setPaletteState] = useState<Palette>('petroleo');

  // Aplica ao DOM sempre que mode ou palette mudam — única fonte de verdade para o DOM.
  // Mantém applyTheme fora dos updaters de estado (updaters devem ser pure functions).
  useEffect(() => {
    applyTheme(palette, mode);
  }, [palette, mode]);

  // Restaura preferências salvas no primeiro mount.
  useEffect(() => {
    const savedMode = (localStorage.getItem('ui:mode') ?? localStorage.getItem('ui:theme')) as Mode | null;
    const nextMode: Mode = savedMode === 'dark' ? 'dark' : 'light';
    const savedPalette = localStorage.getItem('ui:palette') as Palette | null;
    const nextPalette: Palette = savedPalette && VALID_PALETTES.includes(savedPalette)
      ? savedPalette : 'petroleo';
    setMode(nextMode);
    setPaletteState(nextPalette);
    // normaliza storage para o esquema novo
    localStorage.setItem('ui:mode', nextMode);
    localStorage.setItem('ui:palette', nextPalette);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((v) => {
      const next: Mode = v === 'light' ? 'dark' : 'light';
      localStorage.setItem('ui:mode', next);
      return next;
    });
  }, []);

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p);
    localStorage.setItem('ui:palette', p);
  }, []);

  const value = useMemo(() => ({ mode, palette, toggleTheme, setPalette }), [mode, palette, toggleTheme, setPalette]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <UIProvider>');
  return ctx;
}

// ─── ShellContext ──────────────────────────────────────────────────────────────

interface ShellState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
}

const ShellContext = createContext<ShellState | null>(null);

function ShellProvider({ children }: { children: ReactNode }) {
  // Sempre inicia em `false` — precisa bater com a renderização do servidor
  // (que nunca tem acesso ao localStorage) para não causar hydration mismatch.
  // A preferência salva é aplicada logo abaixo, no useEffect pós-mount.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restaura preferência salva
  useEffect(() => {
    const c = localStorage.getItem('ui:collapsed');
    if (c !== null) setCollapsed(c === '1');
  }, []);

  // Trava o scroll quando o drawer mobile está aberto
  const { isMobile } = useBreakpoints();
  useEffect(() => {
    if (mobileOpen && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen, isMobile]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem('ui:collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

  const value = useMemo(
    () => ({ collapsed, mobileOpen, toggleCollapsed, setMobileOpen, toggleMobile }),
    [collapsed, mobileOpen, toggleCollapsed, toggleMobile],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell deve ser usado dentro de <UIProvider>');
  return ctx;
}

// ─── UIProvider + useUI (facade de compatibilidade) ────────────────────────────

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ShellProvider>
        {children}
      </ShellProvider>
    </ThemeProvider>
  );
}

/** Facade de compatibilidade — combina os três contextos internos. */
export function useUI() {
  const theme = useTheme();
  const shell = useShell();
  const breakpoints = useBreakpoints();

  return {
    // theme
    mode: theme.mode,
    theme: theme.mode, // alias retrocompatível
    palette: theme.palette,
    toggleTheme: theme.toggleTheme,
    setPalette: theme.setPalette,
    // shell
    collapsed: shell.collapsed,
    mobileOpen: shell.mobileOpen,
    toggleCollapsed: shell.toggleCollapsed,
    setMobileOpen: shell.setMobileOpen,
    toggleMobile: shell.toggleMobile,
    // breakpoints
    isMobile: breakpoints.isMobile,
    isTablet: breakpoints.isTablet,
  };
}
