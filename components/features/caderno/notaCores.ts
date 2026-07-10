// components/features/caderno/notaCores.ts
// Mapa de cores por tipo de anotação. Extraído do NotaEditor (perf F1): NotaEditor
// importa o TipTap (~412KB), então consumidores que só querem as cores (Home,
// TudoView, TopicNotesPopover) importam daqui e ficam fora daquele bundle.
import type { NotaKind } from '@/services/studyNotes.service';

export const KIND_CORES: Record<NotaKind, { bg: string; ink: string }> = {
  resumo:  { bg: 'var(--teal-bg)', ink: 'var(--teal-deep)' },
  dica:    { bg: 'var(--warn-bg)', ink: 'var(--warn-deep)' },
  esquema: { bg: 'rgba(127,119,221,.14)', ink: '#534AB7' },
  outro:   { bg: 'var(--muted)', ink: 'var(--ink-soft)' },
};
