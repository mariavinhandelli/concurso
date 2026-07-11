// components/features/vademecum/QuestoesBanco.tsx
// Aba "Questões" do leitor de lei: banco navegável de questões C/E ordenado
// por artigo (com reordenação por incidência/aleatória) e filtros de status
// (não respondidas / que errei). Sem filtro de "pegadinhas" por design — ele
// avisaria o usuário antes de ler o enunciado, o que anula o efeito da
// pegadinha; o rótulo "⚠ pegadinha" só aparece DEPOIS de responder. Respostas
// persistem em lei_questao_respostas (upsert por questão) — diferente do
// simulado, que grava sessões fechadas.
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Lei } from '@/services/leis.service';
import { artigoNumeroFromKey } from '@/services/leis.service';
import {
  upsertRespostaQuestao, listRespostasByLei, clearRespostasByLei, embaralhar,
  type LeiQuestao, type LeiQuestaoResposta,
} from '@/services/leiQuestoes.service';
import { useToast } from '@/components/ui/ToastProvider';
import { theme } from '@/lib/theme';

type Ordem = 'artigo' | 'incidencia' | 'aleatoria';
type Filtro = 'todas' | 'nao-respondidas' | 'erradas';

const INCIDENCIA_PESO: Record<string, number> = { muito_alta: 0, alta: 1, media: 2, baixa: 3 };

interface Props {
  lei: Lei;
  questoes: LeiQuestao[];
  onNavigate: (numero: string) => void;
}

