// services/revisaoUnificada.service.ts
// Fila Única de Revisão (M1): agrega as quatro filas de revisão espaçada do app
// — tópicos (SM-2), flashcards (SM-2), lei seca e jurisprudências (motor
// juris-review) — numa única sequência com uma única barra de progresso.
// Cada item carrega o dado necessário para renderizar E para reagendar, sem
// que o player precise conhecer os detalhes de cada fonte.

import { listDueReviews, getNextScheduledDate as getNextScheduledTopicDate, type ReviewItem } from '@/services/reviews.service';
import { listDueCards, getNextScheduledCardDate, type DueCard } from '@/services/flashcards.service';
import { listRevisoesDue, hydrateLeiInteracoes, getNextScheduledLeiDate, type LeiInteracao } from '@/services/leiInteracoes.service';
import { listRevisoesHoje, type JurisComInteracao } from '@/services/jurisInteracoes.service';
import { getNextScheduledJurisDate } from '@/services/jurisRevisao.service';
import type { Lei, LeiArtigo } from '@/services/leis.service';

export type UnifiedKind = 'topic' | 'flashcard' | 'lei' | 'juris';

export type UnifiedItem =
  | { kind: 'topic'; id: string; topic: ReviewItem }
  | { kind: 'flashcard'; id: string; card: DueCard }
  | { kind: 'lei'; id: string; interacao: LeiInteracao; artigo: LeiArtigo; lei: Lei }
  | { kind: 'juris'; id: string; juris: JurisComInteracao };

export interface FilaUnificada {
  items: UnifiedItem[];
  counts: Record<UnifiedKind, number>;
  total: number;
}

export async function buildFilaUnificada(): Promise<FilaUnificada> {
  // Uma fonte lenta ou vazia nunca deve derrubar as demais.
  const [topics, cards, leiDue, jurisDue] = await Promise.all([
    listDueReviews().catch(() => [] as ReviewItem[]),
    listDueCards().catch(() => [] as DueCard[]),
    listRevisoesDue().catch(() => [] as LeiInteracao[]),
    listRevisoesHoje().catch(() => [] as JurisComInteracao[]),
  ]);

  const leiItems: UnifiedItem[] = (await hydrateLeiInteracoes(leiDue))
    .map(({ interacao, artigo, lei }) => ({ kind: 'lei', id: interacao.artigo_key, interacao, artigo, lei }));

  // Agrupado por natureza (não intercalado) para reduzir troca de contexto: o
  // usuário mantém a mesma "gramática" de avaliação por bloco. Ordem: tópicos →
  // lei → jurisprudência → flashcards.
  const items: UnifiedItem[] = [
    ...topics.map((t): UnifiedItem => ({ kind: 'topic', id: t.id, topic: t })),
    ...leiItems,
    ...jurisDue.map((j): UnifiedItem => ({ kind: 'juris', id: j.id, juris: j })),
    ...cards.map((c): UnifiedItem => ({ kind: 'flashcard', id: c.id, card: c })),
  ];

  const counts: Record<UnifiedKind, number> = {
    topic: topics.length,
    lei: leiItems.length,
    juris: jurisDue.length,
    flashcard: cards.length,
  };

  return { items, counts, total: items.length };
}

// Menor data entre as 4 fontes — só chamada quando a fila está vazia, para o
// empty state dizer quando algo vai vencer em vez de só "nada para revisar".
export async function getNextScheduledDateUnificada(): Promise<string | null> {
  const dates = await Promise.all([
    getNextScheduledTopicDate().catch(() => null),
    getNextScheduledCardDate().catch(() => null),
    getNextScheduledLeiDate().catch(() => null),
    getNextScheduledJurisDate().catch(() => null),
  ]);
  const validas = dates.filter((d): d is string => d !== null);
  if (validas.length === 0) return null;
  return validas.reduce((min, d) => (d < min ? d : min));
}
