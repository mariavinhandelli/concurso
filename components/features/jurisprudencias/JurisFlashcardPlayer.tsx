'use client';

import { useEffect, useState } from 'react';
import { theme, zIndex } from '@/lib/theme';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';

interface Props {
  items: Jurisprudencia[];
  onClose: () => void;
}

export function JurisFlashcardPlayer({ items, onClose }: Props) {
  const cards = items.filter((i) => i.flashcard_frente && i.flashcard_verso);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  // Fecha com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((v) => !v); }
      if (e.key === 'ArrowRight' && flipped) next();
      if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (cards.length === 0) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: 15, color: theme.inkSoft, marginBottom: 20 }}>Nenhum flashcard disponível nesta seleção.</p>
          <button onClick={onClose} style={btnOutline}>Fechar</button>
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
  function restart() { setIdx(0); setFlipped(false); setDone(false); }

  if (done) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.ink, margin: '0 0 8px' }}>Sessão concluída!</h2>
          <p style={{ fontSize: 14, color: theme.inkSoft, margin: '0 0 28px' }}>
            Você revisou <strong style={{ color: theme.ink }}>{cards.length}</strong> {cards.length === 1 ? 'flashcard' : 'flashcards'}.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={restart} style={btnPrimary}>Recomeçar</button>
            <button onClick={onClose} style={btnOutline}>Fechar</button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.teal, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" />
          </svg>
          Flashcards
        </span>
        <span style={{ fontSize: 12.5, color: theme.inkFaint }}>
          {idx + 1} / {cards.length}
        </span>
        <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 4, background: theme.line, borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: theme.teal, borderRadius: 4, transition: 'width .3s ease' }} />
      </div>

      {/* Contexto */}
      <div style={{ fontSize: 11.5, color: theme.inkFaint, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: theme.tealDeep, background: theme.tealBg, borderRadius: 5, padding: '1px 7px' }}>{card.tribunal}</span>
        <span>{card.disciplina}{card.materia ? ` · ${card.materia}` : ''}</span>
      </div>

      {/* Card principal — clicável */}
      <div
        onClick={() => setFlipped((v) => !v)}
        style={{
          minHeight: 180, borderRadius: theme.radiusSm,
          border: `1.5px solid ${flipped ? theme.teal : theme.line}`,
          background: flipped ? theme.tealBg : theme.bg,
          padding: '22px 24px', cursor: 'pointer',
          transition: 'background .2s, border-color .2s',
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, color: flipped ? theme.teal : theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.6 }}>
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={prev}
          disabled={idx === 0}
          style={{ ...btnOutline, opacity: idx === 0 ? 0.35 : 1 }}
        >
          ← Anterior
        </button>
        <span style={{ flex: 1 }} />
        {!flipped ? (
          <button onClick={() => setFlipped(true)} style={btnPrimary}>
            Revelar resposta
          </button>
        ) : (
          <button onClick={next} style={btnPrimary}>
            {idx < cards.length - 1 ? 'Próximo →' : 'Concluir sessão'}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: theme.inkFaint, textAlign: 'center', margin: '14px 0 0' }}>
        Atalhos: <kbd style={kbd}>Espaço</kbd> revelar · <kbd style={kbd}>→</kbd> próximo · <kbd style={kbd}>←</kbd> anterior · <kbd style={kbd}>Esc</kbd> fechar
      </p>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: zIndex.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.card,
          border: `0.5px solid ${theme.line}`,
          borderRadius: theme.radius,
          boxShadow: theme.shadowModal,
          width: '100%', maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px 28px',
          fontFamily: theme.font,
          zIndex: zIndex.modal,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 22px', borderRadius: theme.radiusSm, border: 'none',
  background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: theme.font,
};
const btnOutline: React.CSSProperties = {
  padding: '10px 20px', borderRadius: theme.radiusSm,
  border: `0.5px solid ${theme.line}`, background: theme.card,
  color: theme.inkSoft, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: theme.font,
};
const kbd: React.CSSProperties = {
  background: theme.muted, border: `0.5px solid ${theme.line}`,
  borderRadius: 4, padding: '0px 5px', fontSize: 10.5, fontFamily: 'monospace',
};
