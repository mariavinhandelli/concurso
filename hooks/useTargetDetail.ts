import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { listSubjects } from '@/services/subjects.service';
import { listAllTopics, type Topic } from '@/services/topics.service';
import { getTargetExam, type TargetExam } from '@/services/targetExams.service';
import {
  listLinkedTopicIds, linkTopic, unlinkTopic,
  linkTopicsBulk, unlinkTopicsBulk, listTopicIncidencia,
} from '@/services/targetTopics.service';
import { listTopicWeights, setTopicWeight } from '@/services/targetWeights.service';
import { listBlueprints, upsertBlueprint, type Blueprint } from '@/services/blueprints.service';
import {
  getCatalogEditalInfo, listEditalUpdates,
  type CatalogEditalInfo, type EditalUpdate,
} from '@/services/editaisCatalog.service';
import { getSaudeMap } from '@/services/metrics.service';
import { type SubjectTree } from '@/lib/targets';

export function useTargetDetail(targetId: string) {
  const toast = useToast();

  const [target, setTarget] = useState<TargetExam | null>(null);
  const [catalogInfo, setCatalogInfo] = useState<CatalogEditalInfo | null>(null);
  const [updates, setUpdates] = useState<EditalUpdate[]>([]);
  const [tree, setTree] = useState<SubjectTree[]>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [saudeMap, setSaudeMap] = useState<Record<string, number>>({});
  const [incidencias, setIncidencias] = useState<Record<string, number>>({});
  const [topicWeights, setTopicWeights] = useState<Record<string, number | null>>({});
  const [subjectWeights, setSubjectWeights] = useState<Record<string, number>>({});
  const [blueprints, setBlueprints] = useState<Record<string, Blueprint>>({});
  const [nQInputs, setNQInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // inFlight previne duplo-clique no mesmo tópico; inFlightTopics é state para re-render das tabs
  const inFlight = useRef(new Set<string>());
  const [inFlightTopics, setInFlightTopics] = useState<Set<string>>(new Set());

  // Stage 1 (parallel): target + subjects + allTopics + linked + weights + blueprints
  // Stage 2 (parallel after stage 1): saudeMap (needs topic IDs from allTopics)
  const load = useCallback(async () => {
    try {
      setError('');
      const [target, subjects, allTopics, linkedIds, tWeights, blueprintsList, incidenciaMap] = await Promise.all([
        getTargetExam(targetId),
        listSubjects(),
        listAllTopics(),
        listLinkedTopicIds(targetId),
        listTopicWeights(targetId),
        listBlueprints(targetId),
        // Incidência curada (copiada do catálogo na ativação) — best-effort:
        // sem dado real, o mapa fica vazio e a UI não mostra nada.
        listTopicIncidencia(targetId).catch(() => ({} as Record<string, number>)),
      ]);

      setTarget(target);
      setLinked(linkedIds);
      setTopicWeights(tWeights);
      setIncidencias(incidenciaMap);

      // Ficha do catálogo (última edição, banca, vagas…) — em background,
      // o hub renderiza sem ela e o card "Sobre o concurso" aparece quando chegar.
      if (target?.catalog_edital_id) {
        getCatalogEditalInfo(target.catalog_edital_id).then(setCatalogInfo).catch(() => {});
        listEditalUpdates(target.catalog_edital_id).then(setUpdates).catch(() => {});
      } else {
        setCatalogInfo(null);
        setUpdates([]);
      }

      const bySubject: Record<string, Topic[]> = {};
      for (const t of allTopics) {
        (bySubject[t.subject_id] ??= []).push(t);
      }
      const arvore: SubjectTree[] = subjects.map((s) => {
        const tops = bySubject[s.id] ?? [];
        const parentIds = new Set(tops.filter((t) => t.parent_id !== null).map((t) => t.parent_id!));
        return { subject: s, topics: tops.filter((t) => !parentIds.has(t.id)) };
      });
      setTree(arvore);

      // Só os tópicos vinculados aparecem nas abas que usam saúde — evita
      // calcular métricas para a biblioteca inteira (cresce com o catálogo).
      const saude = await getSaudeMap([...linkedIds]);
      setSaudeMap(saude);

      const sw: Record<string, number> = {};
      const bpMap: Record<string, Blueprint> = {};
      const nqInit: Record<string, string> = {};
      for (const b of blueprintsList) {
        sw[b.subject_id] = b.weight;
        bpMap[b.subject_id] = b;
        nqInit[b.subject_id] = b.num_questions_expected?.toString() ?? '';
      }
      setSubjectWeights(sw);
      setBlueprints(bpMap);
      setNQInputs(nqInit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  const toggleTopic = useCallback(async (topicId: string) => {
    if (inFlight.current.has(topicId)) return;
    inFlight.current.add(topicId);
    setInFlightTopics((prev) => { const n = new Set(prev); n.add(topicId); return n; });
    const estava = linked.has(topicId);
    setLinked((prev) => {
      const novo = new Set(prev);
      if (estava) novo.delete(topicId); else novo.add(topicId);
      return novo;
    });
    try {
      if (estava) await unlinkTopic(topicId, targetId);
      else await linkTopic(topicId, targetId);
    } catch (e) {
      load().catch(() => {});
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular tópico.');
    } finally {
      inFlight.current.delete(topicId);
      setInFlightTopics((prev) => { const n = new Set(prev); n.delete(topicId); return n; });
    }
  }, [targetId, linked, load, toast]);

  const toggleAllOfSubject = useCallback(async (node: SubjectTree, marcar: boolean) => {
    const ids = node.topics.map((t) => t.id);
    setLinked((prev) => {
      const novo = new Set(prev);
      ids.forEach((id) => (marcar ? novo.add(id) : novo.delete(id)));
      return novo;
    });
    try {
      if (marcar) await linkTopicsBulk(ids, targetId);
      else await unlinkTopicsBulk(ids, targetId);
    } catch (e) {
      load().catch(() => {});
      toast.error(e instanceof Error ? e.message : 'Erro ao vincular em lote.');
    }
  }, [targetId, load, toast]);

  const changeTopicWeight = useCallback(async (topicId: string, weight: number | null) => {
    setTopicWeights((prev) => ({ ...prev, [topicId]: weight }));
    try {
      await setTopicWeight(topicId, targetId, weight);
    } catch (e) {
      load().catch(() => {});
      toast.error(e instanceof Error ? e.message : 'Erro ao definir peso do tópico.');
    }
  }, [targetId, load, toast]);

  const changeSubjectWeight = useCallback(async (subjectId: string, weight: number, nQ: string) => {
    setSubjectWeights((prev) => ({ ...prev, [subjectId]: weight }));
    setBlueprints((prev) => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        subject_id: subjectId,
        weight,
        num_questions_expected: nQ ? Number(nQ) : null,
      } as Blueprint,
    }));
    try {
      await upsertBlueprint({
        targetExamId: targetId, subjectId, weight,
        numQuestionsExpected: nQ ? Number(nQ) : null,
      });
    } catch (e) {
      load().catch(() => {});
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar peso da disciplina.');
    }
  }, [targetId, load, toast]);

  return {
    target, catalogInfo, updates, tree, linked, saudeMap, incidencias, topicWeights, subjectWeights, blueprints, nQInputs,
    loading, error, inFlightTopics,
    load, toggleTopic, toggleAllOfSubject, changeTopicWeight, changeSubjectWeight, setNQInputs,
  };
}
