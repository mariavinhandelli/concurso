// app/(app)/revisar/page.tsx
// Fila Única de Revisão (M1): um só lugar, uma só barra de progresso, uma só
// celebração no fim. Intercala os quatro tipos de revisão do app — tópicos,
// flashcards, lei seca e jurisprudências — num player sequencial, eliminando a
// peregrinação por /reviews, /flashcards, /vademecum/revisar e
// /jurisprudencias/revisar. Cada tipo mantém sua própria gramática de avaliação.
'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { buildFilaUnificada, type UnifiedItem, type UnifiedKind } from '@/services/revisaoUnificada.service';
import { submitReview, type ReviewRating } from '@/services/reviews.service';
import { submitCardReview, type ReviewRating as CardRating } from '@/services/flashcards.service';
import { submitRevisaoArtigo } from '@/services/leiInteracoes.service';
import { submitRevisao as submitJurisRevisao } from '@/services/jurisInteracoes.service';
import { RATING_LABEL, type JurisRating } from '@/lib/juris-review';
import { GRIFO_CORES, SUBLINHADO_COR, segmentarBloco } from '@/lib/lei-grifos';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { ReviewCard } from '@/components/features/reviews/ReviewCard';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageContainer } from '@/components/ui/Page';

// ── Metadados por tipo (rótulo + cor do chip) ──────────────────────────────
const KIND_META: Record<UnifiedKind, { label: string; fg: string; bg: string }> = {
  topic:     { label: 'Tópico',         fg: theme.teal,   bg: theme.tealBg },
  flashcard: { label: 'Flashcard',      fg: theme.info,   bg: theme.infoBg },
  lei:       { label: 'Lei seca',       fg: theme.clay,   bg: theme.clayBg },
  juris:     { label: 'Jurisprudência', fg: theme.warnDeep, bg: theme.warnTint },
};

const RATINGS_3: { key: ReviewRating; label: string; fg: string; bg: string }[] = [
  { key: 'dificil',       label: 'Difícil', fg: theme.inkSoft, bg: theme.muted  },
  { key: 'intermediario', label: 'Médio',   fg: theme.info,    bg: theme.infoBg },
  { key: 'facil',         label: 'Fácil',   fg: theme.okDeep,  bg: theme.okBg   },
];

// Flashcards ganham o lapso ("Errei"): quality 0 no SM-2 — reseta repetições e
// derruba o ease factor. Alinha com lei/juris, que já tinham o botão.
const FC_RATINGS: { key: CardRating; label: string; fg: string; bg: string }[] = [
  { key: 'errei',         label: 'Errei',   fg: theme.danger,  bg: theme.dangerTint },
  { key: 'dificil',       label: 'Difícil', fg: theme.inkSoft, bg: theme.muted  },
  { key: 'intermediario', label: 'Médio',   fg: theme.info,    bg: theme.infoBg },
  { key: 'facil',         label: 'Fácil',   fg: theme.okDeep,  bg: theme.okBg   },
];

const RATINGS_4: { key: JurisRating; fg: string; bg: string }[] = [
  { key: 'errei',   fg: theme.danger,   bg: theme.dangerTint },
  { key: 'dificil', fg: theme.warnDeep, bg: theme.warnTint },
  { key: 'ok',      fg: theme.tealDeep, bg: theme.tealBg },
  { key: 'dominei', fg: theme.okDeep,   bg: theme.okTint },
];

