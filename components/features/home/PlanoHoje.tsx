'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { countDueReviews } from '@/services/reviews.service';
import { countDueCards } from '@/services/flashcards.service';
import { countRevisoesDue } from '@/services/leiInteracoes.service';
import { countRevisoesHoje } from '@/services/jurisRevisao.service';
import { getGoalsSummary, type GoalsSummary } from '@/services/goals.service';
import { listBlocks, type StudyBlock } from '@/services/studyBlocks.service';
import {
  getSuggestions, type SuggestionsResult, type SuggestedTopic, type SuggestionKind,
} from '@/services/suggestion.service';
import { getDormantModules, type DormantModules } from '@/services/activation.service';
import { track, EV } from '@/lib/analytics';
import { useTimer } from '@/components/features/timer/TimerContext';
import { toLocalDateString } from '@/lib/local-date';
import { theme } from '@/lib/theme';

// Alvo genérico de "iniciar sessão" — unifica sugestões e blocos do cronograma.
type PendingStart = { name: string; topicId: string | null; subjectId: string | null };

// ── Selo por natureza da sugestão. "recuperar" usa o accent clay para destacar
// o sinal de negligência (o diferencial do Plano de Hoje). ──
const KIND_META: Record<SuggestionKind, { label: string; fg: string; bg: string }> = {
  revisao:   { label: 'Revisar',   fg: theme.teal,     bg: theme.tealBg },
  reforco:   { label: 'Reforçar',  fg: theme.warn,     bg: theme.warnBg },
  recuperar: { label: 'Recuperar', fg: theme.clayDeep, bg: theme.clayBg },
};

// N7 — convites de 1º uso para módulos dormentes. Ordem = prioridade de exibição
// (mostra só um por vez para não poluir). Cada convite é concreto e acionável.
const DORMANT_ORDER = ['lei', 'juris', 'flashcards'] as const;
type DormantKey = typeof DORMANT_ORDER[number];
const DORMANT_INVITES: Record<DormantKey, { label: string; desc: string; href: string }> = {
  lei: { label: 'Vade Mecum', desc: 'grife e revise a lei seca do seu edital', href: '/vademecum' },
  juris: { label: 'Jurisprudências', desc: 'domine os julgados que mais caem', href: '/jurisprudencias' },
  flashcards: { label: 'Flashcards', desc: 'crie seu primeiro para fixar na memória', href: '/flashcards' },
};

function KindPill({ kind }: { kind: SuggestionKind }) {
  const m = KIND_META[kind];
  return <span style={{ ...pillBase, color: m.fg, background: m.bg }}>{m.label}</span>;
}

