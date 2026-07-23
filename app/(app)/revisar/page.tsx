// app/(app)/revisar/page.tsx
// Fila Única de Revisão (M1): um só lugar, uma só barra de progresso, uma só
// celebração no fim. Intercala os quatro tipos de revisão do app — tópicos,
// flashcards, lei seca e jurisprudências — num player sequencial, eliminando a
// peregrinação por /reviews, /flashcards, /vademecum/revisar e
// /jurisprudencias/revisar. Cada tipo mantém sua própria gramática de avaliação.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { buildFilaUnificada, getNextScheduledDateUnificada, type UnifiedItem, type UnifiedKind } from '@/services/revisaoUnificada.service';
import { parseLocalDate, toLocalDateString, localDateInDays } from '@/lib/local-date';
import { submitReview, rescheduleReview, type ReviewRating } from '@/services/reviews.service';
import { submitCardReview, type ReviewRating as CardRating } from '@/services/flashcards.service';
import { submitRevisaoArtigo } from '@/services/leiInteracoes.service';
import { submitRevisao as submitJurisRevisao } from '@/services/jurisInteracoes.service';
import {
  RATING_LABEL, calculateNextJurisReview, fromJurisDbRow, INITIAL_JURIS_STATE,
  type JurisRating, type JurisReviewState,
} from '@/lib/juris-review';
import { GRIFO_CORES, SUBLINHADO_COR, segmentarBloco } from '@/lib/lei-grifos';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { fmtInterval } from '@/lib/interval-format';
import { ReviewCard } from '@/components/features/reviews/ReviewCard';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageContainer } from '@/components/ui/Page';

// ── Metadados por tipo (rótulo + cor do chip) ──────────────────────────────
const KIND_META: Record<UnifiedKind, { label: string; plural: string; fg: string; bg: string }> = {
  topic:     { label: 'Tópico',         plural: 'Tópicos',         fg: theme.teal,   bg: theme.tealBg },
  flashcard: { label: 'Flashcard',      plural: 'Flashcards',      fg: theme.info,   bg: theme.infoBg },
  lei:       { label: 'Lei seca',       plural: 'Leis secas',      fg: theme.clay,   bg: theme.clayBg },
  // warnBg (sólido) e não warnTint: o mesmo tint translúcido media ~2,3:1 no
  // escuro contra warnDeep — o mesmo bug de contraste corrigido em RATINGS_4.
  juris:     { label: 'Jurisprudência', plural: 'Jurisprudências', fg: theme.warnDeep, bg: theme.warnBg },
};

// Ordem 1..4 dos atalhos de teclado para tópicos — espelha os botões do ReviewCard.
const TOPIC_KEYS: ReviewRating[] = ['esqueci', 'dificil', 'intermediario', 'facil'];

// Flashcards ganham o lapso ("Errei"): quality 0 no SM-2 — reseta repetições e
// derruba o ease factor. Alinha com lei/juris, que já tinham o botão.
// Fundos sólidos (não os *Tint translúcidos): sobre o tema escuro um tint de
// baixo alfa fica quase da mesma luminância do texto colorido — contraste
// medido abaixo de 2:1 em 3 dos 4 botões. 'Médio' vai para fundo neutro porque
// --info-bg é o único token de tint que não ganhou versão sólida no escuro.
const FC_RATINGS: { key: CardRating; label: string; fg: string; bg: string }[] = [
  { key: 'errei',         label: 'Errei',   fg: theme.danger,  bg: theme.dangerBg },
  { key: 'dificil',       label: 'Difícil', fg: theme.inkSoft, bg: theme.muted  },
  { key: 'intermediario', label: 'Médio',   fg: theme.info,    bg: theme.muted  },
  { key: 'facil',         label: 'Fácil',   fg: theme.okDeep,  bg: theme.okBg   },
];

