// app/(app)/targets/page.tsx
// Concursos-alvo: cadastrar (com fase pré/pós-edital), marcar foco, promover
// pré→pós. A banca é selecionada da lista estruturada (exam_boards), com opção
// de cadastrar uma nova na hora.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listTargetExams, createTargetExam, setPrimaryTargetExam,
  deleteTargetExam, promoteToPos, type TargetExam,
} from '@/services/targetExams.service';
import { listAllBoards, createBoard, type Board } from '@/services/boards.service';
import { theme } from '@/lib/theme';

export default function TargetsPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<TargetExam[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form de novo alvo
  const [boardId, setBoardId] = useState('');
  const [orgao, setOrgao] = useState('');
  const [cargo, setCargo] = useState('');
  const [ano, setAno] = useState('');
  const [phase, setPhase] = useState<'pre' | 'pos'>('pre');

  // Cadastro inline de nova banca
  const [addingBoard, setAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  async function load() {
    try {
      const [t, b] = await Promise.all([listTargetExams(), listAllBoards()]);
      setTargets(t);
      setBoards(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreateBoardInline() {
    if (!newBoardName.trim()) return;
    try {
      await createBoard(newBoardName);
      const updated = await listAllBoards();
      setBoards(updated);
      const nova = updated.find((b) => b.name === newBoardName.trim());
      if (nova) setBoardId(nova.id);
      setNewBoardName('');
      setAddingBoard(false);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar banca.');
    }
  }

  async function handleCreate() {
    if (phase === 'pos' && !boardId) {
      setError('No pós-edital a banca é obrigatória.');
      return;
    }
    try {
      const novo = await createTargetExam({
        board_id: boardId || null,
        orgao: orgao || null,
        cargo: cargo || null,
        ano_alvo: ano ? Number(ano) : null,
        phase,
      });
      setBoardId(''); setOrgao(''); setCargo(''); setAno(''); setPhase('pre');
      setError('');
      await load();
      router.push(`/targets/${novo.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar.');
    }
  }

  async function handleSetPrimary(id: string, jaEhFoco: boolean) {
    if (jaEhFoco) return; // já é o foco; clicar de novo não faz nada
    try {
      await setPrimaryTargetExam(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao definir foco.');
    }
  }

  async function handlePromote(t: TargetExam) {
    let novoBoardId: string | undefined;
    if (!t.board_id) {
      if (boards.length === 0) {
        setError('Cadastre uma banca antes de promover (no formulário acima).');
        return;
      }
      const nome = window.prompt(
        `O edital saiu! Digite o nome exato da banca definida.\nBancas disponíveis: ${boards.map((b) => b.name).join(', ')}`
      );
      if (!nome || !nome.trim()) {
        setError('Para virar pós-edital, é preciso informar a banca.');
        return;
      }
      const achada = boards.find((b) => b.name.toLowerCase() === nome.trim().toLowerCase());
      if (!achada) {
        setError(`Banca "${nome}" não encontrada. Cadastre-a primeiro em Configurações.`);
        return;
      }
      novoBoardId = achada.id;
    }
    try {
      await promoteToPos(t.id, novoBoardId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao promover.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Apagar este concurso-alvo? Os pesos definidos nele também somem.')) return;
    try {
      await deleteTargetExam(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao apagar.');
    }
  }

  function rotulo(t: TargetExam): string {
    const bancaVis = t.boardName ?? 'Banca a definir';
    return [bancaVis, t.orgao, t.cargo, t.ano_alvo].filter(Boolean).join(' · ');
  }

  const bancaObrigatoria = phase === 'pos';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Concursos-alvo</h1>
        <p style={styles.sub}>Cadastre o concurso e abra para montar o edital e definir os pesos.</p>
      </div>

      {/* Form de novo alvo */}
      <div style={styles.createCard}>
        <div style={styles.phaseToggle}>
          <button onClick={() => setPhase('pre')} style={{ ...styles.phaseBtn, ...(phase === 'pre' ? styles.phaseBtnOn : {}) }}>
            Pré-edital
          </button>
          <button onClick={() => setPhase('pos')} style={{ ...styles.phaseBtn, ...(phase === 'pos' ? styles.phaseBtnOn : {}) }}>
            Pós-edital
          </button>
        </div>
        <p style={styles.phaseHint}>
          {phase === 'pre'
            ? 'Edital ainda não saiu — a banca é opcional, você define depois.'
            : 'Edital publicado — informe a banca definida.'}
        </p>

        <div style={styles.formGrid}>
          {addingBoard ? (
            <div style={styles.inlineBoard}>
              <input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBoardInline()}
                placeholder="Nome da nova banca"
                autoFocus
                style={styles.input}
              />
              <button onClick={handleCreateBoardInline} style={styles.miniBtn}>Salvar</button>
              <button onClick={() => { setAddingBoard(false); setNewBoardName(''); }} style={styles.miniBtnGhost}>Cancelar</button>
            </div>
          ) : (
            <div style={styles.selectWrap}>
              <select
                value={boardId}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setAddingBoard(true); return; }
                  setBoardId(e.target.value);
                }}
                style={{ ...styles.input, ...(bancaObrigatoria && !boardId ? styles.inputAlert : {}) }}
              >
                <option value="">{bancaObrigatoria ? 'Banca (obrigatória)' : 'Banca (opcional)'}</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
                <option value="__new__">+ Nova banca…</option>
              </select>
            </div>
          )}

          <input value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Órgão (ex: TCE-GO)" style={styles.input} />
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (ex: Auditor)" style={styles.input} />
          <input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="Ano" type="number" style={{ ...styles.input, maxWidth: 90 }} />
        </div>
        <button onClick={handleCreate} style={styles.addBtn}>Adicionar concurso</button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : targets.length === 0 ? (
        <p style={styles.muted}>Nenhum concurso-alvo ainda. Cadastre o primeiro acima.</p>
      ) : (
        <div style={styles.list}>
          {targets.map((t) => (
            <div key={t.id} style={styles.targetRow}>
              {/* Estrela de foco */}
              <button
                onClick={() => handleSetPrimary(t.id, t.is_primary)}
                style={styles.starBtn}
                title={t.is_primary ? 'Este é o concurso em foco' : 'Definir como foco'}
                aria-label={t.is_primary ? 'Concurso em foco' : 'Definir como foco'}
              >
                <svg
                  width="19" height="19" viewBox="0 0 24 24"
                  fill={t.is_primary ? theme.teal : 'none'}
                  stroke={t.is_primary ? theme.teal : theme.inkFaint}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
                </svg>
              </button>

              {/* Conteúdo clicável → abre o edital */}
              <div style={styles.targetMain} onClick={() => router.push(`/targets/${t.id}`)}>
                <span style={styles.targetLabel}>{rotulo(t)}</span>
                <span style={{ ...styles.phaseTag, ...(t.phase === 'pos' ? styles.phaseTagPos : styles.phaseTagPre) }}>
                  {t.phase === 'pos' ? 'Pós-edital' : 'Pré-edital'}
                </span>
              </div>

              {/* Ações à direita */}
              <div style={styles.targetActions}>
                {t.phase === 'pre' && (
                  <button onClick={() => handlePromote(t)} style={styles.promoteBtn}>
                    Edital saiu →
                  </button>
                )}
                <button onClick={() => router.push(`/targets/${t.id}`)} style={styles.iconBtn} title="Abrir edital" aria-label="Abrir edital">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <path d="M15 3h6v6M10 14L21 3" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(t.id)} style={styles.iconBtn} title="Apagar" aria-label="Apagar concurso">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 720, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font },
  header: { marginBottom: 22 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  createCard: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 20 },
  phaseToggle: { display: 'inline-flex', gap: 0, background: theme.muted, borderRadius: theme.radiusSm, padding: 3, marginBottom: 8 },
  phaseBtn: { padding: '7px 16px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  phaseBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  phaseHint: { fontSize: 12.5, color: theme.inkFaint, margin: '0 0 14px' },
  formGrid: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  selectWrap: { flex: 1, minWidth: 160 },
  inlineBoard: { display: 'flex', gap: 8, flexBasis: '100%', alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  inputAlert: { border: `1.5px solid ${theme.danger}` },
  miniBtn: { padding: '9px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  miniBtnGhost: { padding: '9px 10px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  addBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  targetRow: { display: 'flex', alignItems: 'center', gap: 12, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: '12px 14px', transition: 'border-color .15s' },
  starBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },
  targetMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', minWidth: 0 },
  targetLabel: { fontSize: 15, color: theme.ink, fontWeight: 500 },
  phaseTag: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', flexShrink: 0 },
  phaseTagPre: { color: theme.inkSoft, background: theme.muted },
  phaseTagPos: { color: '#fff', background: theme.teal },
  targetActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  promoteBtn: { border: `0.5px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' },
  iconBtn: { border: 'none', background: 'transparent', cursor: 'pointer', padding: 5, display: 'flex', alignItems: 'center', borderRadius: 8, opacity: 0.75 },
};