// Marcador do passo: check verde quando concluído, círculo numerado quando pendente.
function StepMarker({ index, done }: { index: number; done: boolean }) {
  if (done) {
    return (
      <span style={{ ...markerBase, background: theme.ok, border: 'none' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    );
  }
  return <span style={{ ...markerBase, color: theme.inkSoft, border: `1.5px solid ${theme.line}` }}>{index}</span>;
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
  );
}

export const PlanoHoje = memo(function PlanoHoje() {
  const router = useRouter();
  const { start, status } = useTimer();
  const [confirming, setConfirming] = useState<PendingStart | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [verMais, setVerMais] = useState(false);
  const [verAtencao, setVerAtencao] = useState(false);

  const hoje = toLocalDateString(new Date());

  // Reusa as MESMAS query keys da Home → dedupe + sincronia com invalidações existentes.
  const { data: revisoes } = useQuery<number>({ queryKey: ['due-reviews-count'], queryFn: countDueReviews });
  const { data: leiDue } = useQuery<number>({ queryKey: ['due-lei-count'], queryFn: countRevisoesDue });
  const { data: jurisDue } = useQuery<number>({ queryKey: ['due-juris-count'], queryFn: countRevisoesHoje });
  const { data: flashcards } = useQuery<number>({ queryKey: ['due-cards-count'], queryFn: countDueCards });
  const { data: goals } = useQuery<GoalsSummary>({ queryKey: ['goals-summary'], queryFn: getGoalsSummary });
  const { data: sug } = useQuery<SuggestionsResult>({ queryKey: ['home-suggestions'], queryFn: getSuggestions });
  const { data: blocos } = useQuery<StudyBlock[]>({ queryKey: ['today-blocks', hoje], queryFn: () => listBlocks(hoje, hoje) });
  const { data: dormant } = useQuery<DormantModules>({ queryKey: ['dormant-modules'], queryFn: getDormantModules, staleTime: 5 * 60_000 });

  // N7 — primeiro módulo nunca usado (se houver) para o convite de descoberta.
  const dormanteKey: DormantKey | null = dormant ? (DORMANT_ORDER.find((k) => dormant[k]) ?? null) : null;

  // ── Cronograma do dia — o plano explícito do usuário tem prioridade sobre a sugestão. ──
  const blocksDia = blocos ?? [];
  const temCronograma = blocos !== undefined && blocksDia.length > 0;
  const blocosFeitos = blocksDia.filter((b) => b.is_done).length;
  const proximoBloco = blocksDia.find((b) => !b.is_done) ?? null;
  const cronogramaCompleto = temCronograma && blocosFeitos === blocksDia.length;

  // ── Estado de conclusão de cada passo ──
  // "Revisar" soma revisões de tópicos (SM-2) + artigos de lei seca +
  // jurisprudências vencidas — um único passo, uma única fila mental.
  const leiDueCount = leiDue ?? 0;
  const jurisDueCount = jurisDue ?? 0;
  const revDone = revisoes === 0 && leiDueCount === 0 && jurisDueCount === 0;
  const fcDone = flashcards === 0;
  const studiedToday = (goals?.todayMinutes ?? 0) > 0;
  // Passo "estudar": se há cronograma, concluído = todos os blocos feitos; senão, estudou hoje.
  const estudoDone = temCronograma ? cronogramaCompleto : studiedToday;

  const doneCount = [revDone, fcDone, estudoDone].filter(Boolean).length;
  const pct = Math.round((doneCount / 3) * 100);
  const allDone = revDone && fcDone && estudoDone;

  const principal = sug?.items?.[0];
  const secundarias = sug?.items?.slice(1) ?? [];
  const sugVisiveis = secundarias.slice(0, 2);
  const sugOcultos = secundarias.slice(2);

  // Sinais reativos que o cronograma não cobre — frágeis e negligenciados.
  // (revisões vencidas já aparecem no passo 1.) Mantém o alerta de esquecimento
  // visível mesmo quando o usuário está seguindo um plano.
  const atencao = (sug?.items ?? []).filter((s) => s.kind === 'reforco' || s.kind === 'recuperar');

  function iniciar(p: PendingStart, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (status !== 'idle') { setConfirming(p); return; }
    start({ mode: 'teoria', topicId: p.topicId, subjectId: p.subjectId });
  }

  function confirmarTroca() {
    if (!confirming) return;
    start({ mode: 'teoria', topicId: confirming.topicId, subjectId: confirming.subjectId });
    setConfirming(null);
  }

  const blocoStart = (b: StudyBlock): PendingStart =>
    ({ name: b.topicName ?? b.subjectName ?? 'bloco', topicId: b.topic_id, subjectId: b.subject_id });
  const sugStart = (s: SuggestedTopic): PendingStart =>
    ({ name: s.name, topicId: s.id, subjectId: s.subjectId });

  const revSub = revisoes === undefined ? '…'
    : revDone ? 'tudo em dia'
    : [
        revisoes > 0 ? `${revisoes} ${revisoes === 1 ? 'revisão' : 'revisões'}` : null,
        leiDueCount > 0 ? `${leiDueCount} de lei seca` : null,
        jurisDueCount > 0 ? `${jurisDueCount} de jurisprudência` : null,
      ].filter(Boolean).join(' · ') + ` · ~${(revisoes ?? 0) * 3 + leiDueCount * 2 + jurisDueCount * 2} min`;

  // Fila Única de Revisão: tópicos, lei seca e jurisprudência num só player.
  const revisarHref = '/revisar';

  const fcSub = flashcards === undefined ? '…'
    : flashcards > 0 ? `${flashcards} na fila · ~${Math.ceil(flashcards * 1.5)} min`
    : 'tudo em dia';

  // Passo 3 muda de rótulo/fonte conforme haja cronograma planejado hoje.
  const estudoLabel = temCronograma ? 'Cronograma' : 'Estudar';
  const estudoSub = temCronograma
    ? (proximoBloco
        ? `${proximoBloco.topicName ?? proximoBloco.subjectName}${proximoBloco.planned_minutes ? ` · ${proximoBloco.planned_minutes} min` : ''}`
        : 'blocos concluídos')
    : (sug === undefined ? '…'
        : principal ? principal.name
        : studiedToday ? 'nenhum tópico pendente' : 'escolha um tópico para começar');

  // A seção expansível mostra os blocos do dia (se houver cronograma) ou as sugestões.
  const temExtras = temCronograma ? blocksDia.length > 0 : secundarias.length > 0;

  return (
    <div style={styles.card}>
      {confirming && (
        <div style={styles.confirmBanner}>
          <p style={styles.confirmMsg}>
            Há uma sessão em andamento. Iniciar <b>&quot;{confirming.name}&quot;</b> vai encerrar a sessão atual.
          </p>
          <div style={styles.confirmBtns}>
            <button style={styles.confirmCancel} onClick={() => setConfirming(null)}>Cancelar</button>
            <button style={styles.confirmOk} onClick={confirmarTroca}>Encerrar e iniciar</button>
          </div>
        </div>
      )}

      {/* ── Cabeçalho: título + progresso do dia ── */}
      <div style={styles.header}>
        <span style={styles.eyebrow}>Plano de hoje</span>
        <span style={styles.progressText}>
          {allDone ? 'concluído 🎉' : `${doneCount} de 3 concluído${doneCount === 1 ? '' : 's'}`}
        </span>
      </div>
      <div style={styles.bar}><div style={{ ...styles.barFill, width: `${pct}%` }} /></div>

      {/* ── Passos ── */}
      <div style={styles.steps}>
        {/* 1 · Revisar */}
        <button style={styles.step} onClick={() => router.push(revisarHref)}>
          <StepMarker index={1} done={revDone} />
          <div style={styles.stepText}>
            <span style={{ ...styles.stepLabel, ...(revDone ? styles.stepLabelDone : {}) }}>Revisar</span>
            <span style={styles.stepSub}>{revSub}</span>
          </div>
          <Chevron />
        </button>

        {/* 2 · Flashcards */}
        <button style={styles.step} onClick={() => router.push('/flashcards')}>
          <StepMarker index={2} done={fcDone} />
          <div style={styles.stepText}>
            <span style={{ ...styles.stepLabel, ...(fcDone ? styles.stepLabelDone : {}) }}>Flashcards</span>
            <span style={styles.stepSub}>{fcSub}</span>
          </div>
          <Chevron />
        </button>

        {/* 3 · Estudar / Cronograma — CTA segue o plano quando ele existe */}
        <div style={{ ...styles.step, ...styles.stepStudy, cursor: 'default' }}>
          <StepMarker index={3} done={estudoDone} />
          <div style={styles.stepText}>
            <div style={styles.studyTop}>
              <span style={{ ...styles.stepLabel, ...(estudoDone ? styles.stepLabelDone : {}) }}>{estudoLabel}</span>
              {temCronograma
                ? <span style={styles.countChip}>{blocosFeitos}/{blocksDia.length} blocos</span>
                : principal && <KindPill kind={principal.kind} />}
            </div>
            <span style={styles.stepSub}>{estudoSub}</span>
          </div>
          {temCronograma ? (
            proximoBloco
              ? <button style={styles.studyBtn} onClick={(e) => iniciar(blocoStart(proximoBloco), e)}>Estudar agora</button>
              : <button style={styles.studyGhost} onClick={() => router.push('/schedule')}>Ver cronograma</button>
          ) : principal ? (
            <button style={styles.studyBtn} onClick={(e) => iniciar(sugStart(principal), e)}>Estudar agora</button>
          ) : (
            <button style={styles.studyGhost} onClick={() => router.push('/subjects')}>Ver matérias</button>
          )}
        </div>
      </div>

      {/* N7 — convite de 1º uso a um módulo dormente (Vade Mecum, Juris, Flashcards) */}
      {dormanteKey && (
        <button style={styles.descobrir} onClick={() => { track(EV.dormantOpened, { module: dormanteKey }); router.push(DORMANT_INVITES[dormanteKey].href); }}>
          <span style={styles.descobrirPill}>Descobrir</span>
          <span style={styles.descobrirText}>
            <b style={styles.descobrirLabel}>{DORMANT_INVITES[dormanteKey].label}</b>
            {' — '}{DORMANT_INVITES[dormanteKey].desc}
          </span>
          <Chevron />
        </button>
      )}

      {/* Seção expansível: blocos do dia (cronograma) ou sugestões secundárias */}
      {temExtras && (
        <div style={styles.alsoWrap}>
          <button style={styles.alsoToggle} onClick={() => setExpandido((v) => !v)}>
            {expandido
              ? (temCronograma ? 'ocultar blocos do dia' : 'ocultar outras sugestões')
              : (temCronograma
                  ? `ver os ${blocksDia.length} blocos do dia`
                  : `ver outras ${secundarias.length} ${secundarias.length === 1 ? 'sugestão' : 'sugestões'}`)}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .2s', transform: expandido ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {expandido && temCronograma && (
            <div style={styles.alsoList}>
              {blocksDia.map((b) => (
                <button
                  key={b.id}
                  style={{ ...styles.blockItem, opacity: b.is_done ? 0.6 : 1 }}
                  onClick={(e) => { if (!b.is_done) iniciar(blocoStart(b), e); }}
                  disabled={b.is_done}
                >
                  {b.is_done
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.ok} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5" /></svg>
                    : <span style={{ ...styles.dot, background: b.subjectColor }} />}
                  <span style={{ ...styles.blockName, ...(b.is_done ? styles.stepLabelDone : {}) }}>
                    {b.topicName ?? b.subjectName}
                  </span>
                  <span style={styles.blockMin}>{b.planned_minutes} min</span>
                </button>
              ))}
            </div>
          )}

          {expandido && !temCronograma && (
            <div style={styles.alsoList}>
              {(verMais ? secundarias : sugVisiveis).map((s) => (
                <button key={s.id} style={styles.alsoItem} onClick={(e) => iniciar(sugStart(s), e)}>
                  <KindPill kind={s.kind} />
                  <span style={styles.alsoName}>{s.name}</span>
                  <span style={styles.alsoMotivo}>{s.motivo}</span>
                </button>
              ))}
              {sugOcultos.length > 0 && (
                <button style={styles.verMaisBtn} onClick={() => setVerMais((v) => !v)}>
                  {verMais ? 'ver menos' : `ver mais ${sugOcultos.length}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alerta de esquecimento — visível mesmo com cronograma ativo */}
      {temCronograma && atencao.length > 0 && (
        <div style={styles.atencaoWrap}>
          <button style={styles.atencaoToggle} onClick={() => setVerAtencao((v) => !v)}>
            <span style={{ ...styles.dot, background: theme.clay }} />
            {atencao.length} {atencao.length === 1 ? 'tópico fora do plano pede' : 'tópicos fora do plano pedem'} atenção
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .2s', transform: verAtencao ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {verAtencao && (
            <div style={styles.alsoList}>
              {atencao.slice(0, 4).map((s) => (
                <button key={s.id} style={styles.alsoItem} onClick={(e) => iniciar(sugStart(s), e)}>
                  <KindPill kind={s.kind} />
                  <span style={styles.alsoName}>{s.name}</span>
                  <span style={styles.alsoMotivo}>{s.motivo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const pillBase: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3,
  textTransform: 'uppercase', padding: '2px 7px', borderRadius: theme.radiusPill,
  whiteSpace: 'nowrap', flexShrink: 0,
};

const markerBase: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
  display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
  background: theme.card,
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card,
    border: `1.5px solid ${theme.teal}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: '16px 18px',
    fontFamily: theme.font,
    minWidth: 0,
  },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase' },
  progressText: { fontSize: 12.5, fontWeight: 600, color: theme.inkSoft },
  bar: { height: 6, background: theme.muted, borderRadius: 999, overflow: 'hidden', marginBottom: 14 },
  barFill: { height: '100%', background: theme.teal, borderRadius: 999, transition: 'width .4s ease' },

  steps: { display: 'flex', flexDirection: 'column', gap: 8 },
  step: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: theme.radiusSm,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', minWidth: 0,
  },
  stepStudy: { border: `0.5px solid ${theme.line}`, background: theme.tealBg },
  stepText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  studyTop: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' },
  stepLabel: { fontSize: 14.5, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  stepLabelDone: { color: theme.inkSoft, textDecoration: 'line-through' },
  stepSub: { fontSize: 12.5, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  countChip: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: theme.inkSoft,
    background: theme.muted, padding: '2px 7px', borderRadius: theme.radiusPill, whiteSpace: 'nowrap', flexShrink: 0,
  },

  studyBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 13.5,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  },
  studyGhost: {
    padding: '9px 14px', borderRadius: 10, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.inkSoft, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  },

  descobrir: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginTop: 10,
    padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px dashed ${theme.line}`,
    background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0,
  },
  descobrirPill: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    color: theme.tealDeep, background: theme.tealBg, padding: '2px 8px', borderRadius: theme.radiusPill, flexShrink: 0,
  },
  descobrirText: { fontSize: 12.5, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 },
  descobrirLabel: { color: theme.ink, fontWeight: 700 },

  alsoWrap: { marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${theme.line}` },
  alsoToggle: {
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  alsoList: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 },
  alsoItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  alsoName: { fontSize: 13.5, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  alsoMotivo: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', flexShrink: 0 },
  verMaisBtn: { marginTop: 4, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' },

  blockItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  blockName: { fontSize: 13.5, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  blockMin: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', flexShrink: 0 },

  atencaoWrap: { marginTop: 10 },
  atencaoToggle: {
    display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },

  confirmBanner: { marginBottom: 12, padding: '11px 14px', borderRadius: theme.radiusSm, background: theme.warnBg, border: `0.5px solid ${theme.warn}` },
  confirmMsg: { margin: '0 0 10px', fontSize: 13.5, color: theme.ink, lineHeight: 1.5 },
  confirmBtns: { display: 'flex', gap: 8 },
  confirmCancel: { padding: '7px 14px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirmOk: { padding: '7px 14px', borderRadius: 8, border: 'none', background: theme.warn, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
