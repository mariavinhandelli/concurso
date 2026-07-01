'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';

interface Props {
  item: Jurisprudencia;
}

export function JurisModoEstudo({ item }: Props) {
  const hasFlashcard = !!(item.flashcard_frente && item.flashcard_verso);
  const hasQuestao = !!(item.questao_enunciado && item.questao_gabarito !== null);

  if (!hasFlashcard && !hasQuestao) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 24px',
        background: theme.card, border: `0.5px solid ${theme.line}`,
        borderRadius: theme.radius, boxShadow: theme.shadow,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
          <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
        </svg>
        <p style={{ fontSize: 14, color: theme.inkSoft, margin: '0 0 4px', fontWeight: 600 }}>
          Nenhum material de estudo ainda
        </p>
        <p style={{ fontSize: 13, color: theme.inkFaint, margin: 0 }}>
          Adicione um flashcard ou questão C/E ao editar esta jurisprudência.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {hasFlashcard && <FlashcardMode item={item} />}
      {hasQuestao && <QuestaoMode item={item} />}
    </div>
  );
}

function FlashcardMode({ item }: { item: Jurisprudencia }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{
      background: theme.card, border: `0.5px solid ${theme.line}`,
      borderRadius: theme.radius, padding: '16px 18px',
      boxShadow: theme.shadow, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" />
          </svg>
          Flashcard
        </span>
      </div>

      <div
        onClick={() => setFlipped((v) => !v)}
        style={{
          minHeight: 120, borderRadius: theme.radiusSm,
          border: `0.5px solid ${flipped ? theme.teal : theme.line}`,
          background: flipped ? theme.tealBg : theme.bg,
          padding: '20px 22px', cursor: 'pointer',
          transition: 'background .2s, border-color .2s',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, color: flipped ? theme.teal : theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {flipped ? 'Verso (resposta)' : 'Frente (pergunta)'}
        </span>
        <p style={{ fontSize: 14.5, color: theme.ink, margin: 0, lineHeight: 1.65, fontWeight: flipped ? 400 : 500 }}>
          {flipped ? item.flashcard_verso : item.flashcard_frente}
        </p>
      </div>

      <button
        onClick={() => setFlipped((v) => !v)}
        style={{
          alignSelf: 'flex-start', padding: '8px 16px', borderRadius: theme.radiusSm,
          border: `0.5px solid ${theme.teal}`, background: 'transparent',
          color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font,
        }}
      >
        {flipped ? '← Ver pergunta' : 'Revelar resposta →'}
      </button>
    </div>
  );
}

function QuestaoMode({ item }: { item: Jurisprudencia }) {
  const [resposta, setResposta] = useState<boolean | null>(null);
  const gabarito = item.questao_gabarito!;
  const acertou = resposta !== null && resposta === gabarito;

  return (
    <div style={{
      background: theme.card, border: `0.5px solid ${theme.line}`,
      borderRadius: theme.radius, padding: '16px 18px',
      boxShadow: theme.shadow, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
          Questão Certo/Errado
        </span>
      </div>

      <div style={{
        background: theme.bg, borderRadius: theme.radiusSm,
        border: `0.5px solid ${theme.line}`, padding: '16px 18px',
      }}>
        <p style={{ fontSize: 14.5, color: theme.ink, margin: 0, lineHeight: 1.7 }}>
          {item.questao_enunciado}
        </p>
      </div>

      {resposta === null ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setResposta(true)}
            style={{
              flex: 1, padding: '12px', borderRadius: theme.radiusSm,
              border: '0.5px solid #22c55e', background: 'rgba(34,197,94,.1)',
              color: '#16a34a', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font,
            }}
          >
            Certo
          </button>
          <button
            onClick={() => setResposta(false)}
            style={{
              flex: 1, padding: '12px', borderRadius: theme.radiusSm,
              border: `0.5px solid ${theme.danger}`, background: 'rgba(239,68,68,.08)',
              color: theme.danger, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font,
            }}
          >
            Errado
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            borderRadius: theme.radiusSm, padding: '12px 16px',
            background: acertou ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.08)',
            border: `0.5px solid ${acertou ? '#22c55e' : theme.danger}`,
          }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: acertou ? '#16a34a' : theme.danger, margin: '0 0 4px' }}>
              {acertou ? '✓ Correto!' : '✗ Errado!'}
            </p>
            <p style={{ fontSize: 13, color: theme.inkSoft, margin: '0 0 4px' }}>
              Gabarito: <strong style={{ color: theme.ink }}>{gabarito ? 'Certo' : 'Errado'}</strong>
            </p>
            {item.questao_comentario && (
              <p style={{ fontSize: 13.5, color: theme.ink, margin: '8px 0 0', lineHeight: 1.6 }}>
                {item.questao_comentario}
              </p>
            )}
          </div>
          <button
            onClick={() => setResposta(null)}
            style={{
              alignSelf: 'flex-start', padding: '8px 16px', borderRadius: theme.radiusSm,
              border: `0.5px solid ${theme.line}`, background: theme.card,
              color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: theme.font,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
