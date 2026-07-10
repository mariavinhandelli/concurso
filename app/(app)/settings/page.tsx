// app/(app)/settings/page.tsx
// Configurações — bancas, trocar senha (valida a atual via re-login), tema, sair de tudo.
'use client';

import { useState, useEffect } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';
import { useUI, PALETTES } from '@/components/layout/UIContext';
import { listAllBoards, createBoard, updateBoard, deleteBoard, type Board } from '@/services/boards.service';
import { NotificacoesCard } from '@/components/features/settings/NotificacoesCard';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { theme: mode, toggleTheme, palette, setPalette, isMobile } = useUI();
  const { confirm: showConfirm, dialog } = useConfirm();

  // --- bancas ---
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardName, setBoardName] = useState('');
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [boardMsg, setBoardMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // --- senha ---
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // --- sair de tudo ---
  const [signingOut, setSigningOut] = useState(false);

  async function loadBoards() {
    try {
      setBoards(await listAllBoards());
    } catch {
      setBoardMsg({ type: 'err', text: 'Erro ao carregar bancas.' });
    } finally {
      setLoadingBoards(false);
    }
  }

  useEffect(() => { loadBoards(); }, []);

  function flashBoard(type: 'ok' | 'err', text: string) {
    setBoardMsg({ type, text });
    setTimeout(() => setBoardMsg(null), 4000);
  }

  async function handleCreateBoard() {
    if (!boardName.trim()) return;
    try {
      await createBoard(boardName);
      setBoardName('');
      await loadBoards();
    } catch (e) {
      flashBoard('err', e instanceof Error ? e.message : 'Erro ao criar banca.');
    }
  }

  function startEdit(b: Board) {
    setEditingId(b.id);
    setEditingName(b.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function saveEdit() {
    if (!editingId || !editingName.trim()) { cancelEdit(); return; }
    try {
      await updateBoard(editingId, editingName);
      cancelEdit();
      await loadBoards();
    } catch (e) {
      flashBoard('err', e instanceof Error ? e.message : 'Erro ao renomear banca.');
    }
  }

  async function handleDeleteBoard(id: string, name: string) {
    if (!await showConfirm({ title: `Apagar a banca "${name}"?`, description: 'Isso pode afetar erros e sessões vinculados a ela.', confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteBoard(id);
      await loadBoards();
    } catch (e) {
      flashBoard('err', e instanceof Error ? e.message : 'Erro ao apagar banca.');
    }
  }

  function flashPwd(type: 'ok' | 'err', text: string) {
    setPwdMsg({ type, text });
    setTimeout(() => setPwdMsg(null), 4000);
  }

  async function handleChangePassword() {
    if (next.length < 6) { flashPwd('err', 'A nova senha deve ter ao menos 6 caracteres.'); return; }
    if (next !== confirm) { flashPwd('err', 'A confirmação não corresponde à nova senha.'); return; }

    setSavingPwd(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error('Sessão não encontrada.');

      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email, password: current,
      });
      if (reauthErr) { flashPwd('err', 'Senha atual incorreta.'); setSavingPwd(false); return; }

      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) throw updErr;

      setCurrent(''); setNext(''); setConfirm('');
      flashPwd('ok', 'Senha alterada com sucesso.');
    } catch (err) {
      flashPwd('err', err instanceof Error ? err.message : 'Erro ao alterar a senha.');
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleSignOutAll() {
    if (!await showConfirm({ title: 'Encerrar a sessão em todos os dispositivos?', description: 'Você será desconectado em todos os lugares.', confirmLabel: 'Encerrar', danger: true })) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      router.push('/login');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
    {dialog}
    <div style={{ ...styles.wrap, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <header style={styles.head}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>Configurações</h1>
        <p style={styles.sub}>Bancas, aparência, senha e sessões.</p>
      </header>

      {/* APARÊNCIA */}
      <section style={styles.card}>
        <div style={styles.cardTitle}>Aparência</div>

        <div style={styles.rowLabel}>Paleta de cores</div>
        <div style={styles.rowHint}>Escolha o esquema de cores da plataforma.</div>

        <div style={styles.paletteGrid}>
          {PALETTES.map((p) => {
            const active = palette === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPalette(p.id)}
                style={{
                  ...styles.paletteCard,
                  borderColor: active ? theme.teal : theme.line,
                  borderWidth: active ? 1.5 : 0.5,
                  background: active ? theme.tealBg : theme.bg,
                }}
                aria-label={`Paleta ${p.name}`}
                aria-pressed={active}
              >
                <span style={{ ...styles.paletteSwatch, background: p.swatch }} />
                <span style={styles.paletteText}>
                  <span style={styles.paletteName}>{p.name}</span>
                  <span style={styles.paletteHint}>{p.hint}</span>
                </span>
                {active && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.teal} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={styles.paletteCheck}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ ...styles.row, marginTop: 22, paddingTop: 20, borderTop: `0.5px solid ${theme.line}` }}>
          <div>
            <div style={styles.rowLabel}>Modo</div>
            <div style={styles.rowHint}>
              {mode === 'light' ? 'Modo claro' : 'Modo escuro'} · alterna entre claro e escuro.
            </div>
          </div>
          <button onClick={toggleTheme} style={styles.toggle} aria-label="Alternar entre claro e escuro">
            <span style={{
              ...styles.toggleKnob,
              transform: mode === 'dark' ? 'translateX(20px)' : 'translateX(0)',
              background: mode === 'dark' ? theme.teal : '#fff',
            }} />
          </button>
        </div>
      </section>

      {/* NOTIFICAÇÕES (N1 — web push) */}
      <NotificacoesCard />

      {/* BANCAS */}
      <section style={styles.card}>
        <div style={styles.cardTitle}>Bancas</div>
        <p style={styles.sectionIntro}>
          Cadastre as bancas dos seus concursos (FCC, CEBRASPE, FGV…). Elas alimentam
          os filtros de banca no caderno de erros e nas análises de desempenho.
        </p>

        <div style={styles.boardCreate}>
          <input
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
            placeholder="Nome da banca (ex: FCC)"
            style={styles.input}
          />
          <button onClick={handleCreateBoard} style={styles.btnPrimary}>Adicionar</button>
        </div>

        {boardMsg && (
          <span style={{ fontSize: 13, fontWeight: 500, color: boardMsg.type === 'ok' ? theme.ok : theme.danger }}>
            {boardMsg.text}
          </span>
        )}

        {loadingBoards ? (
          <p style={styles.muted}>Carregando…</p>
        ) : boards.length === 0 ? (
          <p style={styles.muted}>Nenhuma banca cadastrada ainda.</p>
        ) : (
          <div style={styles.boardList}>
            {boards.map((b) => (
              <div key={b.id} style={styles.boardItem}>
                <span style={{ ...styles.boardDot, background: b.color }} />
                {editingId === b.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      style={styles.boardEditInput}
                    />
                    <button onClick={saveEdit} style={styles.boardSave}>Salvar</button>
                    <button onClick={cancelEdit} style={styles.boardCancel}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <span style={styles.boardName}>{b.name}</span>
                    <button
                      className="icon-touch-target"
                      onClick={() => startEdit(b)}
                      style={styles.boardEdit}
                      aria-label={`Renomear ${b.name}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                    <button
                      className="icon-touch-target"
                      onClick={() => handleDeleteBoard(b.id, b.name)}
                      style={styles.boardDel}
                      aria-label={`Apagar ${b.name}`}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SENHA */}
      <section style={styles.card}>
        <div style={styles.cardTitle}>Trocar senha</div>
        <div style={styles.field}>
          <label style={styles.label}>Senha atual</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
            style={styles.input} placeholder="••••••••" autoComplete="current-password" />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Nova senha</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
            style={styles.input} placeholder="ao menos 6 caracteres" autoComplete="new-password" />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Confirmar nova senha</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            style={styles.input} placeholder="repita a nova senha" autoComplete="new-password" />
        </div>
        <div style={styles.actions}>
          {pwdMsg && (
            <span style={{ fontSize: 13, fontWeight: 500, color: pwdMsg.type === 'ok' ? theme.ok : theme.danger }}>
              {pwdMsg.text}
            </span>
          )}
          <button onClick={handleChangePassword} disabled={savingPwd}
            style={{ ...styles.btnPrimary, marginLeft: 'auto', opacity: savingPwd ? 0.6 : 1 }}>
            {savingPwd ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </section>

      {/* SESSÕES */}
      <section style={{ ...styles.card, borderColor: 'rgba(220,38,38,.2)' }}>
        <div style={{ ...styles.cardTitle, color: theme.danger }}>Sessões</div>
        <div style={styles.row}>
          <div>
            <div style={styles.rowLabel}>Sair de todos os dispositivos</div>
            <div style={styles.rowHint}>Encerra a sessão em qualquer aparelho onde você esteja logado.</div>
          </div>
          <button onClick={handleSignOutAll} disabled={signingOut}
            style={{ ...styles.btnDanger, opacity: signingOut ? 0.6 : 1 }}>
            {signingOut ? 'Saindo…' : 'Sair de tudo'}
          </button>
        </div>
      </section>
    </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 680, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font },
  head: { marginBottom: 24 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24, marginBottom: 18 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 18 },
  sectionIntro: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontSize: 14.5, fontWeight: 600, color: theme.ink },
  rowHint: { fontSize: 12.5, color: theme.inkFaint, marginTop: 3 },
  paletteGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 },
  paletteCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: theme.radiusSm, borderStyle: 'solid', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', position: 'relative' },
  paletteSwatch: { width: 26, height: 26, borderRadius: 7, flexShrink: 0, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' },
  paletteText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  paletteName: { fontSize: 14, fontWeight: 600, color: theme.ink },
  paletteHint: { fontSize: 11.5, color: theme.inkFaint, marginTop: 1 },
  paletteCheck: { flexShrink: 0 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.ink, marginBottom: 7 },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14.5, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  actions: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 18, borderTop: `0.5px solid ${theme.line}` },
  btnPrimary: { padding: '11px 22px', borderRadius: 12, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnDanger: { padding: '10px 18px', borderRadius: 10, border: `0.5px solid rgba(220,38,38,.3)`, background: theme.dangerBg, color: theme.danger, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  toggle: { position: 'relative', width: 44, height: 24, borderRadius: 999, border: 'none', background: theme.muted, cursor: 'pointer', padding: 2, flexShrink: 0 },
  toggleKnob: { display: 'block', width: 20, height: 20, borderRadius: '50%', boxShadow: theme.shadow, transition: 'transform .2s, background .2s' },
  boardCreate: { display: 'flex', gap: 10, marginBottom: 14 },
  boardList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  boardItem: { display: 'flex', alignItems: 'center', gap: 12, background: theme.bg, borderRadius: 10, border: `0.5px solid ${theme.line}`, padding: '11px 14px' },
  boardDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  boardName: { flex: 1, fontSize: 14.5, color: theme.ink, fontWeight: 500 },
  boardEditInput: { flex: 1, padding: '7px 10px', borderRadius: 8, border: `0.5px solid ${theme.teal}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  boardEdit: { border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, opacity: 0.7 },
  boardSave: { border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 8, padding: '6px 12px' },
  boardCancel: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 8px' },
  boardDel: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', opacity: 0.6 },
  muted: { color: theme.inkFaint, fontSize: 14 },
};
