// components/layout/UIContext.tsx
// Estado global do shell: sidebar colapsada (desktop) + drawer mobile + tema (paleta × modo).
// Paleta e modo são persistidos no localStorage e aplicados como
// data-palette / data-mode no <html>. O CSS (globals.css) resolve as cores.
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Palette = 'petroleo' | 'rose' | 'menta' | 'grafite';
export type Mode = 'light' | 'dark';

export const PALETTES: { id: Palette; name: string; hint: string; swatch: string }[] = [
  { id: 'petroleo', name: 'Petróleo', hint: 'padrão', swatch: '#22484C' },
  { id: 'rose',     name: 'Rosé',     hint: 'rosa terroso', swatch: '#C67D80' },
  { id: 'menta',    name: 'Menta',    hint: 'verde esmeralda', swatch: '#4FD1A8' },
  { id: 'grafite',  name: 'Grafite',  hint: 'mono sóbrio', swatch: '#1b221f' },
];

const VALID_PALETTES: Palette[] = ['petroleo', 'rose', 'menta', 'grafite'];

// Breakpoint mobile único — alinhado ao que o resto da auditoria vai usar.
const MOBILE_QUERY = '(max-width: 767px)';

interface UIState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mode: Mode;
  toggleTheme: () => void;
  // alias retrocompatível: alguns componentes leem `theme`
  theme: Mode;
  palette: Palette;
  setPalette: (p: Palette) => void;
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  // --- mobile / drawer ---
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
}

const UIContext = createContext<UIState | null>(null);

function applyTheme(palette: Palette, mode: Mode) {
  const el = document.documentElement;
  el.setAttribute('data-palette', palette);
  el.setAttribute('data-mode', mode);
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<Mode>('light');
  const [palette, setPaletteState] = useState<Palette>('petroleo');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Nasce `false` no servidor e no 1º render do cliente (HTML idêntico, sem mismatch).
  // O valor real é lido no useEffect abaixo, já no navegador.
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // restaura preferências salvas (com migração do esquema antigo ui:theme)
  useEffect(() => {
    const c = localStorage.getItem('ui:collapsed');
    if (c) setCollapsed(c === '1');

    // modo: novo (ui:mode) com fallback pro antigo (ui:theme)
    const savedMode = (localStorage.getItem('ui:mode')
      ?? localStorage.getItem('ui:theme')) as Mode | null;
    const nextMode: Mode = savedMode === 'dark' ? 'dark' : 'light';

    // paleta: nova (ui:palette), validada
    const savedPalette = localStorage.getItem('ui:palette') as Palette | null;
    const nextPalette: Palette = (savedPalette && VALID_PALETTES.includes(savedPalette))
      ? savedPalette : 'petroleo';

    setMode(nextMode);
    setPaletteState(nextPalette);
    applyTheme(nextPalette, nextMode);

    // normaliza o storage pro esquema novo
    localStorage.setItem('ui:mode', nextMode);
    localStorage.setItem('ui:palette', nextPalette);
  }, []);

  // detecção de mobile (SSR-safe): só roda no cliente, reage a resize/rotação.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => {
      setIsMobile(mq.matches);
      // ao voltar pro desktop, garante que o drawer não fique preso aberto.
      if (!mq.matches) setMobileOpen(false);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // trava o scroll do body enquanto o drawer estiver aberto no mobile.
  useEffect(() => {
    if (mobileOpen && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen, isMobile]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem('ui:collapsed', next ? '1' : '0');
      return next;
    });
  }

  function toggleMobile() {
    setMobileOpen((v) => !v);
  }

  function toggleTheme() {
    setMode((v) => {
      const next: Mode = v === 'light' ? 'dark' : 'light';
      localStorage.setItem('ui:mode', next);
      applyTheme(palette, next);
      return next;
    });
  }

  function setPalette(p: Palette) {
    setPaletteState(p);
    localStorage.setItem('ui:palette', p);
    applyTheme(p, mode);
  }

  return (
    <UIContext.Provider
      value={{
        collapsed, toggleCollapsed,
        mode, toggleTheme, theme: mode,
        palette, setPalette,
        avatarUrl, setAvatarUrl,
        isMobile, mobileOpen, setMobileOpen, toggleMobile,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI deve ser usado dentro de <UIProvider>');
  return ctx;
}