'use client';

import { useState } from 'react';
import { CircleHelp, Layers, Check, X } from 'lucide-react';
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
        <Layers size={36} color={theme.inkFaint} strokeWidth={1.7} style={{ marginBottom: 12 }} />
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
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={14} strokeWidth={1.7} />
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
        <span style={{ fontSize: 11, fontWeight: 700, color: flipped ? theme.teal : theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {flipped ? 'Verso (resposta)' : 'Frente (pergunta)'}
        </span>
        <p style={{ fontSize: 15, color: theme.ink, margin: 0, lineHeight: 1.65, fontWeight: flipped ? 400 : 500 }}>
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
  const gabarito = item.questao_gabarito ?? false;
  const acertou = resposta !== null && resposta === gabarito;

  return (
    <div style={{
      background: theme.card, border: `0.5px solid ${theme.line}`,
      borderRadius: theme.radius, padding: '16px 18px',
      boxShadow: theme.shadow, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CircleHelp size={14} strokeWidth={1.7} />
          Questão Certo/Errado
        </span>
      </div>

      <div style={{
        background: theme.bg, borderRadius: theme.radiusSm,
        border: `0.5px solid ${theme.line}`, padding: '16px 18px',
      }}>
        <p style={{ fontSize: 15, color: theme.ink, margin: 0, lineHeight: 1.7 }}>
          {item.questao_enunciado}
        </p>
      </div>

      {resposta === null ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setResposta(true)}
            style={{
              flex: 1, padding: '12px', borderRadius: theme.radiusSm,
              border: `0.5px solid ${theme.ok}`, background: theme.okTint,
              color: theme.okDeep, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font,
            }}
          >
            Certo
          </button>
          <button
            onClick={() => setResposta(false)}
            style={{
              flex: 1, padding: '12px', borderRadius: theme.radiusSm,
              border: `0.5px solid ${theme.danger}`, background: theme.dangerTint,
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
            background: acertou ? theme.okTint : theme.dangerTint,
            border: `0.5px solid ${acertou ? theme.ok : theme.danger}`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: acertou ? theme.okDeep : theme.danger, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {acertou ? <Check size={15} strokeWidth={2.5} /> : <X size={15} strokeWidth={2.5} />}
              {acertou ? 'Correto!' : 'Errado!'}
            </p>
            <p style={{ fontSize: 13, color: theme.inkSoft, margin: '0 0 4px' }}>
              Gabarito: <strong style={{ color: theme.ink }}>{gabarito ? 'Certo' : 'Errado'}</strong>
            </p>
            {item.questao_comentario && (
              <p style={{ fontSize: 14, color: theme.ink, margin: '8px 0 0', lineHeight: 1.6 }}>
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
