// services/revisaoUnificada.service.ts
// Fila Única de Revisão (M1): agrega as quatro filas de revisão espaçada do app
// — tópicos (SM-2), flashcards (SM-2), lei seca e jurisprudências (motor
// juris-review) — numa única sequência com uma única barra de progresso.
// Cada item carrega o dado necessário para renderizar E para reagendar, sem
// que o player precise conhecer os detalhes de cada fonte.

import { listDueReviews, type ReviewItem } from '@/services/reviews.service';
import { listDueCards, type DueCard } from '@/services/flashcards.service';
import { listRevisoesDue, type LeiInteracao } from '@/services/leiInteracoes.service';
import { listRevisoesHoje, type JurisComInteracao } from '@/services/jurisInteracoes.service';
import { getLei, LEIS_CATALOG, type Lei, type LeiArtigo } from '@/services/leis.service';

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

// Hidrata as revisões de lei vencidas com o artigo do catálogo local (sem rede).
async function buildLeiItems(due: LeiInteracao[]): Promise<UnifiedItem[]> {
  if (due.length === 0) return [];
  const slugs = new Set(due.map((d) => d.artigo_key.split(':')[0]));
  const leis = new Map<string, Lei>();
  for (const slug of slugs) {
    if (LEIS_CATALOG.some((l) => l.slug === slug)) leis.set(slug, await getLei(slug));
  }
  const out: UnifiedItem[] = [];
  for (const interacao of due) {
    const slug = interacao.artigo_key.split(':')[0];
    const lei = leis.get(slug);
    const artigo = lei?.artigos.find((a) => a.key === interacao.artigo_key);
    if (lei && artigo) out.push({ kind: 'lei', id: interacao.artigo_key, interacao, artigo, lei });
  }
  return out;
}

export async function buildFilaUnificada(): Promise<FilaUnificada> {
  // Uma fonte lenta ou vazia nunca deve derrubar as demais.
  const [topics, cards, leiDue, jurisDue] = await Promise.all([
    listDueReviews().catch(() => [] as ReviewItem[]),
    listDueCards().catch(() => [] as DueCard[]),
    listRevisoesDue().catch(() => [] as LeiInteracao[]),
    listRevisoesHoje().catch(() => [] as JurisComInteracao[]),
  ]);

  const leiItems = await buildLeiItems(leiDue);

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
