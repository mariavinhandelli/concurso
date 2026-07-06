import { useCallback, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import {
  listTargetExams, createTargetExam, setPrimaryTargetExam,
  deleteTargetExam, promoteToPos, updateTargetExamDate,
  type TargetExam,
} from '@/services/targetExams.service';
import { listAllBoards, createBoard, type Board } from '@/services/boards.service';
import { countLinkedByTarget } from '@/services/targetTopics.service';

export type CreateTargetInput = Parameters<typeof createTargetExam>[0];

export function useTargetList() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [targets, setTargets] = useState<TargetExam[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([listTargetExams(), listAllBoards()]);
      setTargets(t);
      setBoards(b);
      // Contagem em background — a lista não espera por ela.
      countLinkedByTarget(t.map((x) => x.id)).then(setTopicCounts).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar concursos.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const reloadTargets = useCallback(async () => {
    try {
      setTargets(await listTargetExams());
    } catch {
      // silencioso; erro primário já exibido antes do rollback
    }
  }, []);

  async function createTarget(input: CreateTargetInput): Promise<TargetExam> {
    try {
      const novo = await createTargetExam(input);
      const updated = await listTargetExams();
      setTargets(updated);
      return novo;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar concurso.');
      throw e;
    }
  }

  async function setPrimary(id: string, isAlready: boolean) {
    if (isAlready) return;
    setTargets((prev) => prev.map((t) => ({ ...t, is_primary: t.id === id })));
    try {
      await setPrimaryTargetExam(id);
      toast.success('Concurso definido como foco.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao definir foco.');
      reloadTargets();
    }
  }

  async function promote(targetId: string, boardId?: string) {
    setPromoting(true);
    setTargets((prev) => prev.map((t) => {
      if (t.id !== targetId) return t;
      const boardName = boardId ? boards.find((b) => b.id === boardId)?.name ?? null : t.boardName;
      return { ...t, phase: 'pos' as const, ...(boardId ? { board_id: boardId, boardName } : {}) };
    }));
    try {
      await promoteToPos(targetId, boardId);
      toast.success('Concurso promovido para pós-edital.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao promover.');
      reloadTargets();
      throw e;
    } finally {
      setPromoting(false);
    }
  }

  async function deleteTarget(id: string) {
    const ok = await confirm({
      title: 'Apagar este concurso-alvo?',
      description: 'Os pesos e configurações definidos nele também serão apagados.',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;

    let toRestore: TargetExam | undefined;
    setTargets((prev) => {
      toRestore = prev.find((t) => t.id === id);
      return prev.filter((t) => t.id !== id);
    });

    let undone = false;
    // Se a aba fechar durante a janela de "Desfazer", o DELETE nunca roda e o
    // concurso "ressuscita" no próximo login. O beforeunload avisa o usuário.
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', guard);

    toast.success('Concurso apagado.', {
      action: {
        label: 'Desfazer',
        onClick: () => {
          undone = true;
          window.removeEventListener('beforeunload', guard);
          if (toRestore) {
            const restored = toRestore;
            setTargets((prev) =>
              [...prev, restored].sort((a, b) =>
                (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
                a.created_at.localeCompare(b.created_at),
              ),
            );
          }
        },
      },
    });

    // Executa a exclusão real 200ms após o toast fechar, garantindo que o clique em "Desfazer" vença a corrida
    setTimeout(async () => {
      window.removeEventListener('beforeunload', guard);
      if (undone) return;
      try {
        await deleteTargetExam(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao apagar. O concurso foi restaurado.');
        reloadTargets();
      }
    }, 6200);
  }

  async function saveDate(id: string, date: string | null): Promise<void> {
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, exam_date: date } : t));
    try {
      await updateTargetExamDate(id, date);
      toast.success(date ? 'Data da prova salva.' : 'Data removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar data.');
      reloadTargets();
      throw e;
    }
  }

  async function addBoard(name: string): Promise<Board> {
    if (boards.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`A banca "${name}" já existe.`);
      throw new Error(`Banca "${name}" já existe.`);
    }
    try {
      const nova = await createBoard(name);
      setBoards((prev) => [...prev, nova].sort((a, b) => a.name.localeCompare(b.name)));
      return nova;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar banca.');
      throw e;
    }
  }

  return {
    targets, boards, topicCounts, loading, promoting,
    dialog, load,
    createTarget, setPrimary, promote, deleteTarget, saveDate, addBoard,
  };
}
