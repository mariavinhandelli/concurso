// app/(app)/settings/page.tsx
// Configurações — bancas, trocar senha (valida a atual via re-login), tema, sair de tudo.
'use client';

import { useState, useEffect } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { theme } from '@/lib/theme';
import { useUI, PALETTES } from '@/components/layout/UIContext';
import { listAllBoards, createBoard, updateBoard, deleteBoard, type Board } from '@/services/boards.service';
import { NotificacoesCard } from '@/components/features/settings/NotificacoesCard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { IconButton } from '@/components/ui/IconButton';

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { theme: mode, toggleTheme, palette, setPalette } = useUI();
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
    <PageContainer width="narrow">
      <PageHeader title="Configurações" subtitle="Bancas, aparência, senha e sessões." />

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
                  <Check size={16} color={theme.teal} strokeWidth={2.4} style={styles.paletteCheck} />
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
          <Switch checked={mode === 'dark'} onChange={toggleTheme} aria-label="Alternar entre claro e escuro" />
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
          <Input
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
            placeholder="Nome da banca (ex: FCC)"
          />
          <Button onClick={handleCreateBoard}>Adicionar</Button>
        </div>

        {boardMsg && (
          <span style={{ fontSize: 13, fontWeight: 500, color: boardMsg.type === 'ok' ? theme.ok : theme.danger }}>
            {boardMsg.text}
          </span>
        )}

        {loadingBoards ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }} aria-label="Carregando bancas">
            <Skeleton height={42} borderRadius={10} />
            <Skeleton height={42} borderRadius={10} />
          </div>
        ) : boards.length === 0 ? (
          <p style={styles.muted}>Nenhuma banca cadastrada ainda.</p>
        ) : (
          <div style={styles.boardList}>
            {boards.map((b) => (
              <div key={b.id} style={styles.boardItem}>
                <span style={{ ...styles.boardDot, background: b.color }} />
                {editingId === b.id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      style={{ flex: 1, padding: '7px 10px', borderRadius: theme.radiusXs, borderColor: theme.teal }}
                    />
                    <Button size="sm" onClick={saveEdit}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span style={styles.boardName}>{b.name}</span>
                    <IconButton size="sm" onClick={() => startEdit(b)} aria-label={`Renomear ${b.name}`}>
                      <Pencil size={15} strokeWidth={1.8} />
                    </IconButton>
                    <IconButton size="sm" onClick={() => handleDeleteBoard(b.id, b.name)} aria-label={`Apagar ${b.name}`} style={{ color: theme.inkFaint }}>
                      <X size={13} strokeWidth={2} />
                    </IconButton>
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
          <Input type="password" label="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••" autoComplete="current-password" />
        </div>
        <div style={styles.field}>
          <Input type="password" label="Nova senha" value={next} onChange={(e) => setNext(e.target.value)}
            placeholder="ao menos 6 caracteres" autoComplete="new-password" />
        </div>
        <div style={styles.field}>
          <Input type="password" label="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="repita a nova senha" autoComplete="new-password" />
        </div>
        <div style={styles.actions}>
          {pwdMsg && (
            <span style={{ fontSize: 13, fontWeight: 500, color: pwdMsg.type === 'ok' ? theme.ok : theme.danger }}>
              {pwdMsg.text}
            </span>
          )}
          <Button onClick={handleChangePassword} disabled={savingPwd} style={{ marginLeft: 'auto' }}>
            {savingPwd ? 'Alterando…' : 'Alterar senha'}
          </Button>
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
          <Button variant="dangerSoft" onClick={handleSignOutAll} disabled={signingOut}>
            {signingOut ? 'Saindo…' : 'Sair de tudo'}
          </Button>
        </div>
      </section>
    </PageContainer>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 24, marginBottom: 18 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 18 },
  sectionIntro: { fontSize: 13, color: theme.inkSoft, margin: '0 0 16px', lineHeight: 1.5 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  rowLabel: { fontSize: 15, fontWeight: 600, color: theme.ink },
  rowHint: { fontSize: 13, color: theme.inkFaint, marginTop: 3 },
  paletteGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 },
  paletteCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: theme.radiusSm, borderStyle: 'solid', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', position: 'relative' },
  paletteSwatch: { width: 26, height: 26, borderRadius: 7, flexShrink: 0, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.12)' },
  paletteText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  paletteName: { fontSize: 14, fontWeight: 600, color: theme.ink },
  paletteHint: { fontSize: 12, color: theme.inkFaint, marginTop: 1 },
  paletteCheck: { flexShrink: 0 },
  field: { marginBottom: 14 },
  actions: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 18, borderTop: `0.5px solid ${theme.line}` },
  boardCreate: { display: 'flex', gap: 10, marginBottom: 14 },
  boardList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  boardItem: { display: 'flex', alignItems: 'center', gap: 12, background: theme.bg, borderRadius: 10, border: `0.5px solid ${theme.line}`, padding: '11px 14px' },
  boardDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  boardName: { flex: 1, fontSize: 15, color: theme.ink, fontWeight: 500 },
  muted: { color: theme.inkFaint, fontSize: 14 },
};
