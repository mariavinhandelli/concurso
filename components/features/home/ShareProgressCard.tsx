'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEditalCoverage, type EditalCoverage } from '@/services/coverage.service';
import { getStreak, type StreakInfo } from '@/services/streak.service';
import { getJourneyStats, type JourneyStats } from '@/services/journey.service';
import { useUser } from '@/components/layout/UserContext';
import { theme, zIndex } from '@/lib/theme';

// Paleta do card exportado — tema claro, no estilo da página de login (a imagem é fixa).
const BG = '#FFFFFF';
const INK = '#0F172A';
const INK_SOFT = '#475569';
const INK_MUTED = '#94A3B8';
const GREEN = '#22C55E';
const INDIGO = '#6366F1';
const NAVY = '#143D45';
const AMBER = '#F5A524';
const TRACK = '#E9EEF3';

const W = 1080;
const H = 1350;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

// Carrega uma imagem (SVG da marca); resolve null em caso de erro para não travar o desenho.
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface Payload {
  firstName: string;
  coverage: EditalCoverage;
  streak: number;
  hours: number;
}

// Preenche um texto centrado com gradiente horizontal (assinatura verde→índigo).
function fillCentroGradiente(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, c0: string, c1: string) {
  const w = ctx.measureText(text).width;
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillText(text, cx, y);
}