const RATINGS_4: { key: JurisRating; fg: string; bg: string }[] = [
  { key: 'errei',   fg: theme.danger,   bg: theme.dangerBg },
  { key: 'dificil', fg: theme.warnDeep, bg: theme.warnBg },
  { key: 'ok',      fg: theme.tealDeep, bg: theme.tealBg },
  { key: 'dominei', fg: theme.okDeep,   bg: theme.okBg },
];

function KindBadge({ kind }: { kind: UnifiedKind }) {
  const m = KIND_META[kind];
  return <Badge style={{ color: m.fg, background: m.bg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.label}</Badge>;
}

// Data da próxima revisão agendada, para o empty state "nada vencido hoje".
function fmtProximaData(dateStr: string): string {
  const hoje = parseLocalDate(toLocalDateString());
  const alvo = parseLocalDate(dateStr);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias < 7) return `em ${dias} dias`;
  return alvo.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

export default function RevisarUnificadoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMobile } = useUI();
  const toast = useToast();

  const [fila, setFila] = useState<UnifiedItem[] | null>(null);
  const [erro, setErro] = useState(false); // falha ao montar a fila ≠ fila vazia
  const [totalReal, setTotalReal] = useState(0); // itens antes do teto (para "o resto espera")
  const [idx, setIdx] = useState(0);
  // Guarda SÍNCRONA contra duplo submit: dois keydowns no mesmo tick passam
  // pelo estado React (que só muda no próximo render) — a ref não. Fica
  // travada durante todo o salvamento em segundo plano (não durante o avanço
  // otimista, que é instantâneo) para blindar contra o mesmo `current` stale.
  const savingRef = useRef(false);
  const [revealed, setRevealed] = useState(false);           // flashcard / juris
  const [reveladas, setReveladas] = useState<Set<string>>(new Set()); // lacunas de lei
  const [tally, setTally] = useState<Record<UnifiedKind, number>>({ topic: 0, flashcard: 0, lei: 0, juris: 0 });
  const [puladas, setPuladas] = useState(0);
  const [adiadas, setAdiadas] = useState(0); // tópicos reagendados manualmente — não voltam à fila de hoje
  const [adiarAberto, setAdiarAberto] = useState(false);
  const [proximaData, setProximaData] = useState<string | null>(null); // só preenchida quando a fila nasce vazia

  // Modo Retomada envia ?limite=N para um "recomeço leve" sem encarar a pilha toda.
  const limite = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const n = Number(new URLSearchParams(window.location.search).get('limite'));
    return Number.isInteger(n) && n > 0 ? n : null;
  }, []);

  // Só a parte assíncrona — sem setState síncrono, para o efeito de montagem
  // não disparar render em cascata.
  const fetchFila = useCallback(() => {
    setErro(false);
    buildFilaUnificada()
      .then((f) => {
        setTotalReal(f.items.length);
        setFila(limite ? f.items.slice(0, limite) : f.items);
        // Fila já nasce vazia: busca quando algo vai vencer, à parte da
        // renderização principal — não atrasa a tela de "tudo em dia".
        if (f.items.length === 0) {
          getNextScheduledDateUnificada().then(setProximaData).catch(() => setProximaData(null));
        }
      })
      // Erro ≠ vazio: mostrar "tudo em dia" numa falha de rede esconderia a
      // pilha real do usuário. Tela de erro com retry.
      .catch(() => { setFila(null); setErro(true); });
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
    setPuladas(0);
    setAdiadas(0);
    setProximaData(null);
    fetchFila();
  }, [fetchFila]);

  const total = fila?.length ?? 0;
  const current = fila && idx < total ? fila[idx] : null;
  const done = fila !== null && current === null;
  const feitas = useMemo(() => Object.values(tally).reduce((a, b) => a + b, 0), [tally]);

  function advance() {
    setRevealed(false);
    setReveladas(new Set());
    setAdiarAberto(false);
    setIdx((i) => i + 1);
  }

  // Pular sem avaliar: o item continua vencido e volta na próxima fila. Sem
  // guarda contra o `current` — o avanço em si já é síncrono e instantâneo.
  function skip() {
    if (!current) return;
    setPuladas((n) => n + 1);
    advance();
  }

  // Adiar (só tópicos, únicos com data manual — reagenda sem passar pelo SM-2):
  // diferente de pular, o item sai do vencimento de hoje de verdade, então não
  // conta como "restante" na tela final. Otimista como o commit() — e usa a
  // MESMA savingRef: dois presets clicados em sequência rápida (ou o date
  // input disparando onChange duas vezes) senão pulariam 2 itens de uma vez.
  async function adiar(dateStr: string) {
    if (savingRef.current || !current || current.kind !== 'topic') return;
    savingRef.current = true;
    const item = current;
    setAdiadas((n) => n + 1);
    advance();
    try {
      await rescheduleReview(item.id, dateStr);
      queryClient.invalidateQueries({ queryKey: ['due-reviews-count'] });
    } catch (e) {
      setAdiadas((n) => Math.max(0, n - 1));
      toast.error(e instanceof Error ? e.message : 'Não foi possível adiar essa revisão.');
    } finally {
      savingRef.current = false;
    }
  }

  // requeue: lapso ("Errei" de flashcard) — o cartão volta para o FIM da fila
  // da sessão, cumprindo a promessa de "rever ainda hoje" do SM-2.
  //
  // Otimista: a UI avança NA HORA (advance + contagem/requeue), o salvamento
  // roda em segundo plano. Antes o usuário esperava ~1 round-trip (GET+UPDATE)
  // parado no mesmo card a cada avaliação; agora já vê o próximo item mesmo
  // com a rede lenta. Falha? Desfaz só a contagem otimista — o dado nunca foi
  // gravado, então o item reaparece sozinho numa fila futura; não força o
  // usuário de volta a um card que ele já deixou para trás.
  async function commit(fn: () => Promise<unknown>, opts?: { requeue?: boolean }) {
    if (savingRef.current || !current) return;
    savingRef.current = true;
    const item = current;

    if (opts?.requeue) {
      setFila((f) => (f ? [...f, item] : f));
    } else {
      setTally((t) => ({ ...t, [item.kind]: t[item.kind] + 1 }));
    }
    advance();

    try {
      await fn();
      refreshHomeAfterSession(queryClient);
      queryClient.invalidateQueries({ queryKey: ['due-juris-count'] });
      queryClient.invalidateQueries({ queryKey: ['retomada'] });
    } catch (e) {
      if (opts?.requeue) {
        setFila((f) => {
          if (!f) return f;
          const lastIdx = f.map((it) => it.kind === item.kind && it.id === item.id).lastIndexOf(true);
          return lastIdx === -1 ? f : f.filter((_, i) => i !== lastIdx);
        });
      } else {
        setTally((t) => ({ ...t, [item.kind]: Math.max(0, t[item.kind] - 1) }));
      }
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar essa avaliação. O item deve reaparecer numa próxima fila.');
    } finally {
      savingRef.current = false;
    }
  }

  // ── Atalhos de teclado: Espaço revela; 1..4 avaliam quando pronto ──────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!current) return;
      const needsReveal = current.kind === 'flashcard' || current.kind === 'juris';

      if ((e.key === ' ' || e.code === 'Space') && needsReveal && !revealed) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (needsReveal && !revealed) return;

      if (current.kind === 'topic' && n <= 4) {
        void commit(() => submitReview(current.id, TOPIC_KEYS[n - 1]));
      } else if (current.kind === 'flashcard' && n <= 4) {
        const rating = FC_RATINGS[n - 1].key;
        void commit(() => submitCardReview(current.id, rating), { requeue: rating === 'errei' });
      } else if (current.kind === 'lei' && n <= 4) {
        void commit(() => submitRevisaoArtigo(current.id, RATINGS_4[n - 1].key, current.interacao));
      } else if (current.kind === 'juris' && n <= 4) {
        void commit(() => submitJurisRevisao(current.id, RATINGS_4[n - 1].key, current.juris.interacao));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, revealed]);

  // ── Estados de borda ───────────────────────────────────────────────────────
  if (erro) {
    return (
      <PageContainer width="narrow" style={{ padding: isMobile ? '40px 16px' : '72px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
        <h1 style={s.doneTitle}>Não conseguimos montar sua fila</h1>
        <p style={s.doneSub}>Verifique sua conexão e tente de novo — suas revisões continuam salvas.</p>
        <div style={s.doneActions}>
          <Button onClick={fetchFila}>Tentar de novo</Button>
          <Button variant="outline" onClick={() => router.push('/')}>Voltar para a Home</Button>
        </div>
      </PageContainer>
    );
  }

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
    // Fila foi limitada (Modo Retomada), houve pulos, ou itens foram adiados
    // para uma data futura de verdade (não "restam" mais na pilha de hoje).
    const restante = Math.max(0, totalReal - feitas - adiadas);
    const nuncaTeveFila = totalReal === 0;
    const soPulou = !nuncaTeveFila && feitas === 0;

    let subMsg: string;
    if (nuncaTeveFila) {
      subMsg = proximaData
        ? `Nenhuma revisão venceu hoje. A próxima vence ${fmtProximaData(proximaData)}.`
        : 'Nenhuma revisão venceu hoje. Para alimentar a fila, ative a revisão nos seus tópicos, flashcards, artigos do Vade Mecum e jurisprudências.';
    } else if (soPulou) {
      const partes: string[] = [];
      if (puladas > 0) partes.push(`pulou ${puladas === 1 ? '1 item' : `${puladas} itens`} — ${puladas === 1 ? 'ele continua' : 'eles continuam'} na fila`);
      if (adiadas > 0) partes.push(`adiou ${adiadas === 1 ? '1 tópico' : `${adiadas} tópicos`} para outra data`);
      subMsg = `Você ${partes.join(' e ')}.`;
    } else if (restante > 0) {
      subMsg = `Você fez ${feitas} ${feitas === 1 ? 'item' : 'itens'}. ${restante === 1 ? 'Ainda resta 1 — sem pressa, ele espera' : `Ainda restam ${restante} — sem pressa, eles esperam`} por você.`;
    } else {
      subMsg = `Você revisou ${feitas} ${feitas === 1 ? 'item' : 'itens'} nesta sessão.`;
    }

    return (
      <PageContainer width="narrow" style={{ padding: isMobile ? '40px 16px' : '72px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{nuncaTeveFila ? '🎉' : restante > 0 ? '🌱' : '🎉'}</div>
        <h1 style={s.doneTitle}>
          {nuncaTeveFila ? 'Nada para revisar agora' : soPulou ? 'Até a próxima!' : restante > 0 ? 'Bom recomeço!' : 'Revisão em dia!'}
        </h1>
        <p style={s.doneSub}>{subMsg}</p>
        {linhas.length > 0 && (
          <div style={s.doneStats}>
            {linhas.map((l) => (
              <div key={l.kind} style={s.doneStatBox}>
                <span style={{ ...s.doneStatNum, color: KIND_META[l.kind].fg }}>{l.n}</span>
                <span style={s.doneStatLabel}>{l.n === 1 ? KIND_META[l.kind].label : KIND_META[l.kind].plural}</span>
              </div>
            ))}
          </div>
        )}
        <div style={s.doneActions}>
          {restante > 0 && !soPulou && (
            <Button onClick={continuar}>
              Continuar · +{Math.min(limite ?? restante, restante)}
            </Button>
          )}
          <Button variant={restante > 0 && !soPulou ? 'outline' : 'primary'} onClick={() => router.push('/')}>
            Voltar para a Home
          </Button>
        </div>
      </PageContainer>
    );
  }

  // ── Player ─────────────────────────────────────────────────────────────────
  return (
    <PageContainer width="narrow">
      <h1 style={s.srOnly}>Fila de revisão</h1>
      {/* Barra superior: sair · progresso · contador */}
      <div style={s.topBar}>
        <button onClick={() => router.push('/')} style={s.exitBtn} className="touch-target">
          <X size={14} strokeWidth={2} />
          Sair
        </button>
        <div
          style={s.progressTrack}
          role="progressbar"
          aria-label="Progresso da sessão de revisão"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={idx}
          aria-valuetext={`Item ${idx + 1} de ${total}`}
        >
          <div style={{ ...s.progressBar, width: `${(idx / total) * 100}%` }} />
        </div>
        <span style={s.progressLabel}>{idx + 1}/{total}</span>
      </div>

      {current && (
        <div style={s.body}>
          <div style={s.itemHead}>
            <KindBadge kind={current.kind} />
            <div style={s.itemHeadActions}>
              {current.kind === 'topic' && (
                <button onClick={() => setAdiarAberto((v) => !v)} style={s.skipBtn} className="touch-target">
                  Adiar
                </button>
              )}
              <button onClick={skip} style={s.skipBtn} className="touch-target">
                Pular por agora →
              </button>
            </div>
          </div>

          {current.kind === 'topic' && adiarAberto && (
            <div style={s.adiarPop}>
              <p style={s.adiarTitle}>Adiar esta revisão para</p>
              <div style={s.adiarPresets}>
                {[1, 3, 7].map((d) => (
                  <button key={d} onClick={() => void adiar(localDateInDays(d))} style={s.adiarPresetBtn}>
                    +{d} {d === 1 ? 'dia' : 'dias'}
                  </button>
                ))}
                <input
                  type="date"
                  min={localDateInDays(1)}
                  aria-label="Data específica"
                  onChange={(e) => { if (e.target.value) void adiar(e.target.value); }}
                  style={s.adiarDateInput}
                />
              </div>
            </div>
          )}

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
              onReveal={() => setRevealed(true)}
              onRate={(rating) => { void commit(() => submitCardReview(current.id, rating), { requeue: rating === 'errei' }); }}
            />
          )}

          {current.kind === 'lei' && (
            <LeiBody
              key={current.id}
              item={current}
              reveladas={reveladas}
              setReveladas={setReveladas}
              onRate={(rating) => { void commit(() => submitRevisaoArtigo(current.id, rating, current.interacao)); }}
            />
          )}

          {current.kind === 'juris' && (
            <JurisBody
              key={current.id}
              item={current}
              revealed={revealed}
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
  item, revealed, onReveal, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'flashcard' }>;
  revealed: boolean;
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
        <RatingRowFC item={item} onRate={onRate} />
      )}
    </div>
  );
}

// ── Corpo: Lei seca (texto com lacunas → 4 avaliações) ──────────────────────
function LeiBody({
  item, reveladas, setReveladas, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'lei' }>;
  reveladas: Set<string>; setReveladas: (s: Set<string>) => void;
  onRate: (r: JurisRating) => void;
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
                // Botão (não span): focável por teclado e com largura fixa —
                // largura proporcional vazaria o tamanho da resposta, e spans
                // só com espaços colapsam para 0px de largura.
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReveladas(new Set(reveladas).add(seg.grifo!.id))}
                    title="Revelar trecho oculto"
                    aria-label="Revelar trecho oculto"
                    style={s.lacuna}
                  />
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
      <RatingRow4 state={fromJurisDbRow(interacao)} onRate={onRate} />
    </div>
  );
}

