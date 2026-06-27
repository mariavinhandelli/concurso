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

  shadow: 'var(--shadow)',
  shadowCard: 'var(--shadow-card)',
  shadowHover: 'var(--shadow-hover)',
  shadowModal: 'var(--shadow-modal)',

  radius: 16,
  radiusSm: 12,
  radiusXs: 8,
  radiusLg: 24,
  font: "var(--font-poppins), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

// Réguas de página — AMBAS alinhadas à esquerda, mesmo padding inicial.
// Páginas começam no mesmo ponto junto da sidebar; a largura varia por tipo.
//   pageList: listas e formulários (coluna contida, leitura confortável).
//   pageWide: dashboards e grades (ocupa a largura com conteúdo denso).
export const pageList: React.CSSProperties = {
  maxWidth: 760,
  margin: '0',
  padding: '34px 48px',
  fontFamily: theme.font,
};

export const pageWide: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0',
  padding: '34px 48px',
  fontFamily: theme.font,
};

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