function draw(canvas: HTMLCanvasElement, p: Payload, logo: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const P = 90;
  const F = 'Poppins, Inter, system-ui, sans-serif';

  // Fundo claro
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Faixa de acento no topo — assinatura verde→índigo da marca
  const faixa = ctx.createLinearGradient(0, 0, W, 0);
  faixa.addColorStop(0, GREEN);
  faixa.addColorStop(1, INDIGO);
  ctx.fillStyle = faixa;
  ctx.fillRect(0, 0, W, 14);

  // Marca (logo + slogan) + data. Desenha a imagem INTEIRA (sem recorte de fonte,
  // que o canvas trata mal em SVG) e calcula dx para alinhar a borda esquerda do
  // símbolo — em (114.28, 109.36) no viewBox após o transform — ao vocativo (x=P).
  ctx.textBaseline = 'alphabetic';
  if (logo) {
    const s = 0.5;                          // escala da marca no card
    const MARK_X = 114.28, MARK_Y = 109.36; // borda/topo do símbolo no viewBox
    const dx = P - MARK_X * s;              // símbolo alinhado à esquerda em x=P
    const dy = 80 - MARK_Y * s;             // topo do símbolo fixo em y=80
    ctx.drawImage(logo, dx, dy, 1200 * s, 420 * s);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = NAVY;
    ctx.font = `600 50px ${F}`;
    ctx.fillText('focali', P, 132);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = INK_MUTED;
  ctx.font = `400 30px ${F}`;
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillText(hoje, W - P, 118);

  // Saudação
  ctx.textAlign = 'left';
  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 38px ${F}`;
  const saud = p.firstName ? `${p.firstName}, sua jornada rumo à aprovação` : 'Minha jornada rumo à aprovação';
  ctx.fillText(truncate(ctx, saud, W - 2 * P), P, 270);

  const temEdital = p.coverage.hasTarget && p.coverage.total > 0;

  // ── Herói (número em gradiente verde→índigo) ──
  ctx.textAlign = 'center';
  ctx.font = `800 250px ${F}`;
  if (temEdital) {
    fillCentroGradiente(ctx, `${p.coverage.pct}%`, W / 2, 640, GREEN, INDIGO);
    ctx.fillStyle = INK;
    ctx.font = `500 46px ${F}`;
    ctx.fillText('do edital coberto', W / 2, 720);
    ctx.fillStyle = INK_MUTED;
    ctx.font = `400 32px ${F}`;
    ctx.fillText(truncate(ctx, p.coverage.targetName ?? '', W - 2 * P), W / 2, 778);
  } else {
    fillCentroGradiente(ctx, `${p.streak}`, W / 2, 640, GREEN, INDIGO);
    ctx.fillStyle = INK;
    ctx.font = `500 46px ${F}`;
    ctx.fillText(p.streak === 1 ? 'dia de ofensiva' : 'dias de ofensiva', W / 2, 720);
  }

  // ── Barra segmentada (só quando há edital) ──
  let statsY = 900;
  if (temEdital) {
    const bx = P, by = 840, bw = W - 2 * P, bh = 30;
    const { mastered, inProgress, notStarted, total } = p.coverage;
    ctx.save();
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.clip();
    ctx.fillStyle = TRACK;
    ctx.fillRect(bx, by, bw, bh);
    let cx = bx;
    const seg = (count: number, color: string) => {
      const sw = (count / total) * bw;
      ctx.fillStyle = color;
      ctx.fillRect(cx, by, sw, bh);
      cx += sw;
    };
    seg(mastered, GREEN);
    seg(inProgress, AMBER);
    seg(notStarted, TRACK);
    ctx.restore();
    statsY = 1030;
  }

  // ── Três métricas — colunas afastadas (0.2/0.5/0.8) e rótulos curtos p/ não colidir ──
  const cols = [
    { n: `${p.streak}`, l: 'dias seguidos' },
    { n: temEdital ? `${p.coverage.mastered}` : `${p.coverage.covered}`, l: 'dominados' },
    { n: `${p.hours}h`, l: 'estudadas' },
  ];
  const cxs = [W * 0.2, W * 0.5, W * 0.8];
  cols.forEach((c, i) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `700 76px ${F}`;
    ctx.fillText(c.n, cxs[i], statsY + 76);
    ctx.fillStyle = INK_SOFT;
    ctx.font = `400 28px ${F}`;
    ctx.fillText(c.l, cxs[i], statsY + 128);
  });

  // ── Rodapé ──
  ctx.textAlign = 'center';
  ctx.fillStyle = GREEN;
  ctx.font = `600 38px ${F}`;
  ctx.fillText('Constância que aprova.', W / 2, H - 120);
  ctx.fillStyle = INK_MUTED;
  ctx.font = `400 30px ${F}`;
  ctx.fillText('feito com a Focali', W / 2, H - 70);
}

export function ShareProgressCard({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { name } = useUser();
  const [canShare, setCanShare] = useState(false);

  const { data: coverage } = useQuery<EditalCoverage>({ queryKey: ['edital-coverage'], queryFn: getEditalCoverage });
  const { data: streak } = useQuery<StreakInfo>({ queryKey: ['streak'], queryFn: () => getStreak() });
  const { data: journey } = useQuery<JourneyStats>({ queryKey: ['journey-stats'], queryFn: getJourneyStats });

  const ready = !!coverage && !!streak && !!journey;

  // Capacidade do browser só após montar — evita mismatch de hidratação (SSR não tem navigator).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); }, []);

  // Fecha no Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    let cancelled = false;
    (async () => {
      try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* fontes opcionais */ }
      const logo = await loadImage('/brand/logo-slogan-clean.svg');
      if (cancelled || !canvasRef.current) return;
      draw(canvasRef.current, {
        firstName: (name ?? '').split(' ')[0] ?? '',
        coverage: coverage!,
        streak: streak!.current,
        hours: Math.round(journey!.totalMinutes / 60),
      }, logo);
    })();
    return () => { cancelled = true; };
  }, [ready, name, coverage, streak, journey]);

  function withBlob(cb: (blob: Blob) => void) {
    canvasRef.current?.toBlob((blob) => { if (blob) cb(blob); }, 'image/png');
  }

  function baixar() {
    withBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'focali-progresso.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function compartilhar() {
    withBlob(async (blob) => {
      const file = new File([blob], 'focali-progresso.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Meu progresso na Focali' }); }
        catch { /* usuário cancelou */ }
      } else {
        baixar();
      }
    });
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <h2 style={styles.h2}>Compartilhar progresso</h2>
          <button style={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <p style={styles.subtitle}>Mostre sua evolução — mande no grupo e inspire (ou provoque) a galera.</p>

        <div style={styles.canvasWrap}>
          {!ready && <div style={styles.loading}>Gerando imagem…</div>}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ ...styles.canvas, opacity: ready ? 1 : 0 }}
          />
        </div>

        <div style={styles.actions}>
          <button style={styles.primary} onClick={baixar} disabled={!ready}>Baixar imagem</button>
          {canShare && <button style={styles.secondary} onClick={compartilhar} disabled={!ready}>Compartilhar</button>}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(9,17,30,0.55)',
    display: 'grid', placeItems: 'center', padding: 20, zIndex: zIndex.modal,
  },
  modal: {
    background: theme.card, borderRadius: theme.radius, boxShadow: theme.shadowModal,
    padding: 22, width: '100%', maxWidth: 420, fontFamily: theme.font,
    maxHeight: '92vh', overflowY: 'auto',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  close: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', padding: 4, lineHeight: 1 },
  subtitle: { fontSize: 13.5, color: theme.inkSoft, margin: '4px 0 16px', lineHeight: 1.5 },

  canvasWrap: { position: 'relative', display: 'grid', placeItems: 'center', minHeight: 200 },
  canvas: { width: '100%', maxWidth: 300, height: 'auto', borderRadius: 14, display: 'block', border: `0.5px solid ${theme.line}`, boxShadow: theme.shadow, transition: 'opacity .3s' },
  loading: { position: 'absolute', fontSize: 13.5, color: theme.inkSoft },

  actions: { display: 'flex', gap: 10, marginTop: 18 },
  primary: {
    flex: 1, padding: '12px 16px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  secondary: {
    flex: 1, padding: '12px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
};
