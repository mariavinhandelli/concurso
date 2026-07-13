// app/(app)/vademecum/simulado/page.tsx
// Simulado C/E combinado: lê ?leis=slug1,slug2 (montado na biblioteca),
// junta as questões de todas as leis selecionadas num único pool embaralhado.
// Sequencial: Certo/Errado → revela gabarito + comentário → próxima. Ao final,
// salva a sessão (lei_simulado_sessions, usando os slugs ordenados e unidos
// por vírgula como chave — mesma tabela do simulado por lei, sem migração
// nova) e mostra a evolução das últimas tentativas com essa MESMA combinação.
'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LEIS_CATALOG, artigoNumeroFromKey, type LeiMeta } from '@/services/leis.service';
import {
  getQuestoesLei, embaralhar, saveLeiSimuladoSession, listLeiSimuladoSessions,
  type LeiQuestao, type LeiSimuladoResposta, type LeiSimuladoSession,
} from '@/services/leiQuestoes.service';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

interface QuestaoComLei extends LeiQuestao {
  leiSlug: string;
  leiNomeCurto: string;
}

interface Resposta {
  questao: QuestaoComLei;
  resposta: boolean;
  acertou: boolean;
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function SimuladoContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { isMobile } = useUI();

  const slugsPedidos = useMemo(
    () => (params.get('leis') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    [params],
  );
  const leis = useMemo<LeiMeta[]>(
    () => slugsPedidos.map((slug) => LEIS_CATALOG.find((l) => l.slug === slug)).filter((l): l is LeiMeta => !!l),
    [slugsPedidos],
  );
  const slugsInvalidos = useMemo(
    () => slugsPedidos.filter((slug) => !leis.some((l) => l.slug === slug)),
    [slugsPedidos, leis],
  );

  // chave estável independente da ordem em que as leis foram marcadas —
  // assim duas sessões com as mesmas leis sempre caem no mesmo histórico.
  const chave = useMemo(() => [...leis.map((l) => l.slug)].sort().join(','), [leis]);
  const titulo = leis.length === 1 ? leis[0].nomeCurto : `${leis.length} leis`;

  const [fila, setFila] = useState<QuestaoComLei[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [resposta, setResposta] = useState<boolean | null>(null);
  const [historico, setHistorico] = useState<Resposta[]>([]);
  const [sessoesAnteriores, setSessoesAnteriores] = useState<LeiSimuladoSession[]>([]);
  const startedAtRef = useRef<number>(0);
  const salvoRef = useRef(false);

  useEffect(() => { startedAtRef.current = Date.now(); }, []);

  useEffect(() => {
    if (leis.length === 0) { setFila([]); return; }
    let cancelled = false;
    Promise.all(leis.map((l) => getQuestoesLei(l.slug).then((qs) =>
      qs.map((q): QuestaoComLei => ({ ...q, leiSlug: l.slug, leiNomeCurto: l.nomeCurto })),
    )))
      .then((porLei) => { if (!cancelled) setFila(embaralhar(porLei.flat())); })
      .catch(() => { if (!cancelled) setFila([]); });
    if (chave) {
      listLeiSimuladoSessions(chave)
        .then((s) => { if (!cancelled) setSessoesAnteriores(s); })
        .catch(() => { /* histórico é acessório — segue sem ele */ });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const atual = fila?.[idx] ?? null;
  const acertos = useMemo(() => historico.filter((h) => h.acertou).length, [historico]);
  const acabou = fila !== null && fila.length > 0 && idx >= fila.length;

  // Salva a sessão uma única vez ao concluir, e recarrega o histórico.
  // `chave` vazia (nenhum slug válido) não deve virar sessão no histórico.
  useEffect(() => {
    if (!acabou || salvoRef.current || !fila || !chave) return;
    salvoRef.current = true;
    const respostas: LeiSimuladoResposta[] = historico.map((h) => ({
      artigoKey: h.questao.artigoKey, gabarito: h.questao.gabarito, resposta: h.resposta, acertou: h.acertou,
    }));
    const elapsedSecs = Math.round((Date.now() - startedAtRef.current) / 1000);
    saveLeiSimuladoSession({ leiSlug: chave, total: fila.length, certas: acertos, elapsedSecs, respostas })
      .then(() => listLeiSimuladoSessions(chave))
      .then(setSessoesAnteriores)
      .catch(() => { /* não bloqueia a visualização do resultado */ });
  }, [acabou, fila, historico, acertos, chave]);

  function responder(valor: boolean) {
    if (!atual || resposta !== null) return;
    setResposta(valor);
    setHistorico((prev) => [...prev, { questao: atual, resposta: valor, acertou: valor === atual.gabarito }]);
  }

  function proxima() {
    setResposta(null);
    setIdx((i) => i + 1);
  }

  function reiniciar() {
    if (!fila) return;
    setFila(embaralhar(fila));
    setIdx(0);
    setResposta(null);
    setHistorico([]);
    startedAtRef.current = Date.now();
    salvoRef.current = false;
  }

  if (leis.length === 0) {
    return (
      <div style={{ ...s.wrap, padding: isMobile ? '24px 16px' : '40px' }}>
        <div style={s.doneBox}>
          <p style={s.doneTitle}>Nenhuma lei selecionada.</p>
          <p style={s.doneSub}>
            {slugsInvalidos.length > 0
              ? `A seleção recebida (${slugsInvalidos.join(', ')}) não corresponde a nenhuma lei do catálogo.`
              : 'Volte à biblioteca e marque uma ou mais leis para montar o simulado.'}
          </p>
          <Button onClick={() => router.push('/vademecum')}>Voltar ao Vade Mecum</Button>
        </div>
      </div>
    );
  }

  if (fila === null) {
    return <div style={{ ...s.wrap, padding: 40 }}><p style={{ color: theme.inkFaint }}>Preparando o simulado…</p></div>;
  }

  if (fila.length === 0) {
    return (
      <div style={{ ...s.wrap, padding: isMobile ? '24px 16px' : '40px' }}>
        <div style={s.doneBox}>
          <p style={s.doneTitle}>Nenhuma questão disponível para essa seleção.</p>
          <Button onClick={() => router.push('/vademecum')}>Voltar ao Vade Mecum</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.wrap, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={s.topo}>
        <button onClick={() => router.push('/vademecum')} style={s.voltar}>← {titulo}</button>
        {!acabou && <span style={s.progresso}>{idx + 1} de {fila.length} · {acertos} certas</span>}
      </div>
      {leis.length > 1 && (
        <p style={s.leisChips}>{leis.map((l) => l.nomeCurto).join(' · ')}</p>
      )}
      {slugsInvalidos.length > 0 && (
        <p style={s.avisoInvalidos}>
          {slugsInvalidos.length === 1 ? 'Uma lei selecionada' : `${slugsInvalidos.length} leis selecionadas`} não {slugsInvalidos.length === 1 ? 'foi encontrada' : 'foram encontradas'} e {slugsInvalidos.length === 1 ? 'foi ignorada' : 'foram ignoradas'} ({slugsInvalidos.join(', ')}).
        </p>
      )}

      {acabou ? (
        <div style={s.doneBox}>
          <div style={{ fontSize: 40 }}>{acertos / fila.length >= 0.7 ? '🎉' : '📖'}</div>
          <h1 style={s.doneTitle}>{acertos} de {fila.length} — {Math.round((acertos / fila.length) * 100)}%</h1>
          <p style={s.doneSub}>
            {acertos / fila.length >= 0.7
              ? 'Bom domínio da lei seca. Continue revisando os pontos que derrubaram.'
              : 'Ainda dá pra evoluir bastante — volte ao texto e grife o que errou aqui.'}
          </p>
          <div style={s.doneActions}>
            <Button variant="outline" onClick={reiniciar}>Refazer simulado</Button>
            <Button onClick={() => router.push('/vademecum')}>Voltar ao Vade Mecum</Button>
          </div>

          {sessoesAnteriores.length > 1 && (
            <div style={s.evolucao}>
              <p style={s.revisaoTitulo}>Suas últimas tentativas com essa combinação</p>
              <div style={s.evolucaoRow}>
                {sessoesAnteriores.slice(0, 8).reverse().map((sess) => {
                  const pct = sess.total > 0 ? Math.round((sess.certas / sess.total) * 100) : 0;
                  return (
                    <div key={sess.id} style={s.evolucaoItem} title={fmtData(sess.created_at)}>
                      <div style={{ ...s.evolucaoBar, height: `${Math.max(6, pct)}%`, background: pct >= 70 ? theme.ok : pct >= 50 ? theme.warn : theme.danger }} />
                      <span style={s.evolucaoPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {historico.some((h) => !h.acertou) && (
            <div style={s.revisaoErros}>
              <p style={s.revisaoTitulo}>O que você errou:</p>
              {historico.filter((h) => !h.acertou).map((h, i) => (
                <div key={i} style={s.erroItem}>
                  <span style={s.erroArt}>{leis.length > 1 ? `${h.questao.leiNomeCurto} · ` : ''}Art. {artigoNumeroFromKey(h.questao.artigoKey)}</span>
                  <span style={s.erroTexto}>{h.questao.enunciado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : atual && (
        <div style={s.card}>
          <span style={s.artChip}>
            {leis.length > 1 ? `${atual.leiNomeCurto} · ` : ''}Art. {artigoNumeroFromKey(atual.artigoKey)}
          </span>
          <p style={s.enunciado}>{atual.enunciado}</p>

          {resposta === null ? (
            <div style={s.btns}>
              <button onClick={() => responder(true)} style={s.btnC}>Certo</button>
              <button onClick={() => responder(false)} style={s.btnE}>Errado</button>
            </div>
          ) : (
            <>
              <div style={{ ...s.resultado, ...(resposta === atual.gabarito ? s.resultadoOk : s.resultadoErro) }}>
                {resposta === atual.gabarito ? '✓ Você acertou — ' : '✗ Você errou — '}
                gabarito: <b>{atual.gabarito ? 'Certo' : 'Errado'}</b>
              </div>
              <p style={s.comentario}>{atual.comentario}</p>
              <Button onClick={proxima}>
                {idx + 1 === fila.length ? 'Ver resultado →' : 'Próxima questão →'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SimuladoPage() {
  return (
    <Suspense fallback={<div style={{ ...s.wrap, padding: 40 }}><p style={{ color: theme.inkFaint }}>Carregando…</p></div>}>
      <SimuladoContent />
    </Suspense>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { maxWidth: 720, margin: '0 auto', fontFamily: theme.font },
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  voltar: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  progresso: { fontSize: 13, fontWeight: 600, color: theme.inkSoft },
  leisChips: { fontSize: 12, color: theme.inkFaint, margin: '0 0 14px' },
  avisoInvalidos: { fontSize: 12, color: theme.warn, background: theme.muted, borderRadius: theme.radiusSm, padding: '7px 10px', margin: '0 0 14px' },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '20px 22px' },
  artChip: { fontSize: 12, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusPill, padding: '3px 10px' },
  enunciado: { fontSize: 15, color: theme.ink, lineHeight: 1.65, margin: '14px 0 18px' },
  btns: { display: 'flex', gap: 10 },
  btnC: { flex: 1, padding: '13px 0', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.ok}`, background: 'transparent', color: theme.ok, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnE: { flex: 1, padding: '13px 0', borderRadius: theme.radiusSm, border: `1.5px solid ${theme.danger}`, background: 'transparent', color: theme.danger, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  resultado: { fontSize: 14, fontWeight: 600, borderRadius: theme.radiusSm, padding: '10px 14px', marginBottom: 10 },
  resultadoOk: { background: theme.okBg, color: theme.okDeep },
  resultadoErro: { background: theme.dangerBg, color: theme.danger },
  comentario: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 16px' },
  proxima: { padding: '11px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  doneBox: { textAlign: 'center', padding: '50px 20px' },
  doneTitle: { fontSize: 22, fontWeight: 700, color: theme.ink, margin: '10px 0 6px' },
  doneSub: { fontSize: 14, color: theme.inkSoft, margin: '0 0 20px', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 },
  doneActions: { display: 'flex', gap: 10, justifyContent: 'center' },
  doneBtn: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  doneBtnGhost: { padding: '11px 22px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  evolucao: { textAlign: 'left', marginTop: 28, paddingTop: 20, borderTop: `0.5px solid ${theme.line}` },
  evolucaoRow: { display: 'flex', alignItems: 'flex-end', gap: 10, height: 70, marginTop: 6 },
  evolucaoItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, height: '100%', justifyContent: 'flex-end' },
  evolucaoBar: { width: '100%', borderRadius: '4px 4px 0 0', transition: 'height .3s' },
  evolucaoPct: { fontSize: 11, color: theme.inkFaint, fontWeight: 600 },
  revisaoErros: { textAlign: 'left', marginTop: 28, paddingTop: 20, borderTop: `0.5px solid ${theme.line}` },
  revisaoTitulo: { fontSize: 13, fontWeight: 700, color: theme.inkSoft, margin: '0 0 10px' },
  erroItem: { display: 'flex', gap: 10, padding: '8px 0', borderBottom: `0.5px solid ${theme.line}` },
  erroArt: { fontSize: 12, fontWeight: 700, color: theme.danger, flexShrink: 0, minWidth: 60 },
  erroTexto: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.5 },
};
