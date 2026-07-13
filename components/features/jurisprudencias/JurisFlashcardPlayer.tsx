'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { theme, kbd } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';
import { submitRevisao } from '@/services/jurisInteracoes.service';
import { RATING_LABEL, type JurisRating } from '@/lib/juris-review';
import { useConfirm } from '@/hooks/useConfirm';
import { Overlay } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/ToastProvider';

interface Props {
  items: Jurisprudencia[];
  onClose: () => void;
}

const RATINGS: { key: JurisRating; color: string; bg: string }[] = [
  { key: 'errei',   color: theme.danger,   bg: theme.dangerTint },
  { key: 'dificil', color: theme.warnDeep, bg: theme.warnTint },
  { key: 'ok',      color: theme.tealDeep, bg: theme.tealBg },
  { key: 'dominei', color: theme.okDeep,   bg: theme.okTint },
];

export const JurisFlashcardPlayer = memo(function JurisFlashcardPlayer({ items, onClose }: Props) {
  const cards = useMemo(() => items.filter((i) => i.flashcard_frente && i.flashcard_verso), [items]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  // cardId → última avaliação dada nesta sessão (re-avaliações sobrescrevem)
  const [ratings, setRatings] = useState<Map<string, JurisRating>>(new Map());
  const { confirm, dialog } = useConfirm();
  const toast = useToast();

  async function safeClose() {
    if (!done && idx > 0) {
      const ok = await confirm({
        title: 'Encerrar a sessão de flashcards?',
        description: 'O progresso não será salvo.',
        confirmLabel: 'Encerrar',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  // Atalhos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape é tratado pelo Overlay (chama o mesmo onClose/safeClose).
      // Espaço/Enter: vira o card (frente ↔ verso)
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((v) => !v); }
      // Anterior sempre disponível
      if (e.key === 'ArrowLeft') prev();
      // Quando revelado: 1-4 para avaliar e avançar
      if (flipped) {
        const currentId = cards[idx]?.id;
        if (!currentId) return;
        if (e.key === '1') rateAndAdvance(currentId, 'errei');
        if (e.key === '2') rateAndAdvance(currentId, 'dificil');
        if (e.key === '3') rateAndAdvance(currentId, 'ok');
        if (e.key === '4') rateAndAdvance(currentId, 'dominei');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // flipped, idx e done nas deps para closure ler valores frescos.
  }, [flipped, idx, done, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cards.length === 0) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: 15, color: theme.inkSoft, marginBottom: 20 }}>Nenhum flashcard disponível nesta seleção.</p>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </Overlay>
    );
  }

  const card = cards[idx];
  const pct = Math.round(((idx + (flipped ? 0.5 : 0)) / cards.length) * 100);

  function next() {
    if (idx < cards.length - 1) { setIdx((i) => i + 1); setFlipped(false); }
    else setDone(true);
  }
  function prev() { if (idx > 0) { setIdx((i) => i - 1); setFlipped(false); } }
  function restart() { setIdx(0); setFlipped(false); setDone(false); setRatings(new Map()); }

  function rateAndAdvance(cardId: string, rating: JurisRating) {
    submitRevisao(cardId, rating).catch(() => toast.error('Erro ao salvar revisão.')); // fire-and-forget; não bloqueia o UI
    setRatings((prev) => { const m = new Map(prev); m.set(cardId, rating); return m; });
    next();
  }

  if (done) {
    const ratingsList = [...ratings.values()];
    const countByRating: Record<JurisRating, number> = { dominei: 0, ok: 0, dificil: 0, errei: 0 };
    for (const r of ratingsList) countByRating[r]++;
    const totalAvaliados = ratingsList.length;

    const RATING_META: { key: JurisRating; label: string; color: string; bg: string }[] = [
      { key: 'dominei', label: 'Dominei',  color: theme.okDeep,   bg: theme.okTint },
      { key: 'ok',      label: 'Ok',       color: theme.tealDeep, bg: theme.tealBg },
      { key: 'dificil', label: 'Difícil',  color: theme.warnDeep, bg: theme.warnTint },
      { key: 'errei',   label: 'Errei',    color: theme.danger,   bg: theme.dangerTint },
    ];

    return (
      <Overlay onClose={onClose} labelledBy="flashcard-done-title">
        <div style={{ padding: '8px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
            <h2 id="flashcard-done-title" style={{ fontSize: 20, fontWeight: 800, color: theme.ink, margin: '0 0 6px' }}>Sessão concluída!</h2>
            <p style={{ fontSize: 14, color: theme.inkSoft, margin: 0 }}>
              {cards.length} {cards.length === 1 ? 'flashcard' : 'flashcards'} revisados
              {totalAvaliados > 0 && ` · ${totalAvaliados} avaliados`}
            </p>
          </div>

          {totalAvaliados > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px', textAlign: 'center' }}>
                Sua performance nesta sessão
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {RATING_META.map(({ key, label, color, bg }) => {
                  const n = countByRating[key];
                  if (n === 0) return null;
                  return (
                    <div key={key} style={{
                      padding: '10px 14px', borderRadius: theme.radiusSm,
                      background: bg, border: `0.5px solid ${color}40`,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color, minWidth: 28, textAlign: 'center' }}>{n}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
              {countByRating.errei > 0 && (
                <p style={{ fontSize: 12, color: theme.danger, marginTop: 10, textAlign: 'center' }}>
                  {countByRating.errei} {countByRating.errei === 1 ? 'card agendado' : 'cards agendados'} para revisão em breve
                </p>
              )}
              {countByRating.dominei > 0 && countByRating.errei === 0 && (
                <p style={{ fontSize: 12, color: theme.okDeep, marginTop: 10, textAlign: 'center' }}>
                  Ótimo! Todos os cards bem avaliados.
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button onClick={restart}>Recomeçar</Button>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <>
    {dialog}
    <Overlay onClose={safeClose} labelledBy="flashcard-modal-title">
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span id="flashcard-modal-title" style={{ fontSize: 13, fontWeight: 700, color: theme.teal, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={15} strokeWidth={1.7} />
          Flashcards
        </span>
        <span style={{ fontSize: 13, color: theme.inkFaint }}>
          {idx + 1} / {cards.length}
        </span>
        <button onClick={safeClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: theme.inkFaint, cursor: 'pointer', lineHeight: 1, display: 'flex' }} aria-label="Fechar"><X size={18} strokeWidth={2} /></button>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 4, background: theme.line, borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: theme.teal, borderRadius: 4, transition: 'width .3s ease' }} />
      </div>

      {/* Contexto */}
      <div style={{ fontSize: 12, color: theme.inkFaint, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: theme.tealDeep, background: theme.tealBg, borderRadius: 5, padding: '1px 7px' }}>{card.tribunal}</span>
        <span>{card.disciplina}{card.materia ? ` · ${card.materia}` : ''}</span>
      </div>

      {/* Card principal — clicável e focável via teclado */}
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Verso — Resposta. Pressione Espaço para virar de volta.' : 'Frente — Pergunta. Pressione Espaço para revelar a resposta.'}
        aria-keyshortcuts="Space"
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((v) => !v); } }}
        style={{
          minHeight: 180, borderRadius: theme.radiusSm,
          border: `1.5px solid ${flipped ? theme.teal : theme.line}`,
          background: flipped ? theme.tealBg : theme.bg,
          padding: '22px 24px', cursor: 'pointer',
          transition: 'background .2s, border-color .2s',
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 18, outline: 'none',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: flipped ? theme.teal : theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {flipped ? 'Verso — Resposta' : 'Frente — Pergunta'}
        </span>
        <p style={{ fontSize: 15, color: theme.ink, margin: 0, lineHeight: 1.7, fontWeight: flipped ? 400 : 600 }}>
          {flipped ? card.flashcard_verso : card.flashcard_frente}
        </p>
        {!flipped && (
          <span style={{ fontSize: 12, color: theme.inkFaint, marginTop: 'auto' }}>Clique ou pressione Espaço para revelar</span>
        )}
      </div>

      {/* Navegação */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outline"
          onClick={prev}
          disabled={idx === 0}
          aria-keyshortcuts="ArrowLeft"
          style={{ flexShrink: 0 }}
        >
          ← Anterior
        </Button>

        {!flipped ? (
          <>
            <span style={{ flex: 1 }} />
            <Button onClick={() => setFlipped(true)} aria-keyshortcuts="Space Enter">
              Revelar resposta
            </Button>
          </>
        ) : (
          // Botões de avaliação — substituem "Próximo" e alimentam a revisão espaçada
          <>
            {RATINGS.map(({ key, color, bg }, i) => (
              <button
                key={key}
                onClick={() => rateAndAdvance(card.id, key)}
                aria-keyshortcuts={String(i + 1)}
                style={{
                  flex: 1, padding: '9px 6px', borderRadius: theme.radiusSm,
                  border: `1.5px solid ${color}`, background: bg,
                  color, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: theme.font,
                  whiteSpace: 'nowrap', minWidth: 60,
                }}
              >
                {RATING_LABEL[key]}
              </button>
            ))}
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: theme.inkFaint, textAlign: 'center', margin: '14px 0 0' }}>
        {flipped
          ? <>Atalhos: <kbd style={kbd}>1</kbd> Errei · <kbd style={kbd}>2</kbd> Difícil · <kbd style={kbd}>3</kbd> Ok · <kbd style={kbd}>4</kbd> Dominei · <kbd style={kbd}>←</kbd> anterior · <kbd style={kbd}>Esc</kbd> fechar</>
          : <>Atalhos: <kbd style={kbd}>Espaço</kbd> revelar · <kbd style={kbd}>←</kbd> anterior · <kbd style={kbd}>Esc</kbd> fechar</>
        }
      </p>
    </Overlay>
    </>
  );
});

