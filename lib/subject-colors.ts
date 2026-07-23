// lib/subject-colors.ts
// Paleta de cores sugeridas ao criar ou editar matérias.
// Constante de UI pura — sem dependências de serviço.
export const SUBJECT_COLORS = [
  '#75f9a5',
  '#86d39b',
  '#0bd8b6',
  '#5f91bf',
  '#3892f8',
  '#ae67ff',
  '#9c3a9f',
  '#38134d',
  '#fe2273',
  '#da457c',
  '#ff90b3',
  '#f85838',
  '#771b09',
  '#ffad6b',
  '#f5f84e',
  '#fff9a0',
];

// Nomes em português para leitores de tela — "Cor #75f9a5" não diz nada.
const SUBJECT_COLOR_NAMES: Record<string, string> = {
  '#75f9a5': 'verde-claro',
  '#86d39b': 'verde',
  '#0bd8b6': 'turquesa',
  '#5f91bf': 'azul-acinzentado',
  '#3892f8': 'azul',
  '#ae67ff': 'lilás',
  '#9c3a9f': 'roxo',
  '#38134d': 'roxo-escuro',
  '#fe2273': 'pink',
  '#da457c': 'framboesa',
  '#ff90b3': 'rosa-claro',
  '#f85838': 'laranja-avermelhado',
  '#771b09': 'marrom',
  '#ffad6b': 'laranja-claro',
  '#f5f84e': 'amarelo',
  '#fff9a0': 'amarelo-claro',
};

export function subjectColorName(hex: string): string {
  return SUBJECT_COLOR_NAMES[hex.toLowerCase()] ?? hex;
}
