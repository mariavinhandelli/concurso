'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Pencil, Archive, X } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { createSubject, updateSubject, deleteSubject } from '@/services/subjects.service';
import { SUBJECT_COLORS, subjectColorName } from '@/lib/subject-colors';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getMySubjects, archiveSubject, unarchiveSubject,
  type MySubject, type SubjectStatus,
} from '@/services/userSubjects.service';
import { theme } from '@/lib/theme';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type SortKey = 'recente' | 'alfa' | 'progresso';

interface Props {
  isMobile: boolean;
  onError: (m: string) => void;
}

export function MinhasTab({ isMobile, onError }: Props) {
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState<SubjectStatus>('ativo');
  const [ativas, setAtivas] = useState<MySubject[]>([]);
  const [arquivadas, setArquivadas] = useState<MySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0]);
  const [creating, setCreating] = useState(false);
  // Ref além do estado: cliques no mesmo tick veem o state antigo (setState é
  // assíncrono) — só o ref bloqueia reentrada de forma síncrona.
  const creatingRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recente');

  const load = useCallback(async () => {
    try {
      const [a, arq] = await Promise.all([
        getMySubjects('ativo'),
        getMySubjects('arquivado'),
      ]);
      setAtivas(a);
      setArquivadas(arq);
      setLoadError(false);
    } catch (e) {
      // Erro ≠ vazio: sem isso a tela mostrava "Nenhuma matéria ativa" após
      // falha de rede, como se o usuário não tivesse dados.
      setLoadError(true);
      onError(e instanceof Error ? e.message : 'Erro ao carregar matérias.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  // Duplicata exata (case-insensitive) — evita segunda "Direito Penal" por engano.
  // Retorna mensagem de bloqueio ou null se o nome está livre.
  function duplicateMsg(name: string, ignoreId?: string): string | null {
    const alvo = name.trim().toLowerCase();
    if (ativas.some((s) => s.id !== ignoreId && s.name.toLowerCase() === alvo)) {
      return 'Você já tem uma matéria ativa com esse nome.';
    }
    if (arquivadas.some((s) => s.id !== ignoreId && s.name.toLowerCase() === alvo)) {
      return 'Existe uma matéria arquivada com esse nome — reative-a na aba Arquivadas.';
    }
    return null;
  }

  async function handleCreate() {
    // Guard de reentrada: duplo clique/Enter repetido criava a matéria duas vezes.
    // `loading` também bloqueia: antes das listas chegarem, a checagem de
    // duplicata rodaria contra arrays vazios e deixaria passar qualquer nome.
    if (!newName.trim() || creatingRef.current || loading) return;
    const dup = duplicateMsg(newName);
    if (dup) { onError(dup); return; }
    creatingRef.current = true;
    setCreating(true);
    try {
      await createSubject(newName, newColor);
      setNewName('');
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao criar.');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function startEdit(s: MySubject) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color ?? SUBJECT_COLORS[0]);
  }
  function cancelEdit() { setEditingId(null); setEditName(''); setEditColor(''); }

  async function saveEdit() {
    if (!editingId || !editName.trim()) { cancelEdit(); return; }
    const dup = duplicateMsg(editName, editingId);
    if (dup) { onError(dup); return; }
    try {
      await updateSubject(editingId, { name: editName, color: editColor });
      cancelEdit();
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }

  async function handleArchive(id: string, name: string) {
    setProcessingId(id);
    try {
      await archiveSubject(id);
      await load();
      // Ação silenciosa e fora da tela (a matéria some da lista) — o toast com
      // "Desfazer" confirma o que houve e dá o caminho de volta em um clique.
      toast.success(`"${name}" arquivada.`, {
        action: {
          label: 'Desfazer',
          onClick: () => {
            unarchiveSubject(id).then(load).catch((e) =>
              onError(e instanceof Error ? e.message : 'Erro ao reativar.'));
          },
        },
      });
    }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao arquivar.'); }
    finally { setProcessingId(null); }
  }
  async function handleUnarchive(id: string) {
    setProcessingId(id);
    try { await unarchiveSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao reativar.'); }
    finally { setProcessingId(null); }
  }
  async function handleDelete(id: string, name: string) {
    if (!await confirm({ title: `Apagar "${name}"?`, description: 'Todos os seus tópicos serão apagados. Esta ação não pode ser desfeita.', confirmLabel: 'Apagar', danger: true })) return;
    setProcessingId(id);
    try { await deleteSubject(id); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Erro ao apagar.'); }
    finally { setProcessingId(null); }
  }

  const base = status === 'ativo' ? ativas : arquivadas;

  // Touch targets: 44px em mobile (recomendação WCAG); 32/28px só com mouse.
  const iconBtn = isMobile ? { ...styles.iconBtn, width: 44, height: 44 } : styles.iconBtn;
  const deleteBtn = isMobile ? { ...styles.deleteBtn, width: 44, height: 44 } : styles.deleteBtn;

  const lista = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? base.filter((s) => s.name.toLowerCase().includes(q)) : base;
    if (sort === 'alfa') return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    if (sort === 'progresso') return [...filtered].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    // "Recentes" agora ordena de fato por criação (antes devolvia a ordem de
    // position/created_at asc — as mais ANTIGAS primeiro, contradizendo o rótulo).
    return [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [base, search, sort]);

  return (
    <>
      {dialog}
      {/* Criar matéria própria */}
      <div style={styles.createBox}>
        <div style={{ ...styles.createRow, flexDirection: isMobile ? 'column' : 'row' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Criar matéria própria (ex: Lei Orgânica do TCE-GO)"
            style={styles.input}
          />
          <button onClick={handleCreate} disabled={creating} style={{ ...styles.addBtn, width: isMobile ? '100%' : undefined, opacity: creating ? 0.6 : 1, cursor: creating ? 'wait' : 'pointer' }}>
            {creating ? 'Criando…' : 'Criar'}
          </button>
        </div>
        <div style={styles.colors}>
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              style={{ ...styles.colorDot, background: c, outline: newColor === c ? `2px solid ${theme.ink}` : 'none', outlineOffset: 2 }}
              aria-label={`Cor ${subjectColorName(c)}`}
              aria-pressed={newColor === c}
            />
          ))}
        </div>
      </div>

      {/* Sub-filtro ativas/arquivadas */}
      <div style={styles.pills}>
        {/* Counts só após o load — durante o loading exibia "Ativas (0)" enganoso */}
        <button
          onClick={() => { setStatus('ativo'); if (editingId) cancelEdit(); }}
          style={{ ...styles.pill, ...(status === 'ativo' ? styles.pillActive : {}) }}
        >
          Ativas{loading ? '' : ` (${ativas.length})`}
        </button>
        <button
          onClick={() => { setStatus('arquivado'); if (editingId) cancelEdit(); }}
          style={{ ...styles.pill, ...(status === 'arquivado' ? styles.pillActive : {}) }}
        >
          Arquivadas{loading ? '' : ` (${arquivadas.length})`}
        </button>
      </div>

      {/* Busca + Ordenação */}
      {!loading && base.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar matéria…"
              aria-label="Buscar matéria"
              icon={<Search size={13} strokeWidth={2} aria-hidden="true" />}
              style={{ padding: '8px 11px 8px 32px', fontSize: 14, paddingRight: search ? 30 : 11 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={styles.searchClear} aria-label="Limpar busca"><X size={13} strokeWidth={2} /></button>
            )}
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ width: 'auto' }}
            aria-label="Ordenar por"
          >
            <option value="recente">Recentes</option>
            <option value="alfa">A–Z</option>
            <option value="progresso">Progresso</option>
          </Select>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: theme.muted, animation: 'skeleton-pulse 1.4s ease infinite', animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : loadError && base.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <p style={styles.muted}>Não foi possível carregar suas matérias. Verifique a conexão.</p>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>Tentar de novo</Button>
        </div>
      ) : lista.length === 0 ? (
        <p style={styles.muted}>
          {search ? 'Nenhuma matéria encontrada para esta busca.' :
            status === 'ativo'
              ? 'Nenhuma matéria ativa. Explore o banco ou crie a sua acima.'
              : 'Nenhuma matéria arquivada.'}
        </p>
      ) : (
        <div style={styles.myList}>
          {lista.map((s) => (
            editingId === s.id ? (
              <div key={s.id} style={styles.editCard}>
                <div style={{ ...styles.editRow, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <span style={{ ...styles.colorBar, background: editColor }} />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', background: theme.bg, fontSize: 15 }}
                  />
                  <Button size="sm" onClick={saveEdit}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                </div>
                <div style={styles.colors}>
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      style={{ ...styles.colorDot, background: c, outline: editColor === c ? `2px solid ${theme.ink}` : 'none', outlineOffset: 2 }}
                      aria-label={`Cor ${subjectColorName(c)}`}
                      aria-pressed={editColor === c}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div key={s.id} style={styles.myCard}>
                {status === 'ativo' ? (
                  <Link href={`/subjects/${s.id}`} style={{ ...styles.myCardMain, textDecoration: 'none', color: 'inherit' }}>
                    <span style={{ ...styles.colorBar, background: s.color ?? theme.teal }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.myCardTop}>
                        <span style={styles.myCardName}>{s.name}</span>
                        {s.is_own && <Badge variant="neutral">própria</Badge>}
                      </div>
                      <div style={styles.myTrack}>
                        <div style={{ ...styles.myFill, width: `${s.progress}%`, background: s.color ?? theme.teal }} />
                      </div>
                      <div style={styles.myMeta}>
                        {s.progress}% · {s.leaf_done} de {s.leaf_total} tópicos estudados
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div style={{ ...styles.myCardMain, cursor: 'default' }}>
                    <span style={{ ...styles.colorBar, background: s.color ?? theme.teal }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.myCardTop}>
                        <span style={styles.myCardName}>{s.name}</span>
                        {s.is_own && <Badge variant="neutral">própria</Badge>}
                      </div>
                    </div>
                  </div>
                )}

                <div style={styles.myActions}>
                  {status === 'ativo' ? (
                    <>
                      <button onClick={() => startEdit(s)} style={iconBtn} aria-label={`Editar ${s.name}`} title="Editar">
                        <Pencil size={15} color={theme.inkSoft} strokeWidth={1.8} />
                      </button>
                      <button onClick={() => handleArchive(s.id, s.name)} disabled={processingId === s.id} style={{ ...iconBtn, opacity: processingId === s.id ? 0.4 : 1 }} aria-label={`Arquivar ${s.name}`} title="Arquivar">
                        <Archive size={15} color={theme.inkSoft} strokeWidth={1.8} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleUnarchive(s.id)} disabled={processingId === s.id} style={{ ...styles.unarchiveBtn, opacity: processingId === s.id ? 0.4 : 1 }} title="Reativar">{processingId === s.id ? '…' : 'Reativar'}</button>
                      <button onClick={() => handleDelete(s.id, s.name)} disabled={processingId === s.id} style={{ ...deleteBtn, opacity: processingId === s.id ? 0.4 : 1 }} aria-label={`Apagar ${s.name}`} title="Apagar"><X size={13} strokeWidth={2} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  muted: { color: theme.inkFaint, fontSize: 14 },

  createBox: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, marginBottom: 18 },
  createRow: { display: 'flex', gap: 10, marginBottom: 14 },
  input: { flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  colors: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 20, height: 20, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0 },

  pills: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 },
  pill: {
    fontSize: 13, padding: '6px 13px', borderRadius: theme.radiusPill, cursor: 'pointer', fontFamily: 'inherit',
    border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontWeight: 500,
  },
  pillActive: { background: theme.ink, color: theme.bg, border: `0.5px solid ${theme.ink}` },

  searchClear: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', padding: '0 2px', lineHeight: 1 },

  myList: { display: 'flex', flexDirection: 'column', gap: 10 },
  myCard: { display: 'flex', alignItems: 'center', gap: 8, background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.line}`, padding: '13px 15px', minWidth: 0 },
  myCardMain: { flex: 1, display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', minWidth: 0 },
  colorBar: { width: 10, height: 36, borderRadius: 3, flexShrink: 0 },
  myCardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  myCardName: { fontSize: 15, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  myTrack: { height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', marginTop: 8 },
  myFill: { height: '100%', borderRadius: theme.radiusPill, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
  myMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 4 },
  myActions: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  iconBtn: { width: 32, height: 32, borderRadius: theme.radiusXs, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: 0.75, flexShrink: 0 },
  unarchiveBtn: { fontSize: 13, padding: '6px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.teal}`, background: theme.card, color: theme.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', opacity: 0.6, width: 28, flexShrink: 0 },

  editCard: { background: theme.card, borderRadius: 14, border: `0.5px solid ${theme.teal}`, boxShadow: theme.shadow, padding: 16 },
  editRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
};
