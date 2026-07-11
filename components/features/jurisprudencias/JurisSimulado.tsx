'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { theme, perfColor, kbd } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';
import type { Jurisprudencia } from '@/services/jurisprudencias.service';
import { useConfirm } from '@/hooks/useConfirm';
import { saveSimuladoSession, type SimuladoResposta } from '@/services/jurisInteracoes.service';
import { useToast } from '@/components/ui/ToastProvider';

interface Props {
  items: Jurisprudencia[];
  onClose: () => void;
}

// Fisher-Yates — ordem aleatória para não viciar o simulado na ordem da lista.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function JurisSimulado({ items, onClose }: Props) {
  const disponiveis = useMemo(
    () => items.filter((i) => i.questao_enunciado && i.questao_gabarito !== null),
    [items],
  );
  // Vazio = tela de configuração (escolher a quantidade) ainda não confirmada.
  const [questoes, setQuestoes] = useState<Jurisprudencia[]>([]);
  const [idx, setIdx] = useState(0);
  const [resposta, setResposta] = useState<boolean | null>(null);
  const [acertos, setAcertos] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const savedRef = useRef(false);

  function iniciar(n: number | null) {
    const embaralhadas = shuffle(disponiveis);
    setQuestoes(n ? embaralhadas.slice(0, n) : embaralhadas);
    setElapsed(0);
    startedAt.current = Date.now();
  }

  // Timer — só roda com o simulado em andamento
  useEffect(() => {
    if (done || questoes.length === 0) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [done, questoes]);

  async function safeClose() {
    if (questoes.length > 0 && !done && (idx > 0 || resposta !== null)) {
      const ok = await confirm({
        title: 'Encerrar o simulado?',
        description: 'O progresso não será salvo.',
        confirmLabel: 'Encerrar',
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }

  // Fecha com Escape; C/E para responder
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { await safeClose(); return; }
      if (questoes.length === 0) return; // tela de configuração: só Esc
      if (resposta !== null) { if (e.key === 'Enter') avancar(); return; }
      if (e.key === 'c' || e.key === 'C') responder(true);
      if (e.key === 'e' || e.key === 'E') responder(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // resposta, idx, done e questoes nas deps para safeClose e avancar() lerem valores frescos.
  }, [resposta, idx, done, questoes, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (disponiveis.length === 0) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ fontSize: 15, color: theme.inkSoft, marginBottom: 20 }}>Nenhuma questão C/E disponível nesta seleção.</p>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </Overlay>
    );
  }

  // ── Tela de configuração: escolher a quantidade já inicia o simulado ──
  if (questoes.length === 0) {
    const opcoes = [10, 20, 50].filter((n) => n < disponiveis.length);
    return (
      <Overlay onClose={onClose} labelledBy="simulado-config-title">
        <div style={{ padding: '8px 0' }}>
          <h2 id="simulado-config-title" style={{ fontSize: 20, fontWeight: 800, color: theme.ink, margin: '0 0 6px' }}>
            Simulado C/E
          </h2>
          <p style={{ fontSize: 13.5, color: theme.inkSoft, margin: '0 0 20px' }}>
            {disponiveis.length} {disponiveis.length === 1 ? 'questão disponível' : 'questões disponíveis'} nesta seleção. Quantas quer responder?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {opcoes.map((n) => (
              <button key={n} onClick={() => iniciar(n)} style={configChip}>
                {n} questões
              </button>
            ))}
            <button onClick={() => iniciar(null)} style={{ ...configChip, background: theme.clay, border: 'none', color: theme.onClay }}>
              Todas ({disponiveis.length})
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: theme.inkFaint, margin: 0 }}>
            As questões vêm em ordem aleatória a cada simulado.
          </p>
        </div>
      </Overlay>
    );
  }

  const q = questoes[idx];
  const gabarito = q.questao_gabarito ?? false;
  const acertou = resposta !== null && resposta === gabarito;
  const pct = Math.round(((idx + (resposta !== null ? 1 : 0)) / questoes.length) * 100);

  function responder(r: boolean) { if (resposta === null) setResposta(r); }

  function avancar() {
    const acertouAtual = resposta === gabarito;
    const novos = [...acertos, acertouAtual];
    setAcertos(novos);
    if (idx < questoes.length - 1) {
      setIdx((i) => i + 1);
      setResposta(null);
    } else {
      setDone(true);
      // Salva resultados apenas na primeira conclusão (não no refazer)
      if (!savedRef.current) {
        const respostas: SimuladoResposta[] = questoes.map((q, i) => {
          const acertouQ = i < acertos.length ? acertos[i] : acertouAtual;
          const gab = q.questao_gabarito ?? false;
          return {
            jurisId:    q.id,
            tribunal:   q.tribunal,
            disciplina: q.disciplina,
            enunciado:  q.questao_enunciado!,
            gabarito:   gab,
            resposta:   acertouQ ? gab : !gab, // inverso do gabarito quando errou
            acertou:    acertouQ,
          };
        });
        saveSimuladoSession({
          total:       questoes.length,
          certas:      novos.filter(Boolean).length,
          elapsedSecs: elapsed,
          respostas,
        })
          .then(() => { savedRef.current = true; })
          .catch(() => toast.error('Não foi possível salvar o resultado.'));
      }
    }
  }

  function reiniciar() { setQuestoes((prev) => shuffle(prev)); setIdx(0); setResposta(null); setAcertos([]); setDone(false); setElapsed(0); startedAt.current = Date.now(); }

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

    // Análise por disciplina
    const discMap = new Map<string, { total: number; erros: number }>();
    questoes.forEach((q, i) => {
      const s = discMap.get(q.disciplina) ?? { total: 0, erros: 0 };
      s.total++;
      if (!acertos[i]) s.erros++;
      discMap.set(q.disciplina, s);
    });
    const disciplinas = [...discMap.entries()]
      .sort((a, b) => b[1].erros / b[1].total - a[1].erros / a[1].total);
    const disciplinaMaisFraga = disciplinas.find(([, s]) => s.erros > 0);

    // Top 5 questões erradas
    const topErros = questoes.filter((_, i) => !acertos[i]).slice(0, 5);

    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: '8px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.ink, margin: '0 0 6px' }}>Resultado do Simulado</h2>
          <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 20px' }}>
            {total} {total === 1 ? 'questão' : 'questões'} · Tempo: {formatTime(elapsed)}
          </p>

          {/* Score grande */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
            <div style={{
              width: 90, height: 90, borderRadius: '50%', flexShrink: 0,
              background: perf.bg, border: `3px solid ${perf.fg}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: perf.fg, lineHeight: 1 }}>{taxaPct}%</span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: theme.ink, margin: '0 0 4px' }}>
                {certas} de {total} {total === 1 ? 'correta' : 'corretas'}
              </p>
              <p style={{ fontSize: 13, color: perf.fg, fontWeight: 600, margin: 0 }}>
                {taxa >= 0.8 ? 'Excelente! Aprovado no padrão elite.' : taxa >= 0.65 ? 'Bom desempenho. Continue revisando.' : 'Abaixo da média. Revise o conteúdo.'}
              </p>
              {disciplinaMaisFraga && (
                <p style={{ fontSize: 12, color: theme.inkFaint, margin: '4px 0 0' }}>
                  Ponto fraco: <strong style={{ color: theme.danger }}>{disciplinaMaisFraga[0]}</strong>
                  {' '}({disciplinaMaisFraga[1].erros}/{disciplinaMaisFraga[1].total} erros)
                </p>
              )}
            </div>
          </div>

          {/* Análise por disciplina (só se tiver mais de 1) */}
          {disciplinas.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px' }}>
                Desempenho por disciplina
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {disciplinas.map(([disc, s]) => {
                  const pct = Math.round((s.erros / s.total) * 100);
                  const taxaAcerto = Math.round(((s.total - s.erros) / s.total) * 100);
                  const cor = taxaAcerto >= 70 ? theme.okDeep : taxaAcerto >= 50 ? theme.warnDeep : theme.danger;
                  const bg = taxaAcerto >= 70 ? theme.okTint : taxaAcerto >= 50 ? theme.warnTint : theme.dangerTint;
                  return (
                    <div key={disc} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: theme.ink, minWidth: 120, fontWeight: 500 }}>{disc}</span>
                      <div style={{ flex: 1, height: 5, background: theme.line, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${taxaAcerto}%`, background: cor, borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cor, background: bg, borderRadius: 5, padding: '1px 7px', whiteSpace: 'nowrap', minWidth: 48, textAlign: 'center' }}>
                        {taxaAcerto}%
                      </span>
                      {pct > 0 && (
                        <span style={{ fontSize: 11, color: theme.danger, whiteSpace: 'nowrap' }}>
                          {s.erros} erro{s.erros > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 5 questões mais erradas */}
          {topErros.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 10px' }}>
                {topErros.length === 1 ? 'Jurisprudência errada' : `${topErros.length} jurisprudências que você errou`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topErros.map((q) => (
                  <div key={q.id} style={{
                    padding: '8px 12px', borderRadius: theme.radiusXs,
                    background: theme.dangerTint, border: `0.5px solid rgba(239,68,68,.2)`,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: theme.danger, flexShrink: 0, marginTop: 1 }}>✗</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: theme.ink, margin: '0 0 3px', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {q.questao_enunciado}
                      </p>
                      <span style={{ fontSize: 10.5, color: theme.inkFaint }}>
                        {q.tribunal} · {q.disciplina} · Gabarito: <strong>{q.questao_gabarito ? 'Certo' : 'Errado'}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detalhe por questão (expansível) */}
          <details style={{ marginBottom: 20 }}>
            <summary style={{ fontSize: 12, fontWeight: 600, color: theme.inkSoft, cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
              Ver todas as questões ({questoes.length})
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {questoes.map((q, i) => (
                <div key={q.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 12px', borderRadius: theme.radiusXs,
                  background: acertos[i] ? theme.okTint : theme.dangerTint,
                  border: `0.5px solid ${acertos[i] ? '#22c55e40' : '#ef444440'}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: acertos[i] ? theme.okDeep : theme.danger, flexShrink: 0, marginTop: 1 }}>
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
          </details>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button style={{ background: theme.clay, color: theme.onClay }} onClick={reiniciar}>Refazer simulado</Button>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <>
    {dialog}
    <Overlay onClose={safeClose} labelledBy="simulado-modal-title">
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span id="simulado-modal-title" style={{ fontSize: 13, fontWeight: 700, color: theme.clay, display: 'flex', alignItems: 'center', gap: 6 }}>
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
        <button onClick={safeClose} aria-label="Fechar" style={{ border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 18, cursor: 'pointer', lineHeight: 1, paddingLeft: 8 }}>✕</button>
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
              aria-keyshortcuts="c"
              style={{ flex: 1, padding: '14px', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.ok}`, background: theme.okTint, color: theme.okDeep, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <span aria-hidden="true">✓</span> Certo
            </button>
            <button
              onClick={() => responder(false)}
              aria-keyshortcuts="e"
              style={{ flex: 1, padding: '14px', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.danger}`, background: theme.dangerTint, color: theme.danger, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <span aria-hidden="true">✗</span> Errado
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
            background: acertou ? theme.okTint : theme.dangerTint,
            border: `1.5px solid ${acertou ? theme.ok : theme.danger}`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: acertou ? theme.okDeep : theme.danger, margin: '0 0 6px' }}>
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
          <Button style={{ background: theme.clay, color: theme.onClay }} onClick={avancar} aria-keyshortcuts="Enter">
            {idx < questoes.length - 1 ? 'Próxima questão →' : 'Ver resultado'}
          </Button>
          <p style={{ fontSize: 11.5, color: theme.inkFaint, textAlign: 'center', margin: 0 }}>
            Pressione <kbd style={kbd}>Enter</kbd> para avançar
          </p>
        </div>
      )}
    </Overlay>
    </>
  );
}


const configChip: React.CSSProperties = {
  padding: '12px 20px', borderRadius: theme.radiusSm,
  border: `0.5px solid ${theme.clay}`, background: theme.clayBg,
  color: theme.clayDeep, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: theme.font,
};
