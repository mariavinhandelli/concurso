'use client';

import { memo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
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
import { PactoEstudo } from '@/components/features/home/PactoEstudo';
import { getActiveCycleRule, getCycleState, type CycleState } from '@/services/cycleEngine.service';
import { getUserFeatures, DEFAULT_FEATURES, type UserFeatures } from '@/services/userFeatures.service';
import { fmtMin } from '@/lib/format/time';
import { track, EV } from '@/lib/analytics';
import { useTimer } from '@/components/features/timer/TimerContext';
import { toLocalDateString } from '@/lib/local-date';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
  return <Badge style={{ color: m.fg, background: m.bg, textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.label}</Badge>;
}

// Marcador do passo: check verde quando concluído, círculo numerado quando pendente.
function StepMarker({ index, done }: { index: number; done: boolean }) {
  if (done) {
    return (
      <span style={{ ...markerBase, background: theme.ok, border: 'none' }}>
        <Check size={13} color={theme.onOk} strokeWidth={3} />
      </span>
    );
  }
  return <span style={{ ...markerBase, color: theme.inkSoft, border: `1.5px solid ${theme.line}` }}>{index}</span>;
}

function Chevron() {
  return <ChevronRight size={16} color={theme.inkFaint} strokeWidth={2.2} style={{ flexShrink: 0 }} />;
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

  // C2 — ciclo ativo alimenta o passo "Estudar" quando não há blocos hoje.
  // Sem isto, o plano gerado no onboarding vivia só na aba Ciclo da Agenda e o
  // Plano de Hoje seguia genérico ("escolha um tópico") — a promessa quebrava.
  const { data: cycleRuleId = null } = useQuery({
    queryKey: ['active-cycle'], queryFn: getActiveCycleRule, staleTime: 5 * 60_000,
  });
  const { data: ciclo } = useQuery<CycleState | null>({
    queryKey: ['cycle-state', cycleRuleId],
    queryFn: () => getCycleState(cycleRuleId as string),
    enabled: !!cycleRuleId,
  });

  // N7 — primeiro módulo nunca usado (se houver) para o convite de descoberta.
  const dormanteKey: DormantKey | null = dormant ? (DORMANT_ORDER.find((k) => dormant[k]) ?? null) : null;

  // ── Cronograma do dia — o plano explícito do usuário tem prioridade sobre a sugestão. ──
  const blocksDia = blocos ?? [];
  const temCronograma = blocos !== undefined && blocksDia.length > 0;
  const blocosFeitos = blocksDia.filter((b) => b.is_done).length;
  const proximoBloco = blocksDia.find((b) => !b.is_done) ?? null;
  const cronogramaCompleto = temCronograma && blocosFeitos === blocksDia.length;

  // Ciclo ativo: usado quando não há blocos avulsos hoje. A matéria sugerida é a
  // mais atrasada na volta (mesma regra da aba Ciclo da Agenda).
  const temCiclo = !temCronograma && !!ciclo && ciclo.subjects.length > 0;
  const cicloSugerida = temCiclo ? (ciclo.subjects.find((s) => s.isSuggested) ?? ciclo.subjects[0]) : null;

  // ── Dia leve (IA invisível) — user_features.plan_scale < 1 sinaliza risco de
  // abandono; a meta e o bloco do ciclo encolhem SÓ aqui na Home (a Agenda segue
  // mostrando o plano canônico). Voltar num dia fraco com um plano pequeno e
  // completável preserva o hábito; o plano cheio intimida e vira abandono.
  const { data: features = DEFAULT_FEATURES } = useQuery<UserFeatures>({
    queryKey: ['user-features'], queryFn: getUserFeatures, staleTime: 60 * 60_000,
  });
  const diaLeve = features.planScale < 1;
  const arred5 = (min: number) => Math.max(10, Math.round(min / 5) * 5);
  const metaCicloHoje = temCiclo ? arred5(ciclo.dailyMinutes * features.planScale) : 0;
  const minutosSugeridos = cicloSugerida ? arred5(cicloSugerida.plannedMinutes * features.planScale) : 0;
  const cicloMetaBatida = temCiclo && ciclo.todayMinutes >= metaCicloHoje;

  useEffect(() => {
    if (diaLeve && temCiclo) track(EV.lightPlanShown, { planScale: features.planScale, churnScore: features.churnScore });
  }, [diaLeve, temCiclo, features.planScale, features.churnScore]);

  // ── Estado de conclusão de cada passo ──
  // "Revisar" soma revisões de tópicos (SM-2) + artigos de lei seca +
  // jurisprudências vencidas — um único passo, uma única fila mental.
  const leiDueCount = leiDue ?? 0;
  const jurisDueCount = jurisDue ?? 0;
  const revEmDia = revisoes === 0 && leiDueCount === 0 && jurisDueCount === 0;
  const fcEmDia = flashcards === 0;
  const studiedToday = (goals?.todayMinutes ?? 0) > 0;
  // Fila vazia só vira "concluído" depois que o dia começou (estudo registrado).
  // Sem isso, usuário novo com filas vazias via "2 de 3 concluídos" sem ter feito nada.
  const diaComecou = studiedToday || blocosFeitos > 0;
  const revDone = revEmDia && diaComecou;
  const fcDone = fcEmDia && diaComecou;
  // Passo "estudar": blocos → todos feitos; ciclo → meta diária do ciclo batida;
  // sem plano → estudou hoje.
  const estudoDone = temCronograma ? cronogramaCompleto : temCiclo ? cicloMetaBatida : studiedToday;

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
    : revEmDia ? 'tudo em dia'
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
  const estudoLabel = temCronograma ? 'Cronograma' : temCiclo ? 'Ciclo' : 'Estudar';
  const estudoSub = temCronograma
    ? (proximoBloco
        ? `${proximoBloco.topicName ?? proximoBloco.subjectName}${proximoBloco.planned_minutes ? ` · ${proximoBloco.planned_minutes} min` : ''}`
        : 'blocos concluídos')
    : temCiclo
    ? (cicloMetaBatida
        ? 'meta do ciclo batida hoje 🎉'
        : `${cicloSugerida!.subjectName} · ${minutosSugeridos} min${diaLeve ? ' · dia leve' : ''}`)
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
            <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button variant="primary" size="sm" style={{ background: theme.warn, color: theme.onWarn }} onClick={confirmarTroca}>Encerrar e iniciar</Button>
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

      {/* Pacto de estudo (intenção de implementação) — o cue do dia; some ao estudar */}
      <PactoEstudo diaComecou={diaComecou} />

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
                ? <Badge variant="neutral">{blocosFeitos}/{blocksDia.length} blocos</Badge>
                : temCiclo
                ? <Badge variant="neutral">{fmtMin(ciclo!.todayMinutes)} de {fmtMin(metaCicloHoje)}</Badge>
                : principal && <KindPill kind={principal.kind} />}
            </div>
            <span style={styles.stepSub}>{estudoSub}</span>
          </div>
          {temCronograma ? (
            proximoBloco
              ? <button style={styles.studyBtn} onClick={(e) => iniciar(blocoStart(proximoBloco), e)}>Estudar agora</button>
              : <button style={styles.studyGhost} onClick={() => router.push('/schedule')}>Ver cronograma</button>
          ) : temCiclo ? (
            cicloMetaBatida
              ? <button style={styles.studyGhost} onClick={() => router.push('/schedule')}>Ver ciclo</button>
              : <button style={styles.studyBtn} onClick={(e) => iniciar({ name: cicloSugerida!.subjectName, topicId: null, subjectId: cicloSugerida!.subjectId }, e)}>Estudar agora</button>
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
          <Badge variant="brand" style={{ textTransform: 'uppercase' }}>Descobrir</Badge>
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
            <ChevronDown size={13} color={theme.inkFaint} strokeWidth={2.2} style={{ transition: 'transform .2s', transform: expandido ? 'rotate(180deg)' : 'none' }} />
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
                    ? <Check size={16} color={theme.ok} strokeWidth={2.4} style={{ flexShrink: 0 }} />
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
            <ChevronDown size={13} color={theme.inkFaint} strokeWidth={2.2} style={{ transition: 'transform .2s', transform: verAtencao ? 'rotate(180deg)' : 'none' }} />
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
  progressText: { fontSize: 13, fontWeight: 600, color: theme.inkSoft },
  bar: { height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', marginBottom: 14 },
  barFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width .4s ease' },

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
  stepLabel: { fontSize: 15, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  stepLabelDone: { color: theme.inkSoft, textDecoration: 'line-through' },
  stepSub: { fontSize: 13, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  studyBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: theme.teal, color: theme.onTeal, fontSize: 14,
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
  descobrirText: { fontSize: 13, color: theme.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 },
  descobrirLabel: { color: theme.ink, fontWeight: 700 },

  alsoWrap: { marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${theme.line}` },
  alsoToggle: {
    display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  alsoList: { display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 },
  alsoItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: theme.radiusXs,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  alsoName: { fontSize: 14, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  alsoMotivo: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', flexShrink: 0 },
  verMaisBtn: { marginTop: 4, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' },

  blockItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: theme.radiusXs,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  blockName: { fontSize: 14, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  blockMin: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', flexShrink: 0 },

  atencaoWrap: { marginTop: 10 },
  atencaoToggle: {
    display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },

  confirmBanner: { marginBottom: 12, padding: '11px 14px', borderRadius: theme.radiusSm, background: theme.warnBg, border: `0.5px solid ${theme.warn}` },
  confirmMsg: { margin: '0 0 10px', fontSize: 14, color: theme.ink, lineHeight: 1.5 },
  confirmBtns: { display: 'flex', gap: 8 },
  confirmCancel: { padding: '7px 14px', borderRadius: theme.radiusXs, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  confirmOk: { padding: '7px 14px', borderRadius: theme.radiusXs, border: 'none', background: theme.warn, color: theme.onWarn, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
