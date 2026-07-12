// lib/theme.ts
// SISTEMA DE DESIGN — valores resolvem via CSS Variables (claro/escuro).
// As cores reais vivem em globals.css; aqui só apontamos pras variáveis.

export const theme = {
  bg: 'var(--bg)',
  card: 'var(--card)',
  muted: 'var(--muted)',
  line: 'var(--line)',
  lineStrong: 'var(--line-strong)',

  ink: 'var(--ink)',
  inkSoft: 'var(--ink-soft)',
  inkFaint: 'var(--ink-faint)',

  /* primary = botão primário (#143D45). teal = verde sucesso/progresso (#22C55E). */
  primary: 'var(--primary)',
  primaryHover: 'var(--primary-hover)',
  onPrimary: 'var(--on-primary)',

  teal: 'var(--teal)',
  tealDeep: 'var(--teal-deep)',
  tealSoft: 'var(--teal-soft)',
  tealBg: 'var(--teal-bg)',
  onTeal: 'var(--on-teal)',

  clay: 'var(--clay)',
  clayDeep: 'var(--clay-deep)',
  claySoft: 'var(--clay-soft)',
  clayBg: 'var(--clay-bg)',

  danger: 'var(--danger)',
  dangerBg: 'var(--danger-bg)',
  ok: 'var(--ok)',     okBg: 'var(--ok-bg)',
  warn: 'var(--warn)', warnBg: 'var(--warn-bg)',
  crit: 'var(--crit)', critBg: 'var(--crit-bg)',

  info: 'var(--info)',    infoBg: 'var(--info-bg)',

  /* Marca — gradiente de CTA (1 por tela, no topbar e momentos-chave),
     acento de destaque (links/palavras) e backdrop único de modais. */
  gradientCta: 'var(--gradient-cta)',
  gradientCtaHover: 'var(--gradient-cta-hover)',
  onCta: 'var(--on-cta)',
  brandAccent: 'var(--brand-accent)',
  backdrop: 'var(--backdrop)',

  /* Texto sobre fundos de status — nunca '#fff' hardcoded (quebra no dark). */
  onDanger: 'var(--on-danger)',
  onWarn: 'var(--on-warn)',
  onClay: 'var(--on-clay)',
  onOk: 'var(--on-ok)',

  okDeep: 'var(--ok-deep)',
  warnDeep: 'var(--warn-deep)',
  dangerTint: 'var(--danger-tint)',
  okTint: 'var(--ok-tint)',
  warnTint: 'var(--warn-tint)',

  shadow: 'var(--shadow)',
  shadowCard: 'var(--shadow-card)',
  shadowHover: 'var(--shadow-hover)',
  shadowModal: 'var(--shadow-modal)',

  radius: 16,
  radiusSm: 12,
  radiusXs: 8,
  radiusLg: 24,
  radiusPill: 999,
  font: "var(--font-poppins), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

// Réguas de página — centradas horizontalmente via margin auto; padding inicial padrão.
//   pageList: listas e formulários (coluna contida, leitura confortável).
//   pageWide: dashboards e grades (ocupa a largura com conteúdo denso).
export const pageList: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '34px 40px',
  fontFamily: theme.font,
};

export const pageWide: React.CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '34px 40px',
  fontFamily: theme.font,
};

// Escala de z-index — use sempre estes valores para empilhamento previsível.
export const zIndex = {
  topbar:   20,   // header sticky
  fab:      50,   // FloatingTimer
  overlay:  60,   // fundos de modal (backdrop)
  modal:    70,   // modais comuns
  drawer:   30,   // sidebar / nav lateral
  dialog:  200,   // ConfirmDialog (acima de qualquer modal)
  toast:   300,   // ToastProvider (sempre visível)
} as const;

// Cor de desempenho por taxa de acerto (0–1). Status universal.
// Régua de alta performance: ≥80% bom, 65–79% médio, <65% precisa de atenção.
export function perfColor(rate: number) {
  if (rate < 0.65) return { fg: theme.crit, bg: theme.critBg, deep: theme.danger };
  if (rate < 0.80) return { fg: theme.warn, bg: theme.warnBg, deep: theme.warn };
  return { fg: theme.ok, bg: theme.okBg, deep: theme.ok };
}

export const cardBase: React.CSSProperties = {
  background: theme.card,
  border: `0.5px solid ${theme.line}`,
  borderRadius: theme.radius,
  boxShadow: theme.shadow,
};

export const btnOutline: React.CSSProperties = {
  padding: '10px 20px', borderRadius: theme.radiusSm,
  border: `0.5px solid ${theme.line}`, background: theme.card,
  color: theme.inkSoft, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: theme.font,
};

export const kbd: React.CSSProperties = {
  background: theme.muted, border: `0.5px solid ${theme.line}`,
  borderRadius: 4, padding: '0px 5px', fontSize: 10.5, fontFamily: 'monospace',
};