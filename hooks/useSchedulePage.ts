'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/hooks/useConfirm';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { toggleBlockDone, deleteBlock } from '@/services/studyBlocks.service';
import {
  getScheduleBlocks, toggleRecurrenceDone, skipOccurrence, applyReplanMoves,
  type ScheduleBlock,
} from '@/services/scheduleEngine.service';
import { listRuleSummaries, type RuleSummary } from '@/services/recurrence.service';
import { getActiveCycleRule, archiveCycle, reactivateCycle } from '@/services/cycleEngine.service';
import { computeReplan } from '@/lib/schedule/replan';
import { toLocalDateString as localDateStr } from '@/lib/local-date';
import { mondayOf, weekDias, weekLabel as computeWeekLabel } from '@/lib/schedule-utils';

export function useSchedulePage() {
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();

  // — UI state —
  // weekStart é SEMPRE uma segunda-feira: o setter normaliza qualquer data
  // (o date picker "Ir para uma data" aceita qualquer dia; sem isso a grade
  // renderizava qua–ter com rótulos Seg–Dom e perdia os blocos de seg/ter).
  const [weekStart, setWeekStartRaw] = useState<Date>(() => mondayOf(new Date()));
  const setWeekStart = useCallback((d: Date) => setWeekStartRaw(mondayOf(d)), []);
  const [view, setView] = useState<'semana' | 'lista' | 'ciclo'>('semana');
  const [viewingArchivedId, setViewingArchivedId] = useState<string | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'dia_fixo' | 'ciclo'>('dia_fixo');
  const [arquivarAposCriar, setArquivarAposCriar] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleSummary | null>(null);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [replanModalOpen, setReplanModalOpen] = useState(false);
  const [replanning, setReplanning] = useState(false);

  const pendingTogglesRef = useRef(new Set<string>());

  // — Derived week values (memoized — só recria quando a semana muda) —
  const weekKey = useMemo(() => localDateStr(mondayOf(weekStart)), [weekStart]);
  const dias = useMemo(() => weekDias(weekStart), [weekStart]);
  const label = useMemo(() => computeWeekLabel(weekStart), [weekStart]);

  // — Queries (React Query cuida de cache, race conditions e dedup) —

  const {
    data: blocks = [],
    isLoading: loading,
    error: blocksQueryError,
  } = useQuery({
    queryKey: ['schedule', weekKey],
    queryFn: async () => {
      const monday = mondayOf(weekStart);
      const start = localDateStr(monday);
      const end = localDateStr(new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000));
      return getScheduleBlocks(start, end);
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['schedule-rules'],
    queryFn: listRuleSummaries,
    staleTime: 5 * 60_000,
  });

  const { data: cycleRuleId = null } = useQuery({
    queryKey: ['active-cycle'],
    queryFn: getActiveCycleRule,
    staleTime: 5 * 60_000,
  });

  // Ref para handlers estáveis que precisam ler `rules` sem se tornar instáveis.
  const rulesRef = useRef(rules);
  useEffect(() => { rulesRef.current = rules; }, [rules]);

  // Prefetch das semanas adjacentes após a semana atual carregar (navegação instantânea).
  useEffect(() => {
    if (loading) return;
    [-1, 1].forEach((delta) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + delta * 7);
      const monday = mondayOf(d);
      const key = localDateStr(monday);
      if (queryClient.getQueryData(['schedule', key])) return;
      const start = localDateStr(monday);
      const end = localDateStr(new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000));
      queryClient.prefetchQuery({
        queryKey: ['schedule', key],
        queryFn: () => getScheduleBlocks(start, end),
        staleTime: 60_000,
      });
    });
  }, [weekKey, loading, queryClient, weekStart]);

  // — Invalidação encapsulada (compatível com page.tsx existente) —

  const load = useCallback(() => {
    // Prefixo ['schedule']: editar um bloco pode remarcá-lo para OUTRA semana,
    // e as semanas adjacentes ficam pré-carregadas — invalidar só a semana
    // atual deixava a semana de destino stale por até 60s. O prefixo não
    // alcança ['schedule-rules'] (chave distinta). A aba Mês ('calendar-blocks')
    // consome os mesmos blocos e é invalidada junto.
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-blocks'] });
  }, [queryClient]);

  const loadRules = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
  }, [queryClient]);

  const checkCycle = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['active-cycle'] });
  }, [queryClient]);

  // — O(1) lookup por data em vez de O(n) filter por render —

  const blocksByDate = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of blocks) {
      const arr = map.get(b.block_date) ?? [];
      arr.push(b);
      map.set(b.block_date, arr);
    }
    return map;
  }, [blocks]);

  const blocksOf = useCallback(
    (date: Date): ScheduleBlock[] => blocksByDate.get(localDateStr(date)) ?? [],
    [blocksByDate],
  );

  function dayLoad(date: Date): { planned: number; done: number; pct: number } {
    const bs = blocksOf(date);
    const planned = bs.reduce((s, b) => s + b.planned_minutes, 0);
    const done = bs.filter((b) => b.is_done).reduce((s, b) => s + b.planned_minutes, 0);
    const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
    return { planned, done, pct };
  }

  // — Cronograma vivo: blocos atrasados desta semana e pra onde iriam —
  // Só faz sentido na semana ATUAL (replanejar o passado ou o futuro não tem significado).
  const isCurrentWeek = weekKey === localDateStr(mondayOf(new Date()));
  const replanMoves = useMemo(
    () => (isCurrentWeek ? computeReplan(blocks, mondayOf(weekStart)) : []),
    [blocks, weekStart, isCurrentWeek],
  );

  const handleApplyReplan = useCallback(async () => {
    setReplanning(true);
    try {
      const { ok, falhas } = await applyReplanMoves(replanMoves.map((m) => ({ block: m.block, toDate: m.toDate })));
      await queryClient.invalidateQueries({ queryKey: ['schedule', weekKey] });
      setReplanModalOpen(false);
      if (falhas > 0) toast.error(`${ok} ${ok === 1 ? 'bloco reorganizado' : 'blocos reorganizados'}, ${falhas} ${falhas === 1 ? 'falhou' : 'falharam'}.`);
      else toast.success(`${ok} ${ok === 1 ? 'bloco reorganizado' : 'blocos reorganizados'} — sua semana está em dia.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reorganizar a semana.');
    } finally {
      setReplanning(false);
    }
  }, [replanMoves, queryClient, weekKey, toast]);

  // — Navegação —

  function navWeek(deltaWeeks: number) {
    const x = new Date(weekStart);
    x.setDate(x.getDate() + deltaWeeks * 7);
    setWeekStart(x);
  }

  // — Handlers de ciclo/recorrência —

  function handleCycleButton() {
    if (cycleRuleId) {
      setViewingArchivedId(null);
      setView('ciclo');
    } else {
      setRecurrenceMode('ciclo');
      setRecurrenceOpen(true);
    }
  }

  function iniciarNovoCiclo() {
    setArquivarAposCriar(cycleRuleId);
    setRecurrenceMode('ciclo');
    setRecurrenceOpen(true);
  }

  function abrirRecorrencia() {
    setRecurrenceMode('dia_fixo');
    setRecurrenceOpen(true);
  }

  async function handleReativar(id: string) {
    const temAtivo = !!cycleRuleId && cycleRuleId !== id;
    const msg = temAtivo
      ? 'Reativar este ciclo? O ciclo ativo atual será arquivado no lugar.'
      : 'Reativar este ciclo? Ele voltará a ser o ciclo ativo.';
    if (!await confirm({ title: msg })) return;
    try {
      await reactivateCycle(id);
      setViewingArchivedId(null);
      checkCycle();
      setView('ciclo');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reativar.');
    }
  }

  async function handleRecurrenceCreated() {
    if (arquivarAposCriar) {
      try {
        await archiveCycle(arquivarAposCriar);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ciclo criado, mas falhou ao arquivar o anterior. Verifique em "Gerenciar".');
      }
      setArquivarAposCriar(null);
    }
    load();
    loadRules();
    checkCycle();
  }

  async function handlePanelEdit(ruleId: string) {
    const cached = rulesRef.current.find((r) => r.id === ruleId);
    if (cached) { setPanelOpen(false); setEditingRule(cached); return; }
    try {
      const fresh = await listRuleSummaries();
      queryClient.setQueryData(['schedule-rules'], fresh);
      const alvo = fresh.find((r) => r.id === ruleId) ?? null;
      if (alvo) { setPanelOpen(false); setEditingRule(alvo); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar regra para edição.');
    }
  }

  // — Handlers de bloco (useCallback estáveis → compatíveis com memo em BlockCard) —

  const handleToggle = useCallback(async (b: ScheduleBlock) => {
    if (pendingTogglesRef.current.has(b.id)) return;
    pendingTogglesRef.current.add(b.id);
    const newDone = !b.is_done;

    // Atualização otimista imediata no cache
    queryClient.setQueryData(['schedule', weekKey], (prev: ScheduleBlock[] | undefined) =>
      (prev ?? []).map((x) =>
        x.id !== b.id ? x : {
          ...x,
          is_done: newDone,
          is_virtual: x.is_virtual && newDone ? false : x.is_virtual,
        },
      ),
    );

    try {
      if (b.origin === 'manual') {
        await toggleBlockDone(b.id, newDone);
      } else {
        await toggleRecurrenceDone(b, newDone);
        // Recorrência cria/atualiza override com um id real — precisa aguardar
        // o refetch antes de liberar o lock (abaixo), senão um segundo clique
        // rápido reutiliza o id virtual sintético contra o override recém-criado.
        await queryClient.invalidateQueries({ queryKey: ['schedule', weekKey] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar bloco.');
      await queryClient.invalidateQueries({ queryKey: ['schedule', weekKey] });
    } finally {
      pendingTogglesRef.current.delete(b.id);
    }
  }, [queryClient, weekKey, toast]);

  const handleDelete = useCallback(async (b: ScheduleBlock) => {
    if (b.origin !== 'manual') return;
    if (!await confirm({
      title: 'Excluir este bloco?',
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    })) return;

    queryClient.setQueryData(['schedule', weekKey], (prev: ScheduleBlock[] | undefined) =>
      (prev ?? []).filter((x) => x.id !== b.id),
    );
    try {
      await deleteBlock(b.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir bloco.');
      queryClient.invalidateQueries({ queryKey: ['schedule', weekKey] });
    }
  }, [queryClient, weekKey, confirm, toast]);

  const handleSkip = useCallback(async (b: ScheduleBlock) => {
    try {
      await skipOccurrence(b);
      queryClient.invalidateQueries({ queryKey: ['schedule', weekKey] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao pular bloco.');
    }
  }, [queryClient, weekKey, toast]);

  const handleEditRule = useCallback(async (b: ScheduleBlock) => {
    if (!b.rule_id) return;
    const cached = rulesRef.current.find((r) => r.id === b.rule_id);
    if (cached) { setEditingRule(cached); return; }
    try {
      const fresh = await listRuleSummaries();
      queryClient.setQueryData(['schedule-rules'], fresh);
      const alvo = fresh.find((r) => r.id === b.rule_id) ?? null;
      if (alvo) setEditingRule(alvo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar regra para edição.');
    }
  }, [queryClient, toast]);

  const error = blocksQueryError instanceof Error ? blocksQueryError.message : '';

  return {
    // ui
    isMobile,
    dialog,
    // semana
    weekStart, setWeekStart,
    dias,
    weekLabel: label,
    navWeek,
    // dados
    blocks, loading, error, rules,
    // view
    view, setView,
    cicloAtivo: !!cycleRuleId,
    cycleViewId: viewingArchivedId ?? cycleRuleId,
    cycleRuleId,
    viewingArchivedId, setViewingArchivedId,
    // modais
    modalDate, setModalDate,
    recurrenceOpen, setRecurrenceOpen,
    recurrenceMode,
    panelOpen, setPanelOpen,
    editingRule, setEditingRule,
    editingBlock, setEditingBlock,
    generatorOpen, setGeneratorOpen,
    // invalidação (compatibilidade com page.tsx)
    load, loadRules, checkCycle,
    blocksOf, dayLoad,
    // cronograma vivo
    replanMoves, replanModalOpen, setReplanModalOpen, replanning, handleApplyReplan,
    // handlers de bloco (estáveis — prontos para memo)
    handleToggle, handleDelete, handleSkip, handleEditRule,
    // handlers de ciclo/recorrência
    handleCycleButton, iniciarNovoCiclo, abrirRecorrencia,
    handleReativar,
    handleRecurrenceCreated,
    handlePanelEdit,
  };
}
