// lib/lei-grifos.ts
// Motor de grifo do Vade Mecum: cores semânticas, segmentação de texto por
// grifos e conversão de seleção do DOM em offsets do texto plano do bloco.
import type { LeiGrifo, GrifoCor } from '@/services/leiInteracoes.service';

// As 4 categorias fixas (com significado) — 'livre' é tratado à parte porque
// sua cor/rótulo vêm do próprio grifo (corHex/label), não desta tabela.
export type GrifoCorFixa = Exclude<GrifoCor, 'livre'>;

// Cores fixas com significado — rgba funciona em light e dark mode.
export const GRIFO_CORES: Record<GrifoCorFixa, { bg: string; label: string; chip: string }> = {
  regra:       { bg: 'rgba(245, 199, 117, 0.45)', chip: '#EF9F27', label: 'Regra geral' },
  prazo:       { bg: 'rgba(151, 196, 89, 0.40)',  chip: '#639922', label: 'Prazo' },
  competencia: { bg: 'rgba(133, 183, 235, 0.40)', chip: '#378ADD', label: 'Competência' },
  excecao:     { bg: 'rgba(240, 149, 149, 0.42)', chip: '#E24B4A', label: 'Exceção / pegadinha' },
};

export const SUBLINHADO_COR = '#D85A30';

export const GRIFO_CORES_ORDEM: GrifoCorFixa[] = ['regra', 'prazo', 'competencia', 'excecao'];

// Paleta do marcador "livre" — cores deliberadamente diferentes das 4 fixas
// acima, pra não parecer mais uma categoria semântica pré-definida.
export const GRIFO_LIVRE_PALETA: string[] = [
  '#8B5CF6', '#14B8A6', '#EC4899', '#6366F1',
  '#A16207', '#06B6D4', '#65A30D', '#64748B',
];

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Cor/rótulo efetivos de um grifo, cobrindo as 4 categorias fixas, o
// sublinhado e o marcador livre (cor+nome escolhidos pelo usuário) num só
// lugar — evita reimplementar esse fallback em cada tela que lê grifos.
export function grifoVisual(g: LeiGrifo): { bg: string; chip: string; label: string } {
  if (g.estilo === 'sublinhado') return { bg: 'transparent', chip: SUBLINHADO_COR, label: 'Sublinhado' };
  if (g.cor === 'livre') {
    const chip = g.corHex || '#64748B';
    return { bg: hexToRgba(chip, 0.35), chip, label: g.label?.trim() || 'Marcador livre' };
  }
  return GRIFO_CORES[(g.cor ?? 'regra') as GrifoCorFixa];
}

// ─── Segmentação ─────────────────────────────────────────────────────────────
// Divide o texto de um bloco nos trechos grifados e não-grifados, em ordem.

export interface Segmento {
  texto: string;
  grifo: LeiGrifo | null;
}

export function segmentarBloco(texto: string, grifos: LeiGrifo[], blocoId: string): Segmento[] {
  const doBloco = grifos
    .filter((g) => g.bloco === blocoId && g.start < texto.length)
    .sort((a, b) => a.start - b.start);

  if (doBloco.length === 0) return [{ texto, grifo: null }];

  const segs: Segmento[] = [];
  let pos = 0;
  for (const g of doBloco) {
    const start = Math.max(pos, Math.min(g.start, texto.length));
    const end = Math.min(Math.max(g.end, start), texto.length);
    if (start > pos) segs.push({ texto: texto.slice(pos, start), grifo: null });
    if (end > start) segs.push({ texto: texto.slice(start, end), grifo: g });
    pos = Math.max(pos, end);
  }
  if (pos < texto.length) segs.push({ texto: texto.slice(pos), grifo: null });
  return segs;
}

export function temSobreposicao(grifos: LeiGrifo[], blocoId: string, start: number, end: number): boolean {
  return grifos.some((g) => g.bloco === blocoId && start < g.end && end > g.start);
}

// ─── Seleção → bloco + offsets ───────────────────────────────────────────────
// Localiza o bloco [data-bloco] envolvido na seleção atual e converte para
// offsets no texto plano dele. Usa Range.intersectsNode (não anchorNode) —
// o anchorNode do navegador às vezes resolve para o <p> pai em vez do próprio
// bloco quando o clique cai bem na fronteira entre o rótulo (ex.: "IV –") e o
// texto, o que fazia `anchorNode.closest('[data-bloco]')` falhar em silêncio
// (o bloco é filho do <p>, não ancestral). intersectsNode não depende de onde
// o navegador colocou o ponto âncora, só de sobreposição geométrica no DOM.

export type BlocoSelecao =
  | { ok: true; bloco: HTMLElement; start: number; end: number }
  | { ok: false; reason: 'nenhum' | 'multiplos' | 'vazio' };

export function findBlocoSelecionado(root: HTMLElement): BlocoSelecao {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return { ok: false, reason: 'nenhum' };
  const range = sel.getRangeAt(0);

  const candidatos = Array.from(root.querySelectorAll<HTMLElement>('[data-bloco]'))
    .filter((el) => range.intersectsNode(el));
  if (candidatos.length === 0) return { ok: false, reason: 'nenhum' };
  if (candidatos.length > 1) return { ok: false, reason: 'multiplos' };

  const bloco = candidatos[0];
  const full = document.createRange();
  full.selectNodeContents(bloco);

  // Trecho pode começar/terminar fora do bloco (ex.: âncora no <p> pai, antes
  // do bloco) — recorta (clamp) para as bordas do próprio bloco.
  const clamped = range.cloneRange();
  if (range.compareBoundaryPoints(Range.START_TO_START, full) < 0) clamped.setStart(bloco, 0);
  if (range.compareBoundaryPoints(Range.END_TO_END, full) > 0) clamped.setEnd(bloco, bloco.childNodes.length);
  if (clamped.collapsed) return { ok: false, reason: 'vazio' };

  const pre = clamped.cloneRange();
  pre.selectNodeContents(bloco);
  pre.setEnd(clamped.startContainer, clamped.startOffset);
  const start = pre.toString().length;
  const len = clamped.toString().length;
  if (len === 0) return { ok: false, reason: 'vazio' };

  return { ok: true, bloco, start, end: start + len };
}