function KindBadge({ kind }: { kind: UnifiedKind }) {
  const m = KIND_META[kind];
  return <Badge style={{ color: m.fg, background: m.bg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.label}</Badge>;
}

export default function RevisarUnificadoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMobile } = useUI();
  const toast = useToast();

  const [fila, setFila] = useState<UnifiedItem[] | null>(null);
  const [totalReal, setTotalReal] = useState(0); // itens antes do teto (para "o resto espera")
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);           // flashcard / juris
  const [reveladas, setReveladas] = useState<Set<string>>(new Set()); // lacunas de lei
  const [tally, setTally] = useState<Record<UnifiedKind, number>>({ topic: 0, flashcard: 0, lei: 0, juris: 0 });

  // Modo Retomada envia ?limite=N para um "recomeço leve" sem encarar a pilha toda.
  const limite = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const n = Number(new URLSearchParams(window.location.search).get('limite'));
    return Number.isInteger(n) && n > 0 ? n : null;
  }, []);

  // Só a parte assíncrona — sem setState síncrono, para o efeito de montagem
  // não disparar render em cascata.
  const fetchFila = useCallback(() => {
    buildFilaUnificada()
      .then((f) => {
        setTotalReal(f.items.length);
        setFila(limite ? f.items.slice(0, limite) : f.items);
      })
      .catch(() => setFila([]));
  }, [limite]);

  useEffect(() => { fetchFila(); }, [fetchFila]);

  // "Continuar" (após um lote no Modo Retomada): zera o progresso local e recarrega
  // a fila — que já vem menor, pois os itens avaliados saíram do vencimento.
  const continuar = useCallback(() => {
    setFila(null);
    setIdx(0);
    setRevealed(false);
    setReveladas(new Set());
    setTally({ topic: 0, flashcard: 0, lei: 0, juris: 0 });
    fetchFila();
  }, [fetchFila]);

  const total = fila?.length ?? 0;
  const current = fila && idx < total ? fila[idx] : null;
  const done = fila !== null && current === null;
  const feitas = useMemo(() => Object.values(tally).reduce((a, b) => a + b, 0), [tally]);

  function advance() {
    setRevealed(false);
    setReveladas(new Set());
    setIdx((i) => i + 1);
  }

  async function commit(fn: () => Promise<unknown>) {
    if (saving || !current) return;
    const kind = current.kind;
    setSaving(true);
    try {
      await fn();
      refreshHomeAfterSession(queryClient);
      queryClient.invalidateQueries({ queryKey: ['due-juris-count'] });
      queryClient.invalidateQueries({ queryKey: ['retomada'] });
      setTally((t) => ({ ...t, [kind]: t[kind] + 1 }));
      advance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // ── Atalhos de teclado: Espaço revela; 1..4 avaliam quando pronto ──────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!current || saving) return;
      const needsReveal = current.kind === 'flashcard' || current.kind === 'juris';

      if ((e.key === ' ' || e.code === 'Space') && needsReveal && !revealed) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (needsReveal && !revealed) return;

      if (current.kind === 'topic' && n <= 3) {
        void commit(() => submitReview(current.id, RATINGS_3[n - 1].key));
      } else if (current.kind === 'flashcard' && n <= 4) {
        void commit(() => submitCardReview(current.id, FC_RATINGS[n - 1].key));
      } else if (current.kind === 'lei' && n <= 4) {
        void commit(() => submitRevisaoArtigo(current.id, RATINGS_4[n - 1].key));
      } else if (current.kind === 'juris' && n <= 4) {
        void commit(() => submitJurisRevisao(current.id, RATINGS_4[n - 1].key, current.juris.interacao));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, saving, revealed]);

  // ── Estados de borda ───────────────────────────────────────────────────────
  if (fila === null) {
    return (
      <PageContainer width="narrow" style={{ padding: 40 }}>
        <p style={{ color: theme.inkFaint }}>Montando sua fila de revisão…</p>
      </PageContainer>
    );
  }

  if (done) {
    const linhas: { kind: UnifiedKind; n: number }[] = (Object.keys(tally) as UnifiedKind[])
      .map((k) => ({ kind: k, n: tally[k] }))
      .filter((l) => l.n > 0);
    // Fila foi limitada (Modo Retomada) e ainda sobrou pilha para depois.
    const restante = Math.max(0, totalReal - feitas);
    return (
      <PageContainer width="narrow" style={{ padding: isMobile ? '40px 16px' : '72px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{restante > 0 ? '🌱' : '🎉'}</div>
        <h1 style={s.doneTitle}>
          {feitas === 0 ? 'Nada para revisar agora' : restante > 0 ? 'Bom recomeço!' : 'Revisão em dia!'}
        </h1>
        <p style={s.doneSub}>
          {feitas === 0
            ? 'Suas quatro filas de revisão estão zeradas. Volte quando algo vencer.'
            : restante > 0
              ? `Você fez ${feitas} ${feitas === 1 ? 'item' : 'itens'}. Ainda restam ${restante} — sem pressa, elas esperam por você.`
              : `Você revisou ${feitas} ${feitas === 1 ? 'item' : 'itens'} nesta sessão.`}
        </p>
        {linhas.length > 0 && (
          <div style={s.doneStats}>
            {linhas.map((l) => (
              <div key={l.kind} style={s.doneStatBox}>
                <span style={{ ...s.doneStatNum, color: KIND_META[l.kind].fg }}>{l.n}</span>
                <span style={s.doneStatLabel}>{KIND_META[l.kind].label}</span>
              </div>
            ))}
          </div>
        )}
        <div style={s.doneActions}>
          {restante > 0 && (
            <Button onClick={continuar}>
              Continuar · +{Math.min(limite ?? restante, restante)}
            </Button>
          )}
          <Button variant={restante > 0 ? 'outline' : 'primary'} onClick={() => router.push('/')}>
            Voltar para a Home
          </Button>
        </div>
      </PageContainer>
    );
  }

  // ── Player ─────────────────────────────────────────────────────────────────
  return (
    <PageContainer width="narrow">
      {/* Barra superior: sair · progresso · contador */}
      <div style={s.topBar}>
        <button onClick={() => router.push('/')} style={s.exitBtn} className="touch-target">
          <X size={14} strokeWidth={2} />
          Sair
        </button>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressBar, width: `${(idx / total) * 100}%` }} />
        </div>
        <span style={s.progressLabel}>{idx + 1}/{total}</span>
      </div>

      {current && (
        <div style={s.body}>
          <div style={s.itemHead}>
            <KindBadge kind={current.kind} />
          </div>

          {current.kind === 'topic' && (
            <ReviewCard
              key={current.id}
              item={current.topic}
              isExiting={false}
              onRate={(id, rating) => { void commit(() => submitReview(id, rating)); }}
            />
          )}

          {current.kind === 'flashcard' && (
            <FlashcardBody
              key={current.id}
              item={current}
              revealed={revealed}
              saving={saving}
              onReveal={() => setRevealed(true)}
              onRate={(rating) => { void commit(() => submitCardReview(current.id, rating)); }}
            />
          )}

          {current.kind === 'lei' && (
            <LeiBody
              key={current.id}
              item={current}
              reveladas={reveladas}
              setReveladas={setReveladas}
              saving={saving}
              onRate={(rating) => { void commit(() => submitRevisaoArtigo(current.id, rating)); }}
            />
          )}

          {current.kind === 'juris' && (
            <JurisBody
              key={current.id}
              item={current}
              revealed={revealed}
              saving={saving}
              onReveal={() => setRevealed(true)}
              onRate={(rating) => { void commit(() => submitJurisRevisao(current.id, rating, current.juris.interacao)); }}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}

// ── Corpo: Flashcard (frente → verso → 3 avaliações) ────────────────────────
function FlashcardBody({
  item, revealed, saving, onReveal, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'flashcard' }>;
  revealed: boolean; saving: boolean;
  onReveal: () => void; onRate: (r: CardRating) => void;
}) {
  const { card } = item;
  return (
    <div style={s.card}>
      <span style={{ ...s.subjBadge, background: card.subjectColor }}>{card.subjectName}</span>
      <div style={s.fcContent}>
        <p style={s.fcFront}>{card.front}</p>
        {revealed && (<><div style={s.sep} /><p style={s.fcBack}>{card.back}</p></>)}
      </div>
      {!revealed ? (
        <div style={{ textAlign: 'center' }}>
          <Button onClick={onReveal} style={{ padding: '13px 32px', fontSize: 15 }}>Mostrar resposta</Button>
          <p style={s.kbdHint}>ou aperte <kbd style={s.kbd}>espaço</kbd></p>
        </div>
      ) : (
        <RatingRowFC saving={saving} onRate={onRate} />
      )}
    </div>
  );
}

// ── Corpo: Lei seca (texto com lacunas → 4 avaliações) ──────────────────────
function LeiBody({
  item, reveladas, setReveladas, saving, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'lei' }>;
  reveladas: Set<string>; setReveladas: (s: Set<string>) => void;
  saving: boolean; onRate: (r: JurisRating) => void;
}) {
  const { artigo, lei, interacao } = item;
  const grifos = interacao.grifos ?? [];
  const temLacunas = grifos.length > 0;
  return (
    <div style={s.card}>
      <div style={s.leiHead}>
        <span style={{ ...s.subjBadge, background: theme.clay, color: theme.onClay }}>{lei.nomeCurto}</span>
        <span style={s.leiRotulo}>{artigo.rotulo}</span>
        {artigo.caminho && <span style={s.leiCaminho}>{artigo.caminho}</span>}
      </div>
      {temLacunas && (
        <p style={s.leiHint}>
          Complete as lacunas de memória — clique para revelar.
          <button onClick={() => setReveladas(new Set(grifos.map((g) => g.id)))} style={s.revelarTudo}>revelar tudo</button>
        </p>
      )}
      <div style={s.leiTexto}>
        {artigo.blocos.map((b) => (
          <p key={b.id} style={{ ...s.leiBloco, paddingLeft: b.nivel * 20 }}>
            {b.rotulo && <span style={s.leiBlocoRotulo}>{b.rotulo} </span>}
            {segmentarBloco(b.texto, grifos, b.id).map((seg, i) => {
              if (!seg.grifo) return <span key={i}>{seg.texto}</span>;
              const aberta = reveladas.has(seg.grifo.id);
              if (!aberta) {
                return (
                  <span
                    key={i}
                    onClick={() => setReveladas(new Set(reveladas).add(seg.grifo!.id))}
                    title="Clique para revelar"
                    style={s.lacuna}
                  >
                    {' '.repeat(Math.max(6, Math.min(seg.texto.length, 40)))}
                  </span>
                );
              }
              const estilo: CSSProperties = seg.grifo.estilo === 'sublinhado'
                ? { borderBottom: `2px solid ${SUBLINHADO_COR}` }
                : { background: GRIFO_CORES[seg.grifo.cor ?? 'regra'].bg, borderRadius: 3 };
              return <span key={i} style={estilo}>{seg.texto}</span>;
            })}
          </p>
        ))}
      </div>
      <RatingRow4 saving={saving} onRate={onRate} />
    </div>
  );
}

// ── Corpo: Jurisprudência (tese/pergunta → revelar → 4 avaliações) ──────────
function JurisBody({
  item, revealed, saving, onReveal, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'juris' }>;
  revealed: boolean; saving: boolean;
  onReveal: () => void; onRate: (r: JurisRating) => void;
}) {
  const j = item.juris;
  const temFlash = !!(j.flashcard_frente && j.flashcard_verso);
  return (
    <div style={s.card}>
      <div style={s.leiHead}>
        <span style={{ ...s.subjBadge, background: theme.teal, color: theme.onTeal }}>{j.tribunal}</span>
        <span style={{ ...s.subjBadge, background: 'rgba(15,23,42,.08)', color: theme.inkSoft }}>{j.disciplina}</span>
      </div>
      <div style={s.teseBox}>
        <p style={s.teseLabel}>{temFlash ? 'Pergunta' : 'Tese principal'}</p>
        <p style={s.teseText}>{temFlash ? j.flashcard_frente : j.tese}</p>
      </div>
      {revealed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {temFlash && (
            <div style={{ background: theme.okTint, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ ...s.secLabel, color: theme.okDeep }}>Resposta</p>
              <p style={s.secText}>{j.flashcard_verso}</p>
            </div>
          )}
          {!temFlash && j.resumo && (
            <div><p style={s.secLabel}>Resumo</p><p style={s.secText}>{j.resumo}</p></div>
          )}
          {j.como_banca_cobra && (
            <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ ...s.secLabel, color: theme.clay }}>Como a banca cobra</p>
              <p style={s.secText}>{j.como_banca_cobra}</p>
            </div>
          )}
          {j.pegadinhas && (
            <div style={{ background: theme.dangerTint, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ ...s.secLabel, color: theme.danger }}>Pegadinha</p>
              <p style={s.secText}>{j.pegadinhas}</p>
            </div>
          )}
        </div>
      )}
      {!revealed ? (
        <div style={{ textAlign: 'center' }}>
          <Button onClick={onReveal} style={{ padding: '13px 32px', fontSize: 15 }}>{temFlash ? 'Ver resposta' : 'Ver tudo'}</Button>
          <p style={s.kbdHint}>ou aperte <kbd style={s.kbd}>espaço</kbd></p>
        </div>
      ) : (
        <RatingRow4 saving={saving} onRate={onRate} />
      )}
    </div>
  );
}

