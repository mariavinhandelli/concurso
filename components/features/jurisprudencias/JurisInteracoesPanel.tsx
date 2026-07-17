'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, RefreshCw, Check } from 'lucide-react';
import { theme } from '@/lib/theme';
import {
  getInteracao, toggleFavorito, saveAnotacao, activateRevisao, desativarRevisao,
  type JurisInteracao,
} from '@/services/jurisInteracoes.service';
import { INTERVALOS_RAPIDOS } from '@/lib/juris-review';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

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
          <Star size={20}
            fill={favorito ? theme.gold : 'none'}
            color={favorito ? theme.gold : theme.inkFaint}
            strokeWidth={1.7}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: favorito ? theme.warnDeep : theme.ink }}>
            {favorito ? 'Nos favoritos' : 'Adicionar aos favoritos'}
          </span>
        </button>
      </div>

      {/* ── ANOTAÇÕES PESSOAIS ── */}
      <div style={styles.panel}>
        <div style={styles.panelHead}>
          <span style={styles.panelTitle}>Minhas anotações</span>
        </div>
        <Textarea
          value={anotacoes}
          onChange={(e) => setAnotacoes(e.target.value)}
          placeholder="Escreva aqui suas anotações, conexões com outros temas, dicas de memorização…"
          rows={4}
          style={{ padding: '12px 14px', background: theme.bg, fontSize: 14 }}
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
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="ex: FGV, revisão, confundo com X…"
              style={{ background: theme.bg, fontSize: 13, flex: 1 }}
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
          {savedAnot ? <><Check size={14} strokeWidth={2.5} /> Salvo</> : savingAnot ? 'Salvando…' : 'Salvar anotação'}
        </Button>
      </div>

      {/* ── AGENDAMENTO DE REVISÃO ── */}
      <div style={styles.panel}>
        <div style={styles.panelHead}>
          <span style={styles.panelTitle}>
            <RefreshCw size={14} strokeWidth={1.7} />
            Revisão espaçada
          </span>
          {interacao?.is_review_active && (
            <Badge variant="ok">Ativa</Badge>
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
              <Input
                type="number"
                min={1}
                max={365}
                value={intervalCustom}
                onChange={(e) => setIntervalCustom(e.target.value)}
                placeholder="Personalizado (dias)"
                style={{ background: theme.bg, fontSize: 13, flex: 1 }}
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
  subLabel: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.4 },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: theme.tealDeep, background: theme.tealBg,
    borderRadius: theme.radiusPill, padding: '3px 10px', fontWeight: 500,
  },
  tagRemove: { border: 'none', background: 'transparent', cursor: 'pointer', color: theme.tealDeep, fontSize: 14, lineHeight: 1, padding: 0, minWidth: 32, minHeight: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  tagAddBtn: {
    padding: '8px 14px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.primary, color: theme.onPrimary, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font,
  },
  nextReview: { fontSize: 14, color: theme.ink, margin: 0 },
  intervalBtn: {
    padding: '8px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font,
  },
  deactivateBtn: {
    padding: '8px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font,
  },
};