export function QuestoesBanco({ lei, questoes, onNavigate }: Props) {
  const toast = useToast();
  const [respostas, setRespostas] = useState<Map<string, LeiQuestaoResposta>>(new Map());
  const [carregado, setCarregado] = useState(false);
  const [ordem, setOrdem] = useState<Ordem>('artigo');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  // ids na ordem sorteada — refeita a cada clique em "Aleatória"
  const [sorteio, setSorteio] = useState<string[]>([]);
  // questões "reabertas" para nova tentativa (resposta antiga segue no banco
  // até a nova ser gravada)
  const [reabertas, setReabertas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    listRespostasByLei(lei.slug)
      .then((m) => { if (!cancelled) { setRespostas(m); setCarregado(true); } })
      .catch(() => { if (!cancelled) setCarregado(true); });
    return () => { cancelled = true; };
  }, [lei.slug]);

  const ordemArtigo = useMemo(() => {
    const m = new Map<string, number>();
    lei.artigos.forEach((a) => m.set(a.key, a.ordem));
    return m;
  }, [lei]);

  const incidenciaDe = useMemo(() => {
    const m = new Map<string, string>();
    lei.artigos.forEach((a) => m.set(a.key, a.incidencia));
    return m;
  }, [lei]);

  function sortear() {
    setSorteio(embaralhar(questoes.map((q) => q.id)));
    setOrdem('aleatoria');
  }

  const lista = useMemo(() => {
    let qs = [...questoes];
    if (filtro === 'nao-respondidas') qs = qs.filter((q) => !respostas.has(q.id) || reabertas.has(q.id));
    if (filtro === 'erradas') qs = qs.filter((q) => respostas.get(q.id)?.acertou === false);

    if (ordem === 'aleatoria' && sorteio.length > 0) {
      const pos = new Map(sorteio.map((id, i) => [id, i]));
      qs.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0));
    } else if (ordem === 'incidencia') {
      qs.sort((a, b) =>
        (INCIDENCIA_PESO[incidenciaDe.get(a.artigoKey) ?? 'media'] - INCIDENCIA_PESO[incidenciaDe.get(b.artigoKey) ?? 'media'])
        || ((ordemArtigo.get(a.artigoKey) ?? 0) - (ordemArtigo.get(b.artigoKey) ?? 0)));
    } else {
      qs.sort((a, b) => (ordemArtigo.get(a.artigoKey) ?? 0) - (ordemArtigo.get(b.artigoKey) ?? 0));
    }
    return qs;
  }, [questoes, filtro, respostas, reabertas, ordem, sorteio, incidenciaDe, ordemArtigo]);

  const respondidas = questoes.filter((q) => respostas.has(q.id)).length;
  // "não respondidas" no chip precisa contar igual ao filtro da lista: uma
  // questão reaberta volta a contar como não respondida até a nova resposta.
  const naoRespondidasCount = questoes.filter((q) => !respostas.has(q.id) || reabertas.has(q.id)).length;
  const acertos = questoes.filter((q) => respostas.get(q.id)?.acertou).length;
  const erradasCount = questoes.filter((q) => respostas.get(q.id)?.acertou === false).length;
  const pctAcerto = respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0;

  function responder(q: LeiQuestao, resposta: boolean) {
    const acertou = resposta === q.gabarito;
    setRespostas((prev) => {
      const next = new Map(prev);
      next.set(q.id, { questaoId: q.id, resposta, acertou });
      return next;
    });
    setReabertas((prev) => { const next = new Set(prev); next.delete(q.id); return next; });
    upsertRespostaQuestao({ leiSlug: lei.slug, questaoId: q.id, resposta, acertou })
      .catch(() => toast.error('Não consegui salvar a resposta — ela vale só nesta sessão.'));
  }

  function reabrir(id: string) {
    setReabertas((prev) => new Set(prev).add(id));
  }

  async function zerar() {
    if (!window.confirm(`Zerar seu progresso nas ${respondidas} questões respondidas de ${lei.nomeCurto}?`)) return;
    try {
      await clearRespostasByLei(lei.slug);
      setRespostas(new Map());
      setReabertas(new Set());
      toast.info('Progresso zerado.');
    } catch {
      toast.error('Não consegui zerar o progresso.');
    }
  }

  if (questoes.length === 0) {
    return <p style={s.vazio}>Esta lei ainda não tem banco de questões.</p>;
  }

  return (
    <div>
      {/* Progresso */}
      <div style={s.progressoRow}>
        <span style={s.progressoTexto}>
          <b>{respondidas}</b> de <b>{questoes.length}</b> respondidas
          {respondidas > 0 && <> · <b style={{ color: pctAcerto >= 70 ? theme.teal : theme.ink }}>{pctAcerto}%</b> de acerto</>}
        </span>
        {respondidas > 0 && (
          <button onClick={zerar} style={s.zerarBtn}>zerar progresso</button>
        )}
      </div>

      {/* Controles */}
      <div style={s.controles}>
        <span style={s.ctrlLabel}>Ordenar:</span>
        <button onClick={() => setOrdem('artigo')} style={{ ...s.chip, ...(ordem === 'artigo' ? s.chipOn : {}) }}>Por artigo</button>
        <button onClick={() => setOrdem('incidencia')} style={{ ...s.chip, ...(ordem === 'incidencia' ? s.chipOn : {}) }}>Por incidência</button>
        <button onClick={sortear} style={{ ...s.chip, ...(ordem === 'aleatoria' ? s.chipOn : {}) }}>
          Aleatória{ordem === 'aleatoria' ? ' ↻' : ''}
        </button>
      </div>
      <div style={s.controles}>
        <span style={s.ctrlLabel}>Mostrar:</span>
        <button onClick={() => setFiltro('todas')} style={{ ...s.chip, ...(filtro === 'todas' ? s.chipOn : {}) }}>Todas</button>
        <button onClick={() => setFiltro('nao-respondidas')} style={{ ...s.chip, ...(filtro === 'nao-respondidas' ? s.chipOn : {}) }}>
          Não respondidas ({naoRespondidasCount})
        </button>
        <button onClick={() => setFiltro('erradas')} style={{ ...s.chip, ...(filtro === 'erradas' ? s.chipOn : {}) }}>
          Que errei ({erradasCount})
        </button>
      </div>

      {!carregado && <p style={s.vazio}>Carregando seu progresso…</p>}

      {carregado && lista.length === 0 && (
        <p style={s.vazio}>
          {filtro === 'erradas'
            ? 'Nenhuma questão errada com esses filtros — bom sinal. 🎯'
            : 'Nenhuma questão com esses filtros.'}
        </p>
      )}

      {carregado && lista.map((q) => (
        <QuestaoCard
          key={q.id}
          questao={q}
          resposta={reabertas.has(q.id) ? undefined : respostas.get(q.id)}
          onResponder={responder}
          onReabrir={reabrir}
          onVerArtigo={() => onNavigate(artigoNumeroFromKey(q.artigoKey))}
        />
      ))}
    </div>
  );
}