// ── Corpo: Jurisprudência (tese/pergunta → revelar → 4 avaliações) ──────────
function JurisBody({
  item, revealed, onReveal, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'juris' }>;
  revealed: boolean;
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
        <RatingRow4
          state={j.interacao ? fromJurisDbRow(j.interacao) : INITIAL_JURIS_STATE}
          onRate={onRate}
        />
      )}
    </div>
  );
}

// ── Linhas de avaliação reutilizáveis ───────────────────────────────────────
function RatingRowFC({
  item, onRate,
}: {
  item: Extract<UnifiedItem, { kind: 'flashcard' }>; onRate: (r: CardRating) => void;
}) {
  return (
    <div style={s.ratings4}>
      {FC_RATINGS.map((r, i) => (
        <button key={r.key} onClick={() => onRate(r.key)}
          style={{ ...s.rating4Btn, border: `0.5px solid ${r.fg}`, background: r.bg, color: r.fg }}>
          <span style={s.ratingKey}>{i + 1}</span>
          <span style={s.ratingLbl}>{r.label}</span>
          <span style={s.ratingInterval}>→ {fmtInterval(item.card.nextIntervals[r.key])}</span>
        </button>
      ))}
    </div>
  );
}

function RatingRow4({
  state, onRate,
}: {
  state: JurisReviewState; onRate: (r: JurisRating) => void;
}) {
  return (
    <div style={s.ratings4}>
      {RATINGS_4.map((r, i) => (
        <button key={r.key} onClick={() => onRate(r.key)}
          style={{ ...s.rating4Btn, border: `0.5px solid ${r.fg}`, background: r.bg, color: r.fg }}>
          <span style={s.ratingKey}>{i + 1}</span>
          <span style={s.ratingLbl}>{RATING_LABEL[r.key]}</span>
          <span style={s.ratingInterval}>→ {fmtInterval(calculateNextJurisReview(state, r.key).intervalDays)}</span>
        </button>
      ))}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  srOnly: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  exitBtn: { display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0, flexShrink: 0 },
  progressTrack: { flex: 1, height: 5, background: theme.line, borderRadius: theme.radiusPill, overflow: 'hidden' },
  progressBar: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width .3s ease' },
  progressLabel: { fontSize: 13, fontWeight: 600, color: theme.inkFaint, flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  body: { minWidth: 0 },
  itemHead: { marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemHeadActions: { display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 },
  skipBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0, flexShrink: 0 },
  adiarPop: { background: theme.muted, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '12px 14px', marginBottom: 12 },
  adiarTitle: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, margin: '0 0 8px' },
  adiarPresets: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  adiarPresetBtn: { border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: theme.radiusXs, cursor: 'pointer', fontFamily: 'inherit' },
  adiarDateInput: { border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, padding: '6px 10px', borderRadius: theme.radiusXs, fontFamily: 'inherit' },

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
  lacuna: { display: 'inline-block', width: 72, height: '1.05em', verticalAlign: 'text-bottom', background: theme.muted, borderRadius: 4, cursor: 'pointer', border: 'none', borderBottom: `1.5px dashed ${theme.inkFaint}`, padding: 0 },

  // juris
  teseBox: { background: theme.tealBg, border: `1px solid ${theme.teal}`, borderRadius: theme.radiusSm, padding: '16px 18px' },
  teseLabel: { fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' },
  teseText: { fontSize: 17, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 },
  secLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 5px' },
  secText: { fontSize: 14, color: theme.ink, lineHeight: 1.65, margin: 0 },

  // ações
  kbdHint: { fontSize: 12, color: theme.inkFaint, marginTop: 10 },
  kbd: { fontFamily: 'ui-monospace, monospace', fontSize: 11, padding: '1px 6px', borderRadius: 5, border: `0.5px solid ${theme.line}`, background: theme.muted, color: theme.inkSoft },
  ratings4: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  rating4Btn: { padding: '13px 10px', borderRadius: theme.radiusSm, cursor: 'pointer', fontFamily: theme.font, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  ratingKey: { fontSize: 11, opacity: 0.65 },
  ratingLbl: { fontWeight: 700, fontSize: 14 },
  ratingInterval: { fontSize: 11, fontWeight: 500, opacity: 0.85 },

  // done
  doneTitle: { fontSize: 26, fontWeight: 800, color: theme.ink, margin: '0 0 10px', letterSpacing: -0.4 },
  doneSub: { fontSize: 15, color: theme.inkSoft, margin: '0 0 28px' },
  doneStats: { display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 },
  doneStatBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  doneStatNum: { fontSize: 34, fontWeight: 800, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  doneStatLabel: { fontSize: 12, color: theme.inkFaint, fontWeight: 500 },
  doneActions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
};
