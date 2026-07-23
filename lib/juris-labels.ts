// lib/juris-labels.ts
// Rótulos e cores compartilhados do módulo Jurisprudências — antes reescritos
// em JurisprudenciaCard, JurisprudenciaDetail, [id]/page e revisar/page (4 cópias
// que já haviam divergido em abreviações). Leve de propósito: NÃO importa o
// service (que embute os ~840KB de julgados), só o theme.
import { theme } from '@/lib/theme';
import type { JurisRating } from '@/lib/juris-review';

export const TIPO_LABEL: Record<string, string> = {
  sumula: 'Súmula', sumula_vinculante: 'Súmula Vinculante', acordao: 'Acórdão',
  decisao_monocratica: 'Decisão Monocrática', informativo: 'Informativo', outro: 'Outro',
};

// Versão curta para badges de card (espaço apertado).
export const TIPO_LABEL_SHORT: Record<string, string> = {
  ...TIPO_LABEL,
  sumula_vinculante: 'Súm. Vinculante',
  decisao_monocratica: 'Dec. Monocrática',
};

export const STATUS_LABEL: Record<string, string> = {
  vigente: 'Vigente', cancelada: 'Cancelada', substituida: 'Substituída', revisada: 'Revisada',
};

export const INCIDENCIA_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', muito_alta: 'Muito Alta',
};

export const INCIDENCIA_COLOR: Record<string, string> = {
  baixa: theme.inkFaint, media: theme.warn, alta: '#f97316', muito_alta: theme.danger,
};

// numero_sumula guarda o nº da súmula OU do tema (RG/repetitivo); o tipo decide
// o prefixo — rotular "Súmula" um Tema é erro jurídico.
export function tipoRefLabel(
  tipo: string,
  numeroSumula: string | null | undefined,
  opts?: { short?: boolean },
): string {
  const labels = opts?.short ? TIPO_LABEL_SHORT : TIPO_LABEL;
  if (!numeroSumula) return labels[tipo] ?? tipo;
  if (tipo === 'sumula_vinculante') return `${opts?.short ? 'SV' : 'Súmula Vinculante'} ${numeroSumula}`;
  if (tipo === 'sumula') return `Súmula ${numeroSumula}`;
  return `Tema ${numeroSumula}`;
}

// Ordem e cores dos botões de avaliação SRS (fila de revisão e player de flashcards).
export const RATING_STYLE: { key: JurisRating; color: string; bg: string }[] = [
  { key: 'errei',   color: theme.danger,   bg: theme.dangerTint },
  { key: 'dificil', color: theme.warnDeep, bg: theme.warnTint },
  { key: 'ok',      color: theme.tealDeep, bg: theme.tealBg },
  { key: 'dominei', color: theme.okDeep,   bg: theme.okTint },
];
