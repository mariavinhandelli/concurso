// lib/session-modes.ts
// Fonte única dos tipos de sessão. O valor é o que vai pro banco (enum log_mode);
// o label é o que aparece na tela.
export const SESSION_MODES = [
  { value: 'teoria',         label: 'Teoria' },
  { value: 'questoes',       label: 'Questões' },
  { value: 'leitura_lei',    label: 'Lei seca' },
  { value: 'jurisprudencia', label: 'Jurisprudência' },
  { value: 'flashcards',     label: 'Flashcards' },
  { value: 'revisao',        label: 'Revisão' },
] as const;

export type SessionMode = typeof SESSION_MODES[number]['value'];

// "questoes" é o único tipo que pede contagem de acertos.
export function modeUsesQuestions(mode: string): boolean {
  return mode === 'questoes';
}