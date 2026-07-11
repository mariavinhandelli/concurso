'use client';

import { useEffect, useRef, useState } from 'react';
import { theme } from '@/lib/theme';
import {
  getInteracao, toggleFavorito, saveAnotacao, activateRevisao, desativarRevisao,
  type JurisInteracao,
} from '@/services/jurisInteracoes.service';
import { INTERVALOS_RAPIDOS } from '@/lib/juris-review';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';

interface Props {
  jurisId: string;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function JurisInteracoesPanel({ jurisId }: Props) {
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; });
  const [interacao, setInteracao] = useState<JurisInteracao | null>(null);
  const [loading, setLoading] = useState(true);

  // Anotações
  const [anotacoes, setAnotacoes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savingAnot, setSavingAnot] = useState(false);
  const [savedAnot, setSavedAnot] = useState(false);

  // Favorito
  const [favorito, setFavorito] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  // Revisão
  const [intervalCustom, setIntervalCustom] = useState('');
  const [savingRev, setSavingRev] = useState(false);

  // Refs para auto-save na desmontagem sem precisar de deps extras no cleanup.
  const anotacoesRef = useRef(anotacoes);
  const tagsRef = useRef(tags);
  useEffect(() => { anotacoesRef.current = anotacoes; }, [anotacoes]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);

  // Rastreia o último valor realmente persistido no banco (load ou save manual).
  // Evita upsert redundante no cleanup quando o usuário já salvou manualmente.
  const lastSavedAnotacoesRef = useRef('');
  const lastSavedTagsRef = useRef<string[]>([]);
  const savedAnotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (savedAnotTimeout.current) clearTimeout(savedAnotTimeout.current); }, []);

  // Salva automaticamente anotações ao trocar de aba ou de jurisprudência.
  useEffect(() => {
    return () => {
      const isDirty =
        anotacoesRef.current !== lastSavedAnotacoesRef.current ||
        JSON.stringify(tagsRef.current) !== JSON.stringify(lastSavedTagsRef.current);
      if (isDirty) {
        saveAnotacao(jurisId, anotacoesRef.current, tagsRef.current)
          .then(() => toastRef.current.success('Anotações salvas automaticamente.'))
          .catch(() => toastRef.current.error('Erro ao salvar anotações automaticamente.'));
      }
    };
  }, [jurisId]);

  useEffect(() => {
    // Reset de estado antes de buscar para evitar que dados da juris anterior
    // fiquem visíveis (e salvos acidentalmente) enquanto a nova carrega.
    setLoading(true);
    setInteracao(null);
    setFavorito(false);
    setAnotacoes('');
    setTags([]);
    setTagInput('');
    setSavedAnot(false);

    getInteracao(jurisId)
      .then((i) => {
        setInteracao(i);
        setFavorito(i?.favorito ?? false);
        setAnotacoes(i?.anotacoes ?? '');
        setTags(i?.tags_pessoais ?? []);
        // Marca o baseline para o isDirty do cleanup.
        lastSavedAnotacoesRef.current = i?.anotacoes ?? '';
        lastSavedTagsRef.current = i?.tags_pessoais ?? [];
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao carregar interações.'))
      .finally(() => setLoading(false));
  }, [jurisId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFavorito() {
    if (loadingFav) return;
    setLoadingFav(true);
    const novo = !favorito;
    setFavorito(novo);
    // Passa o novo valor diretamente para evitar race condition de read-then-write.
    try { await toggleFavorito(jurisId, novo); }
    catch { setFavorito(!novo); }
    finally { setLoadingFav(false); }
  }

  async function handleSaveAnotacao() {
    setSavingAnot(true);
    try {
      await saveAnotacao(jurisId, anotacoes, tags);
      // Avança o baseline para que o cleanup não dispare upsert redundante.
      lastSavedAnotacoesRef.current = anotacoes.trim();
      lastSavedTagsRef.current = tags;
      setSavedAnot(true);
      if (savedAnotTimeout.current) clearTimeout(savedAnotTimeout.current);
      savedAnotTimeout.current = setTimeout(() => setSavedAnot(false), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar anotação. Tente novamente.');
    } finally { setSavingAnot(false); }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((v) => [...v, t]);
    setTagInput('');
  }

  function removeTag(t: string) { setTags((v) => v.filter((x) => x !== t)); }

  async function handleActivate(days: number) {
    setSavingRev(true);
    try {
      await activateRevisao(jurisId, days);
      const updated = await getInteracao(jurisId);
      setInteracao(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ativar revisão. Tente novamente.');
    } finally { setSavingRev(false); }
  }

  async function handleDesativar() {
    setSavingRev(true);
    try {
      await desativarRevisao(jurisId);
      setInteracao((v) => v ? { ...v, is_review_active: false, next_review_date: null } : v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desativar revisão. Tente novamente.');
    } finally { setSavingRev(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[60, 120, 140].map((h, i) => (
        <div key={i} style={{ height: h, background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, animation: 'skeleton-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: theme.font }}>

      {/* ── FAVORITO ── */}
      <div style={styles.panel}>
        <button
          onClick={handleFavorito}
          disabled={loadingFav}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: theme.font, padding: 0, width: '100%',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24"
            fill={favorito ? '#f59e0b' : 'none'}
            stroke={favorito ? '#f59e0b' : theme.inkFaint}
            strokeWidth="1.7"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
          </svg>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: favorito ? theme.warnDeep : theme.ink }}>
            {favorito ? 'Nos favoritos' : 'Adicionar aos favoritos'}
          </span>
        </button>
      </div>

      {/* ── ANOTAÇÕES PESSOAIS ── */}
      <div style={styles.panel}>
        <div style={styles.panelHead}>
          <span style={styles.panelTitle}>Minhas anotações</span>
        </div>
        <textarea
          value={anotacoes}
          onChange={(e) => setAnotacoes(e.target.value)}
          placeholder="Escreva aqui suas anotações, conexões com outros temas, dicas de memorização…"
          rows={4}
          style={styles.textarea}
        />

        {/* Tags pessoais */}
        <div style={{ marginTop: 10 }}>
          <p style={styles.subLabel}>Tags pessoais</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {tags.map((t) => (
              <span key={t} style={styles.tag}>
                {t}
                <button onClick={() => removeTag(t)} style={styles.tagRemove}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="ex: FGV, revisão, confundo com X…"
              style={styles.tagInput}
            />
            <button onClick={addTag} style={styles.tagAddBtn}>+</button>
          </div>
        </div>

        <Button
          size="sm"
          style={savedAnot ? { marginTop: 12, background: theme.ok, color: theme.onOk } : { marginTop: 12 }}
          onClick={handleSaveAnotacao}
          disabled={savingAnot}
        >
          {savedAnot ? '✓ Salvo' : savingAnot ? 'Salvando…' : 'Salvar anotação'}
        </Button>
      </div>

      {/* ── AGENDAMENTO DE REVISÃO ── */}
      <div style={styles.panel}>
        <div style={styles.panelHead}>
          <span style={styles.panelTitle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" />
            </svg>
            Revisão espaçada
          </span>
          {interacao?.is_review_active && (
            <span style={styles.activeBadge}>Ativa</span>
          )}
        </div>

        {interacao?.is_review_active ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={styles.nextReview}>
              Próxima revisão: <strong>{fmtDate(interacao.next_review_date)}</strong>
            </p>
            <button onClick={handleDesativar} disabled={savingRev} style={styles.deactivateBtn}>
              {savingRev ? 'Aguarde…' : 'Desativar revisão'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={styles.subLabel}>Revisar em:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {INTERVALOS_RAPIDOS.map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => handleActivate(days)}
                  disabled={savingRev}
                  style={styles.intervalBtn}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                max={365}
                value={intervalCustom}
                onChange={(e) => setIntervalCustom(e.target.value)}
                placeholder="Personalizado (dias)"
                style={{ ...styles.tagInput, flex: 1 }}
              />
              <button
                onClick={() => {
                  const d = parseInt(intervalCustom);
                  if (d > 0) handleActivate(d);
                }}
                disabled={savingRev || !intervalCustom}
                style={styles.tagAddBtn}
              >
                Ok
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: theme.card, border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radius, padding: '16px 18px',
    boxShadow: theme.shadow,
  },
  panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { fontSize: 13, fontWeight: 700, color: theme.ink, display: 'flex', alignItems: 'center', gap: 6 },
  subLabel: { fontSize: 11.5, fontWeight: 600, color: theme.inkFaint, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.4 },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '12px 14px',
    borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.bg, fontSize: 13.5, color: theme.ink, fontFamily: theme.font,
    resize: 'vertical', outline: 'none', lineHeight: 1.6,
  },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: theme.tealDeep, background: theme.tealBg,
    borderRadius: 999, padding: '3px 10px', fontWeight: 500,
  },
  tagRemove: { border: 'none', background: 'transparent', cursor: 'pointer', color: theme.tealDeep, fontSize: 14, lineHeight: 1, padding: 0, minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  tagInput: {
    padding: '8px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.bg, fontSize: 13, color: theme.ink, fontFamily: theme.font, outline: 'none',
  },
  tagAddBtn: {
    padding: '8px 14px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font,
  },
  saveBtn: {
    marginTop: 12, padding: '9px 18px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font,
  },
  saveBtnOk: { background: theme.ok },
  activeBadge: { fontSize: 11, fontWeight: 700, color: theme.ok, background: theme.okBg, borderRadius: 999, padding: '2px 8px' },
  nextReview: { fontSize: 13.5, color: theme.ink, margin: 0 },
  intervalBtn: {
    padding: '8px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font,
  },
  deactivateBtn: {
    padding: '8px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font,
  },
};
