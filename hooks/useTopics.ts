'use client';
// hooks/useTopics.ts
// Encapsula estado de dados e handlers de mutação da página de tópicos.
//
// initialSubject (opcional): quando fornecido pelo Server Component pai, o hook
// pula a chamada getSubject e faz apenas listTopics + getSaudeMap no mount.
// Isso elimina 1 round-trip Supabase na hidratação da página.
//
// Carga inicial: useEffect com flag `cancelled` — evita setState em unmount.
// Refresh pós-mutação: refresh() sem spinner, sem cleanup (user-triggered).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listTopics, createTopic, createTopicsBulk, updateTopic,
  toggleCompleted, deleteTopic, type Topic,
} from '@/services/topics.service';
import { getSubject, type Subject } from '@/services/subjects.service';
import { activateReview, deactivateReview } from '@/services/reviews.service';
import { getSaudeMap } from '@/services/metrics.service';
import { countNotesByTopics } from '@/services/studyNotes.service';
import { buildTopicTree, calcLeafProgress, type TopicTree } from '@/lib/topic-tree';

export interface UseTopicsReturn {
  topics: Topic[];
  saudeMap: Record<string, number>;
  noteCountMap: Record<string, number>;
  refreshNoteCounts: () => Promise<void>;
  loading: boolean;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  parents: TopicTree['parents'];
  childrenOf: TopicTree['childrenOf'];
  folderIds: TopicTree['folderIds'];
  totalLeaf: number;
  doneLeaf: number;
  pct: number;
  handleCreate: (name: string, parentId?: string | null) => Promise<void>;
  handleCreateBulk: (names: string[], parentId: string | null) => Promise<void>;
  handleToggle: (topic: Topic) => Promise<void>;
  handleToggleReview: (topic: Topic) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleUpdate: (id: string, name: string) => Promise<void>;
}

export function useTopics(subjectId: string, initialSubject?: Subject): UseTopicsReturn {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [saudeMap, setSaudeMap] = useState<Record<string, number>>({});
  const [noteCountMap, setNoteCountMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tree = useMemo<TopicTree>(() => buildTopicTree(topics), [topics]);
  const { total: totalLeaf, done: doneLeaf, pct } = useMemo(
    () => calcLeafProgress(topics, tree.childrenOf),
    [topics, tree.childrenOf],
  );

  // Carga inicial com cleanup.
  // Quando initialSubject é fornecido (Server Component), pula getSubject —
  // o servidor já verificou que o subject existe e pertence ao usuário.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Promise.resolve(initialSubject) resolve sincronicamente → Promise.all
        // só aguarda listTopics, eliminando um round-trip no caso server-driven.
        const subjectPromise = initialSubject !== undefined
          ? Promise.resolve(initialSubject as Subject)
          : getSubject(subjectId);

        const [lista, subject] = await Promise.all([listTopics(subjectId), subjectPromise]);
        if (cancelled) return;
        if (!subject) { router.replace('/subjects'); return; }
        setTopics(lista);
        const topicIds = lista.map((t) => t.id);
        const [mapa, notasMapa] = await Promise.all([getSaudeMap(topicIds), countNotesByTopics(topicIds)]);
        if (cancelled) return;
        setSaudeMap(mapa);
        setNoteCountMap(notasMapa);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // initialSubject é dado estático do servidor (não muda após mount) — omitido intencionalmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, router]);

  // Refresh pós-mutação: sem spinner, sem cleanup (iniciado pelo usuário —
  // componente certamente montado). Atualiza silenciosamente tópicos + saúde.
  const refresh = useCallback(async () => {
    try {
      const lista = await listTopics(subjectId);
      setTopics(lista);
      const topicIds = lista.map((t) => t.id);
      const [mapa, notasMapa] = await Promise.all([getSaudeMap(topicIds), countNotesByTopics(topicIds)]);
      setSaudeMap(mapa);
      setNoteCountMap(notasMapa);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao recarregar.');
    }
  }, [subjectId]);

  // Refresh leve — só as contagens de notas (após criar/apagar uma nota vinculada,
  // sem precisar recarregar tópicos e saúde).
  const refreshNoteCounts = useCallback(async () => {
    try {
      setNoteCountMap(await countNotesByTopics(topics.map((t) => t.id)));
    } catch { /* contagem é acessória — falha silenciosa não deve incomodar o usuário */ }
  }, [topics]);

  const handleCreate = useCallback(async (name: string, parentId: string | null = null) => {
    setError('');
    try {
      await createTopic(subjectId, name, parentId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }, [subjectId, refresh]);

  const handleCreateBulk = useCallback(async (names: string[], parentId: string | null) => {
    try {
      await createTopicsBulk(subjectId, names, parentId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar.');
    }
  }, [subjectId, refresh]);

  const handleToggle = useCallback(async (topic: Topic) => {
    const novo = !topic.is_completed;
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_completed: novo } : t)));
    try { await toggleCompleted(topic.id, novo); }
    catch (e) { refresh(); setError(e instanceof Error ? e.message : 'Erro ao marcar.'); }
  }, [refresh]);

  const handleToggleReview = useCallback(async (topic: Topic) => {
    const novo = !topic.is_review_active;
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_review_active: novo } : t)));
    try {
      if (novo) await activateReview(topic.id);
      else await deactivateReview(topic.id);
    } catch (e) { refresh(); setError(e instanceof Error ? e.message : 'Erro na revisão.'); }
  }, [refresh]);

  const handleDelete = useCallback(async (id: string) => {
    setError('');
    try { await deleteTopic(id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao apagar.'); }
  }, [refresh]);

  const handleUpdate = useCallback(async (id: string, name: string) => {
    setError('');
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    try { await updateTopic(id, { name }); }
    catch (e) { refresh(); setError(e instanceof Error ? e.message : 'Erro ao editar.'); }
  }, [refresh]);

  return {
    topics,
    saudeMap,
    noteCountMap,
    refreshNoteCounts,
    loading,
    error,
    setError,
    parents: tree.parents,
    childrenOf: tree.childrenOf,
    folderIds: tree.folderIds,
    totalLeaf,
    doneLeaf,
    pct,
    handleCreate,
    handleCreateBulk,
    handleToggle,
    handleToggleReview,
    handleDelete,
    handleUpdate,
  };
}
