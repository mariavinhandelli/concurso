'use client';

import { useEffect, useRef, useState } from 'react';
import { theme, zIndex, perfColor } from '@/lib/theme';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';

interface Props {
  items: Jurisprudencia[];
  onClose: () => void;
}

export function JurisSimulado({ items, onClose }: Props) {
  const questoes = items.filter((i) => i.questao_enunciado && i.questao_gabarito !== null);
  const [idx, setIdx] = useState(0);
  const [resposta, setResposta] = useState<boolean | null>(null);
  const [acertos, setAcertos] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());

  // Timer
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [done]);

  // Fecha com Escape; C/E para responder
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (resposta !== null) { if (e.key === 'Enter') avancar(); return; }
      if (e.key === 'c' || e.key === 'C') responder(true);
      if (e.key === 'e' || e.key === 'E') responder(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (questoes.length === 0) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: 15, color: theme.inkSoft, marginBottom: 20 }}>Nenhuma questão C/E disponível nesta seleção.</p>
          <button onClick={onClose} style={btnOutline}>Fechar</button>
        </div>
      </Overlay>
    );
  }

  const q = questoes[idx];
  const gabarito = q.questao_gabarito!;
  const acertou = resposta !== null && resposta === gabarito;
  const pct = Math.round(((idx + (resposta !== null ? 1 : 0)) / questoes.length) * 100);

  function responder(r: boolean) { if (resposta === null) setResposta(r); }

  function avancar() {
    const novos = [...acertos, resposta === gabarito];
    setAcertos(novos);
    if (idx < questoes.length - 1) { setIdx((i) => i + 1); setResposta(null); }
    else setDone(true);
  }

  function reiniciar() { setIdx(0); setResposta(null); setAcertos([]); setDone(false); setElapsed(0); startedAt.current = Date.now(); }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  // Tela de resultado
  if (done) {
    const total = questoes.length;
    const certas = acertos.filter(Boolean).length;
    const taxa = certas / total;
    const perf = perfColor(taxa);
    const taxaPct = Math.round(taxa * 100);

    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: '8px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.ink, margin: '0 0 6px' }}>Resultado do Simulado</h2>
          <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 28px' }}>
            {total} {total === 1 ? 'questão' : 'questões'} · Tempo: {formatTime(elapsed)}
          </p>

          {/* Score grande */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: perf.bg,
              border: `3px solid ${perf.fg}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: perf.fg, lineHeight: 1 }}>{taxaPct}%</span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 4px' }}>
                {certas} de {total} {total === 1 ? 'correta' : 'corretas'}
              </p>
              <p style={{ fontSize: 13, color: perf.fg, fontWeight: 600, margin: 0 }}>
                {taxa >= 0.8 ? 'Excelente! Aprovado no padrão elite.' : taxa >= 0.65 ? 'Bom desempenho. Continue revisando.' : 'Abaixo da média. Revise o conteúdo.'}
              </p>
            </div>
          </div>

          {/* Detalhe por questão */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, maxHeight: 260, overflowY: 'auto' }}>
            {questoes.map((q, i) => (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 12px', borderRadius: theme.radiusXs,
                background: acertos[i] ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.06)',
                border: `0.5px solid ${acertos[i] ? '#22c55e40' : '#ef444440'}`,
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: acertos[i] ? '#16a34a' : theme.danger, flexShrink: 0, marginTop: 1 }}>
                  {acertos[i] ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, color: theme.ink, margin: '0 0 2px', lineHeight: 1.45,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {q.questao_enunciado}
                  </p>
                  <span style={{ fontSize: 11, color: theme.inkFaint }}>
                    Gabarito: <strong style={{ color: theme.ink }}>{q.questao_gabarito ? 'Certo' : 'Errado'}</strong>
                    {' · '}{q.tribunal} · {q.disciplina}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reiniciar} style={btnPrimary}>Refazer simulado</button>
            <button onClick={onClose} style={btnOutline}>Fechar</button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.clay, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
          Simulado C/E
        </span>
        <span style={{ fontSize: 12.5, color: theme.inkFaint }}>Questão {idx + 1} de {questoes.length}</span>
        {/* Timer */}
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: elapsed >= 3600 ? theme.danger : theme.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
          ⏱ {formatTime(elapsed)}
        </span>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 18, cursor: 'pointer', lineHeight: 1, paddingLeft: 8 }}>✕</button>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 4, background: theme.line, borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: theme.clay, borderRadius: 4, transition: 'width .3s ease' }} />
      </div>

      {/* Contexto */}
      <div style={{ fontSize: 11.5, color: theme.inkFaint, marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: theme.tealDeep, background: theme.tealBg, borderRadius: 5, padding: '1px 7px' }}>{q.tribunal}</span>
        <span>{q.disciplina}{q.materia ? ` · ${q.materia}` : ''}</span>
      </div>

      {/* Enunciado */}
      <div style={{
        background: theme.bg, border: `0.5px solid ${theme.line}`,
        borderRadius: theme.radiusSm, padding: '18px 20px', marginBottom: 20,
      }}>
        <p style={{ fontSize: 15, color: theme.ink, margin: 0, lineHeight: 1.75 }}>
          {q.questao_enunciado}
        </p>
      </div>

      {/* Botões ou resultado */}
      {resposta === null ? (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <button
              onClick={() => responder(true)}
              style={{ flex: 1, padding: '14px', borderRadius: theme.radiusSm, border: '1.5px solid #22c55e', background: 'rgba(34,197,94,.08)', color: '#16a34a', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font }}
            >
              Certo
            </button>
            <button
              onClick={() => responder(false)}
              style={{ flex: 1, padding: '14px', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.danger}`, background: 'rgba(239,68,68,.07)', color: theme.danger, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font }}
            >
              Errado
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: theme.inkFaint, textAlign: 'center', margin: 0 }}>
            Atalhos: <kbd style={kbd}>C</kbd> Certo · <kbd style={kbd}>E</kbd> Errado · <kbd style={kbd}>Esc</kbd> fechar
          </p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            borderRadius: theme.radiusSm, padding: '14px 18px',
            background: acertou ? 'rgba(34,197,94,.09)' : 'rgba(239,68,68,.07)',
            border: `1.5px solid ${acertou ? '#22c55e' : theme.danger}`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: acertou ? '#16a34a' : theme.danger, margin: '0 0 6px' }}>
              {acertou ? '✓ Correto!' : '✗ Errado!'}
            </p>
            <p style={{ fontSize: 13, color: theme.inkSoft, margin: '0 0 8px' }}>
              Gabarito: <strong style={{ color: theme.ink }}>{gabarito ? 'Certo' : 'Errado'}</strong>
            </p>
            {q.questao_comentario && (
              <p style={{ fontSize: 13.5, color: theme.ink, margin: 0, lineHeight: 1.65 }}>
                {q.questao_comentario}
              </p>
            )}
          </div>
          <button onClick={avancar} style={btnPrimary}>
            {idx < questoes.length - 1 ? 'Próxima questão →' : 'Ver resultado'}
          </button>
          <p style={{ fontSize: 11.5, color: theme.inkFaint, textAlign: 'center', margin: 0 }}>
            Pressione <kbd style={kbd}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: zIndex.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius,
          boxShadow: theme.shadowModal, width: '100%', maxWidth: 680,
          maxHeight: '90vh', overflowY: 'auto',
          padding: '24px 28px', fontFamily: theme.font, zIndex: zIndex.modal,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '11px 24px', borderRadius: theme.radiusSm, border: 'none',
  background: theme.clay, color: '#fff', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: theme.font,
};
const btnOutline: React.CSSProperties = {
  padding: '11px 20px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
  background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: theme.font,
};
const kbd: React.CSSProperties = {
  background: theme.muted, border: `0.5px solid ${theme.line}`, borderRadius: 4,
  padding: '0px 5px', fontSize: 10.5, fontFamily: 'monospace',
};