// ── Linhas de avaliação reutilizáveis ───────────────────────────────────────
function RatingRow3({ saving, onRate }: { saving: boolean; onRate: (r: ReviewRating) => void }) {
  return (
    <div style={s.ratings3}>
      {RATINGS_3.map((r, i) => (
        <button key={r.key} onClick={() => onRate(r.key)} disabled={saving}
          style={{ ...s.rating3Btn, color: r.fg, background: r.bg, opacity: saving ? 0.55 : 1 }}>
          <span style={s.ratingKey}>{i + 1}</span>
          <span style={s.ratingLbl}>{r.label}</span>
        </button>
      ))}
    </div>
  );
}

function RatingRowFC({ saving, onRate }: { saving: boolean; onRate: (r: CardRating) => void }) {
  return (
    <div style={s.ratings4}>
      {FC_RATINGS.map((r, i) => (
        <button key={r.key} onClick={() => onRate(r.key)} disabled={saving}
          style={{ ...s.rating4Btn, border: `0.5px solid ${r.fg}`, background: r.bg, color: r.fg, opacity: saving ? 0.55 : 1 }}>
          <span style={s.ratingKey}>{i + 1}</span>
          <span style={s.ratingLbl}>{r.label}</span>
        </button>
      ))}
    </div>
  );
}