function QuestaoCard({ questao: q, resposta, onResponder, onReabrir, onVerArtigo }: {
  questao: LeiQuestao;
  resposta: LeiQuestaoResposta | undefined;
  onResponder: (q: LeiQuestao, r: boolean) => void;
  onReabrir: (id: string) => void;
  onVerArtigo: () => void;
}) {
  const numero = artigoNumeroFromKey(q.artigoKey);
  const respondida = resposta !== undefined;
  const borda = !respondida ? theme.line : resposta.acertou ? 'rgba(43,155,120,.55)' : 'rgba(226,75,74,.55)';

  return (
    <div style={{ ...s.card, borderColor: borda }}>
      <div style={s.cardHead}>
        <button onClick={onVerArtigo} style={s.artChip} title="Ver o artigo na aba Texto">Art. {numero} →</button>
        {respondida && (
          <span style={{ ...s.resultado, color: resposta.acertou ? '#2B9B78' : '#C03A39' }}>
            {resposta.acertou ? '✓ acertou' : '✗ errou'}
          </span>
        )}
      </div>

      <p style={s.enunciado}>{q.enunciado}</p>

      {!respondida ? (
        <div style={s.botoes}>
          <button onClick={() => onResponder(q, true)} style={{ ...s.ceBtn, ...s.certoBtn }}>Certo</button>
          <button onClick={() => onResponder(q, false)} style={{ ...s.ceBtn, ...s.erradoBtn }}>Errado</button>
        </div>
      ) : (
        <div style={s.feedback}>
          <div style={s.feedbackHead}>
            <b style={{ color: resposta.acertou ? '#2B9B78' : '#C03A39' }}>
              Gabarito: {q.gabarito ? 'Certo' : 'Errado'}
            </b>
            {q.tipo === 'pegadinha' && <span style={s.tagPegadinha}>⚠ pegadinha</span>}
            <button onClick={() => onReabrir(q.id)} style={s.deNovoBtn}>tentar de novo</button>
          </div>
          <p style={s.comentario}>{q.comentario}</p>
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  vazio: { fontSize: 13.5, color: theme.inkFaint, textAlign: 'center', padding: '30px 0' },
  progressoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  progressoTexto: { fontSize: 13.5, color: theme.inkSoft },
  zerarBtn: { fontSize: 12, color: theme.inkFaint, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  controles: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 },
  ctrlLabel: { fontSize: 12.5, color: theme.inkFaint, minWidth: 58 },
  chip: { fontSize: 12, color: theme.inkSoft, background: 'transparent', borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: 999, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { borderColor: theme.teal, background: theme.tealBg, color: theme.tealDeep, fontWeight: 600 },
  card: { background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderRadius: theme.radius, padding: '14px 16px', marginTop: 10 },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  artChip: { fontSize: 12, fontWeight: 700, color: theme.tealDeep, background: theme.tealBg, border: 'none', borderRadius: 999, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' },
  resultado: { fontSize: 12, fontWeight: 700 },
  enunciado: { fontSize: 14, color: theme.ink, lineHeight: 1.6, margin: '0 0 12px' },
  botoes: { display: 'flex', gap: 8 },
  ceBtn: { flex: '0 0 auto', minWidth: 96, fontSize: 13, fontWeight: 600, borderRadius: 999, padding: '7px 18px', cursor: 'pointer', fontFamily: 'inherit', borderWidth: 0.5, borderStyle: 'solid' },
  certoBtn: { color: '#2B9B78', background: 'rgba(43,155,120,.08)', borderColor: 'rgba(43,155,120,.4)' },
  erradoBtn: { color: '#C03A39', background: 'rgba(226,75,74,.06)', borderColor: 'rgba(226,75,74,.4)' },
  feedback: { borderTop: `0.5px solid ${theme.line}`, paddingTop: 10 },
  feedbackHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 },
  tagPegadinha: { fontSize: 11, fontWeight: 700, color: '#C03A39', background: 'rgba(226,75,74,.08)', border: '0.5px solid rgba(226,75,74,.35)', borderRadius: 999, padding: '2px 8px' },
  deNovoBtn: { marginLeft: 'auto', fontSize: 12, color: theme.inkFaint, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  comentario: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.6, margin: '8px 0 0' },
};
