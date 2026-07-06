// lib/lei-grifos.ts
// Motor de grifo do Vade Mecum: cores semânticas, segmentação de texto por
// grifos e conversão de seleção do DOM em offsets do texto plano do bloco.
import type { LeiGrifo, GrifoCor } from '@/services/leiInteracoes.service';

// Cores fixas com significado — rgba funciona em light e dark mode.
export const GRIFO_CORES: Record<GrifoCor, { bg: string; label: string; chip: string }> = {
  regra:       { bg: 'rgba(245, 199, 117, 0.45)', chip: '#EF9F27', label: 'Regra geral' },
  prazo:       { bg: 'rgba(151, 196, 89, 0.40)',  chip: '#639922', label: 'Prazo' },
  competencia: { bg: 'rgba(133, 183, 235, 0.40)', chip: '#378ADD', label: 'Competência' },
  excecao:     { bg: 'rgba(240, 149, 149, 0.42)', chip: '#E24B4A', label: 'Exceção / pegadinha' },
};

export const SUBLINHADO_COR = '#D85A30';

export const GRIFO_CORES_ORDEM: GrifoCor[] = ['regra', 'prazo', 'competencia', 'excecao'];

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