function RatingRow4({ saving, onRate }: { saving: boolean; onRate: (r: JurisRating) => void }) {
  return (
    <div style={s.ratings4}>
      {RATINGS_4.map((r, i) => (
        <button key={r.key} onClick={() => onRate(r.key)} disabled={saving}
          style={{ ...s.rating4Btn, border: `0.5px solid ${r.fg}`, background: r.bg, color: r.fg, opacity: saving ? 0.55 : 1 }}>
          <span style={s.ratingKey}>{i + 1}</span>
          <span style={s.ratingLbl}>{RATING_LABEL[r.key]}</span>
        </button>
      ))}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  exitBtn: { display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0, flexShrink: 0 },
  progressTrack: { flex: 1, height: 5, background: theme.line, borderRadius: theme.radiusPill, overflow: 'hidden' },
  progressBar: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width .3s ease' },
  progressLabel: { fontSize: 13, fontWeight: 600, color: theme.inkFaint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  body: { minWidth: 0 },
  itemHead: { marginBottom: 10 },

  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: '24px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 },
  subjBadge: { alignSelf: 'flex-start', fontSize: 11, color: '#fff', padding: '3px 10px', borderRadius: theme.radiusXs, fontWeight: 700, letterSpacing: 0.3 },

  // flashcard
  fcContent: { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 120 },
  fcFront: { fontSize: 19, fontWeight: 600, color: theme.ink, textAlign: 'center', margin: 0, lineHeight: 1.5, overflowWrap: 'break-word' },
  sep: { height: 1, background: theme.line, margin: '18px 0' },
  fcBack: { fontSize: 16, color: theme.inkSoft, textAlign: 'center', margin: 0, lineHeight: 1.6, overflowWrap: 'break-word' },

  // lei
  leiHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  leiRotulo: { fontSize: 16, fontWeight: 700, color: theme.ink },
  leiCaminho: { fontSize: 12, color: theme.inkFaint, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  leiHint: { fontSize: 13, color: theme.inkSoft, margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  revelarTudo: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  leiTexto: { fontSize: 15, lineHeight: 1.9, color: theme.ink },
  leiBloco: { margin: '0 0 8px' },
  leiBlocoRotulo: { fontWeight: 600, color: theme.inkSoft },
  lacuna: { background: theme.muted, borderRadius: 4, cursor: 'pointer', borderBottom: `1.5px dashed ${theme.inkFaint}` },

  // juris
  teseBox: { background: theme.tealBg, border: `1px solid ${theme.teal}`, borderRadius: theme.radiusSm, padding: '16px 18px' },
  teseLabel: { fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' },
  teseText: { fontSize: 17, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 },
  secLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 5px' },
  secText: { fontSize: 14, color: theme.ink, lineHeight: 1.65, margin: 0 },

  // ações
  kbdHint: { fontSize: 12, color: theme.inkFaint, marginTop: 10 },
  kbd: { fontFamily: 'ui-monospace, monospace', fontSize: 11, padding: '1px 6px', borderRadius: 5, border: `0.5px solid ${theme.line}`, background: theme.muted, color: theme.inkSoft },
  ratings3: { display: 'flex', gap: 8 },
  rating3Btn: { flex: 1, minWidth: 0, padding: '13px 6px 11px', borderRadius: theme.radiusSm, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  ratings4: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  rating4Btn: { padding: '13px 10px', borderRadius: theme.radiusSm, cursor: 'pointer', fontFamily: theme.font, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  ratingKey: { fontSize: 11, opacity: 0.65 },
  ratingLbl: { fontWeight: 700, fontSize: 14 },

  // done
  doneTitle: { fontSize: 26, fontWeight: 800, color: theme.ink, margin: '0 0 10px', letterSpacing: -0.4 },
  doneSub: { fontSize: 15, color: theme.inkSoft, margin: '0 0 28px' },
  doneStats: { display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 },
  doneStatBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  doneStatNum: { fontSize: 34, fontWeight: 800, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  doneStatLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  doneActions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
};
