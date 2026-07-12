'use client';

import { useState, useCallback } from 'react';
import { listArchivedCycles, deleteCycle } from '@/services/cycleEngine.service';
import { useConfirm } from '@/hooks/useConfirm';
import { theme } from '@/lib/theme';

interface Props {
  onAbrirArquivado: (id: string) => void;
  onReativar: (id: string) => void;
}

interface ArchivedItem { id: string; createdAt: string }

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ArchivedCycles({ onAbrirArquivado, onReativar }: Props) {
  const { confirm, dialog } = useConfirm();
  const [show, setShow] = useState(false);
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listArchivedCycles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar arquivados.');
    } finally {
      setLoading(false);
    }
  }, []);

  function toggle() {
    const next = !show;
    setShow(next);
    if (next) load();
  }

  async function handleExcluir(id: string) {
    if (!await confirm({ title: 'Excluir este ciclo arquivado de vez?', description: 'Esta ação não pode ser desfeita.', confirmLabel: 'Excluir', danger: true })) return;
    try {
      await deleteCycle(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  }

  return (
    <>
      {dialog}
      <div style={styles.section}>
        <button onClick={toggle} style={styles.toggle}>
          {show ? '▾' : '▸'} Ciclos arquivados
        </button>
        {error && <p style={styles.error}>{error}</p>}
        {show && (
          <div style={styles.list}>
            {loading ? (
              <p style={styles.muted}>Carregando…</p>
            ) : items.length === 0 ? (
              <p style={styles.empty}>Nenhum ciclo arquivado ainda.</p>
            ) : (
              items.map((a) => (
                <div key={a.id} style={styles.row}>
                  <span style={styles.date}>Ciclo de {fmtData(a.createdAt)}</span>
                  <div style={styles.actions}>
                    <button onClick={() => onAbrirArquivado(a.id)} style={styles.actionBtn}>Abrir</button>
                    <button onClick={() => onReativar(a.id)} style={styles.actionBtn}>Reativar</button>
                    <button onClick={() => handleExcluir(a.id)} style={styles.actionDanger}>Excluir</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: { marginTop: 24, paddingTop: 16, borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line },
  toggle: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  error: { color: theme.danger, fontSize: 13, marginTop: 8 },
  list: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  muted: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  empty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusSm, background: theme.card, flexWrap: 'wrap' },
  date: { fontSize: 14, color: theme.ink, fontWeight: 500 },
  actions: { display: 'flex', alignItems: 'center', gap: 6 },
  actionBtn: { padding: '5px 11px', borderRadius: 7, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  actionDanger: { padding: '5px 11px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
