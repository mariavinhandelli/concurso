// lib/topic-tree.ts
// Funções puras para construção e análise da árvore de tópicos.
// Sem efeitos colaterais, sem imports de serviço — testáveis em isolamento.

import type { Topic } from '@/services/topics.service';

export interface TopicTree {
  parents: Topic[];
  childrenOf: Map<string, Topic[]>;
  folderIds: Set<string>;
}

// Constrói a árvore: pais (parent_id null) ordenados, filhos agrupados por pai.
export function buildTopicTree(topics: Topic[]): TopicTree {
  const folderIds = new Set<string>();
  for (const t of topics) {
    if (t.parent_id !== null) folderIds.add(t.parent_id);
  }

  const parents = topics
    .filter((t) => t.parent_id === null)
    .sort((a, b) => a.position - b.position);

  const childrenOf = new Map<string, Topic[]>();
  for (const t of topics) {
    if (t.parent_id === null) continue;
    const arr = childrenOf.get(t.parent_id) ?? [];
    arr.push(t);
    childrenOf.set(t.parent_id, arr);
  }
  for (const arr of childrenOf.values()) arr.sort((a, b) => a.position - b.position);

  return { parents, childrenOf, folderIds };
}

// Calcula progresso nas folhas estudáveis (filhos + pais-sem-filhos).
// Pais com filhos são pastas e não entram na contagem.
export function calcLeafProgress(
  topics: Topic[],
  childrenOf: Map<string, Topic[]>,
): { total: number; done: number; pct: number } {
  let total = 0, done = 0;
  for (const t of topics) {
    const isFolder = t.parent_id === null && (childrenOf.get(t.id)?.length ?? 0) > 0;
    if (isFolder) continue;
    total++;
    if (t.is_completed) done++;
  }
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// Versão genérica — funciona em qualquer objeto com { id, parent_id }.
// Usada por serviços que não têm objetos Topic completos (ex: userSubjects.service).
export function buildFolderIdSet<T extends { id: string; parent_id: string | null }>(
  items: T[],
): Set<string> {
  const ids = new Set<string>();
  for (const t of items) {
    if (t.parent_id !== null) ids.add(t.parent_id);
  }
  return ids;
}
