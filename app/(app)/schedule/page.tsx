// app/(app)/schedule/page.tsx
// Cronograma: Grade (7 colunas), Lista, Hoje ou Ciclo. Blocos manuais + recorrência (motor).
// Toda a lógica de estado e handlers está em hooks/useSchedulePage.ts.
'use client';

import { memo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSchedulePage } from '@/hooks/useSchedulePage';
import { usePersistedState } from '@/hooks/usePersistedState';
import { CalendarView } from '@/components/features/calendar/CalendarView';
import { BlockMenu } from '@/components/features/schedule/BlockMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { theme } from '@/lib/theme';
import { toLocalDateString as localDateStr } from '@/lib/local-date';
import {
  tons, fmtH, dateLabelOf, isToday, DIAS_SEMANA, mondayOf,
} from '@/lib/schedule-utils';
import type { ScheduleBlock } from '@/services/scheduleEngine.service';

// Lazy: só baixados quando o usuário os abre pela primeira vez na sessão.
const BlockModal = dynamic(
  () => import('@/components/features/schedule/BlockModal').then((m) => m.BlockModal),
  { ssr: false },
);
const RecurrenceModal = dynamic(
  () => import('@/components/features/schedule/RecurrenceModal').then((m) => m.RecurrenceModal),
  { ssr: false },
);
const RecurrencePanel = dynamic(
  () => import('@/components/features/schedule/RecurrencePanel').then((m) => m.RecurrencePanel),
  { ssr: false },
);
const GeneratorModal = dynamic(
  () => import('@/components/features/schedule/GeneratorModal').then((m) => m.GeneratorModal),
  { ssr: false },
);
const CycleView = dynamic(
  () => import('@/components/features/schedule/CycleView').then((m) => m.CycleView),
  { ssr: false },
);
const ReplanModal = dynamic(
  () => import('@/components/features/schedule/ReplanModal').then((m) => m.ReplanModal),
  { ssr: false },
);

const RepeatIcon = ({ size = 11, color = 'currentColor', mr = 4 }: { size?: number; color?: string; mr?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-1px', marginRight: mr }} aria-hidden="true">
    <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
);

const CycleIcon = ({ size = 14, color = 'currentColor', mr = 6 }: { size?: number; color?: string; mr?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: mr }} aria-hidden="true">
    <path d="M21 12a9 9 0 11-3-6.7" /><path d="M21 3v5h-5" />
  </svg>
);

export default function SchedulePage() {
  const {
    isMobile, dialog,
    dias, weekLabel, navWeek, setWeekStart,
    blocks, loading, error,
    view, setView, cicloAtivo, cycleViewId, viewingArchivedId, setViewingArchivedId,
    modalDate, setModalDate,
    recurrenceOpen, setRecurrenceOpen, recurrenceMode,
    panelOpen, setPanelOpen,
    editingRule, setEditingRule,
    editingBlock, setEditingBlock,
    generatorOpen, setGeneratorOpen,
    load, checkCycle,
    blocksOf, dayLoad,
    handleToggle, handleDelete, handleSkip, handleEditRule,
    handleCycleButton, iniciarNovoCiclo, abrirRecorrencia,
    handleReativar, handleRecurrenceCreated, handlePanelEdit,
    replanMoves, replanModalOpen, setReplanModalOpen, replanning, handleApplyReplan,
  } = useSchedulePage();

  // ── Agenda: alterna entre o cronograma (Grade/Lista/Ciclo) e a visão de
  // calendário (Mês). `calOverride` (deep-link ?view=) tem prioridade sem persistir. ──
  const [calPref, setCalPref] = usePersistedState<'on' | 'off'>('agenda:view', 'off', (v) => (v === 'on' ? 'on' : 'off'));
  const [calOverride, setCalOverride] = useState<boolean | null>(null);
  const calendarOn = calOverride ?? (calPref === 'on');

  // Deep-link ?view=mes (redirect de /calendar, sino de notificações): abre a aba Mês.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === 'mes' || v === 'calendario') setCalOverride(true);
    if (v) window.history.replaceState(null, '', '/schedule');
  }, []);

  function abrirCronograma(v: 'semana' | 'lista') { setCalOverride(null); setCalPref('off'); setView(v); }
  function abrirMes() { setCalOverride(null); setCalPref('on'); }
  function abrirCiclo() { setCalOverride(null); setCalPref('off'); handleCycleButton(); }

  const mostrarLista = view === 'lista' || (view === 'semana' && isMobile);

  // — Resumo semanal —
  const totalPlanned = !loading ? dias.reduce((s, d) => s + dayLoad(d).planned, 0) : 0;
  const totalDone    = !loading ? dias.reduce((s, d) => s + dayLoad(d).done, 0) : 0;
  const totalPct     = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;

  return (
    <>
      {dialog}
      <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
        <div style={styles.header}>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>Agenda</h1>
        </div>

        {/* ── Toolbar ── */}
        <div style={styles.toolbar}>
          {/* Linha 1: navegação + seletor de view */}
          <div style={styles.toolbarRow}>
            {/* Navegação semanal — só no cronograma; a aba Mês tem sua própria nav */}
            {!calendarOn && (
            <div style={{ ...styles.nav, width: isMobile ? '100%' : undefined, gap: isMobile ? 6 : 10 }}>
              <button className="icon-touch-target" style={styles.navBtn} onClick={() => navWeek(-1)} aria-label="Semana anterior">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                className="touch-target"
                style={{ ...styles.weekLabel, minWidth: isMobile ? 0 : 150, flex: isMobile ? 1 : undefined }}
                title="Ir para uma data"
                onClick={(e) => {
                  const inp = e.currentTarget.querySelector('input[type=date]') as HTMLInputElement | null;
                  if (inp?.showPicker) inp.showPicker(); else inp?.focus();
                }}
              >
                {weekLabel}
                <input
                  type="date"
                  onChange={(e) => { if (e.target.value) setWeekStart(new Date(e.target.value + 'T12:00:00')); }}
                  style={styles.datePicker}
                />
              </button>
              <button className="icon-touch-target" style={styles.navBtn} onClick={() => navWeek(1)} aria-label="Próxima semana">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <button
                className="touch-target"
                style={{ ...styles.todayBtn, padding: isMobile ? '8px 10px' : '8px 16px' }}
                onClick={() => setWeekStart(mondayOf(new Date()))}
              >
                Hoje
              </button>
            </div>
            )}

            <div style={{ ...styles.viewToggle, ...(calendarOn ? { marginLeft: 'auto' } : {}) }}>
              <button
                className="schedule-grade-btn touch-target"
                onClick={() => abrirCronograma('semana')}
                style={{ ...styles.viewBtn, ...(!calendarOn && view === 'semana' ? styles.viewBtnOn : {}) }}
              >
                Grade
              </button>
              <button className="touch-target"
                onClick={() => abrirCronograma('lista')}
                style={{ ...styles.viewBtn, ...(!calendarOn && mostrarLista ? styles.viewBtnOn : {}) }}
              >
                Lista
              </button>
              <button className="touch-target"
                onClick={abrirMes}
                style={{ ...styles.viewBtn, ...(calendarOn ? styles.viewBtnOn : {}) }}
              >
                Mês
              </button>
              {/* Ciclo: sempre visível — se não houver ciclo, abre o modal de criação */}
              <button className="touch-target"
                onClick={abrirCiclo}
                style={{ ...styles.viewBtn, ...(!calendarOn && view === 'ciclo' ? styles.viewBtnOn : {}) }}
              >
                Ciclo
              </button>
            </div>
          </div>

          {/* Linha 2: ações — só no cronograma (a aba Mês não usa gerador/recorrência) */}
          {!calendarOn && (
          <div style={{ ...styles.toolbarActions, flexDirection: isMobile ? 'column' : 'row' }}>
            <button className="touch-target"
              onClick={() => setGeneratorOpen(true)}
              style={{ ...styles.genBtn, justifyContent: 'center', width: isMobile ? '100%' : undefined }}
              title="Gera blocos automáticos a partir das matérias do seu edital"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 6 }}>
                <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
              </svg>
              Gerar do edital
            </button>

            <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : undefined, gap: isMobile ? 6 : 10, width: isMobile ? '100%' : 'auto' }}>
              <button className="touch-target" onClick={handleCycleButton} style={{ ...styles.cycleBtn, justifyContent: 'center', minWidth: 0, padding: isMobile ? '8px 6px' : '8px 12px' }}>
                <CycleIcon size={14} color={theme.teal} mr={6} />
                {cicloAtivo ? 'Ver ciclo' : 'Criar ciclo'}
              </button>
              <button className="touch-target" onClick={abrirRecorrencia} style={{ ...styles.recBtn, justifyContent: 'center', minWidth: 0, padding: isMobile ? '8px 6px' : '8px 12px' }}>
                <RepeatIcon size={14} color={theme.teal} mr={6} />
                Recorrência
              </button>
              <button className="touch-target" onClick={() => setPanelOpen(true)} style={{ ...styles.recBtnGhost, justifyContent: 'center', minWidth: 0, padding: isMobile ? '8px 6px' : '8px 12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 6 }}>
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
                Gerenciar
              </button>
            </div>
          </div>
          )}
        </div>

        {/* ── Conteúdo: calendário (aba Mês) ou cronograma ── */}
        {calendarOn ? (
          <CalendarView />
        ) : (
        <>
        {error && <p style={styles.error}>{error}</p>}

        {loading ? (
          /* Skeleton da grade (7 colunas) */
          <div className="schedule-week-grid" style={{ ...styles.weekGrid, display: 'grid' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={styles.dayCol}>
                <div style={{ ...styles.dayHead, opacity: 0.5 }}>
                  <div className="skel" style={styles.skelLine} />
                  <div className="skel" style={{ ...styles.skelLine, width: 22, height: 22, borderRadius: 6, marginTop: 2 }} />
                </div>
                <div style={{ ...styles.progressWrap, opacity: 0.4 }}>
                  <div className="skel" style={{ ...styles.skelLine, marginBottom: 5 }} />
                  <div className="skel" style={{ ...styles.skelLine, height: 5, borderRadius: 999 }} />
                </div>
                <div style={{ ...styles.dayBody, minHeight: 180 }}>
                  {[44, i % 2 === 0 ? 56 : 0].filter(Boolean).map((h, j) => (
                    <div key={j} className="skel" style={{ ...styles.skelBlock, height: h, animationDelay: `${j * 0.12}s` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : view === 'ciclo' ? (
          cycleViewId ? (
            <CycleView
              ruleId={cycleViewId}
              isArchived={!!viewingArchivedId}
              onNovoCiclo={iniciarNovoCiclo}
              onArquivado={() => { setViewingArchivedId(null); setView('semana'); checkCycle(); }}
              onExcluido={() => { setViewingArchivedId(null); setView('semana'); checkCycle(); }}
              onAbrirArquivado={(id) => setViewingArchivedId(id)}
              onReativar={handleReativar}
              onVoltar={() => setViewingArchivedId(null)}
            />
          ) : (
            /* Estado vazio do Ciclo */
            <EmptyState
              icon={<CycleIcon size={32} color={theme.teal} mr={0} />}
              title="Você ainda não tem um ciclo de estudos"
              body="O ciclo rotaciona suas matérias automaticamente e sugere sempre a mais atrasada em relação à sua meta diária."
              action={{ label: 'Criar meu ciclo', onClick: handleCycleButton }}
            />
          )
        ) : (
          <>
            {/* — Resumo semanal — */}
            {totalPlanned > 0 && (
              <div style={styles.weekSummary}>
                <span style={styles.weekSummaryLabel}>
                  {fmtH(totalDone)} / {fmtH(totalPlanned)} esta semana
                </span>
                <div style={styles.weekSummaryTrack}>
                  <div style={{
                    ...styles.weekSummaryFill,
                    width: `${totalPct}%`,
                    background: totalPct === 100 ? theme.ok : theme.tealSoft,
                  }} />
                </div>
                <span style={{ ...styles.weekSummaryPct, color: totalPct === 100 ? theme.ok : theme.inkSoft }}>
                  {totalPct}%
                </span>
              </div>
            )}

            {/* — Cronograma vivo: blocos atrasados esta semana — */}
            {replanMoves.length > 0 && (
              <div style={styles.replanBanner}>
                <span style={styles.replanMsg}>
                  <b>{replanMoves.length}</b> {replanMoves.length === 1 ? 'bloco ficou' : 'blocos ficaram'} para trás esta semana.
                </span>
                <button onClick={() => setReplanModalOpen(true)} style={styles.replanBtn}>
                  Reorganizar semana →
                </button>
              </div>
            )}

            {/* — Callout quando a semana está vazia — */}
            {blocks.length === 0 && (
              <div style={styles.emptyCallout}>
                <p style={styles.emptyCalloutMsg}>
                  <strong>Semana sem blocos.</strong>
                  {' '}Crie uma recorrência para preencher automaticamente, ou adicione blocos avulsos clicando em &ldquo;+ bloco&rdquo;.
                </p>
                <div style={styles.emptyCalloutActions}>
                  <button onClick={abrirRecorrencia} style={styles.recBtn}>
                    <RepeatIcon size={13} color={theme.teal} mr={5} />
                    Criar recorrência
                  </button>
                  <button onClick={() => setGeneratorOpen(true)} style={styles.genBtn}>
                    ✦ Gerar do edital
                  </button>
                </div>
              </div>
            )}

            {/* — Grade semanal (oculta em mobile/lista) — */}
            <div
              className="schedule-week-grid"
              style={{ ...styles.weekGrid, display: view === 'semana' ? 'grid' : 'none' }}
            >
              {dias.map((d, i) => {
                const bs = blocksOf(d);
                const { done, planned, pct } = dayLoad(d);
                return (
                  <div key={i} style={styles.dayCol}>
                    <div style={{ ...styles.dayHead, ...(isToday(d) ? styles.dayHeadToday : {}) }}>
                      <span style={{ ...styles.dayName, ...(isToday(d) ? { color: theme.teal } : {}) }}>{DIAS_SEMANA[i]}</span>
                      <span style={{ ...styles.dayNum, ...(isToday(d) ? styles.dayNumToday : {}) }}>{d.getDate()}</span>
                    </div>
                    <div style={styles.progressWrap}>
                      {planned > 0 ? (
                        <>
                          <div style={styles.progressLabels}>
                            <span style={styles.progressText}>{fmtH(done)} de {fmtH(planned)}</span>
                            <span style={{ ...styles.progressPct, color: pct === 100 ? theme.ok : theme.inkSoft }}>{pct}%</span>
                          </div>
                          <div style={styles.progressTrack}>
                            <div style={{ ...styles.progressFill, width: `${pct}%`, background: pct === 100 ? theme.ok : theme.tealSoft }} />
                          </div>
                        </>
                      ) : (
                        <div style={styles.progressEmpty}>—</div>
                      )}
                    </div>
                    <div style={styles.dayBody}>
                      {bs.map((b) => (
                        <BlockCard
                          key={b.id}
                          block={b}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                          onEdit={setEditingBlock}
                          onSkip={handleSkip}
                          onEditRule={handleEditRule}
                        />
                      ))}
                      <button className="add-block-btn" style={styles.addBtn} onClick={() => setModalDate(localDateStr(d))}>+ bloco</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* — Vista lista — */}
            <div className="schedule-list-view" style={{ ...styles.listView, display: mostrarLista ? 'flex' : 'none' }}>
              {dias.map((d, i) => {
                const bs = blocksOf(d);
                const { done, planned, pct } = dayLoad(d);
                const empty = bs.length === 0;
                return (
                  <div key={i} style={{ ...styles.listDay, ...(empty ? styles.listDayEmpty : {}) }}>
                    <div style={styles.listDayHead}>
                      <span style={{ ...styles.listDayName, ...(isToday(d) ? { color: theme.teal } : {}), ...(empty ? { color: theme.inkFaint, fontWeight: 500 } : {}) }}>
                        {DIAS_SEMANA[i]}, {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <div style={styles.listDayRight}>
                        {planned > 0 && <span style={styles.listDayLoad}>{fmtH(done)}/{fmtH(planned)} · {pct}%</span>}
                        <button style={styles.addBtnSm} onClick={() => setModalDate(localDateStr(d))}>+ bloco</button>
                      </div>
                    </div>
                    {!empty && (
                      <div style={styles.listBlocks}>
                        {bs.map((b) => (
                          <BlockCard
                            key={b.id}
                            block={b}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onEdit={setEditingBlock}
                            onSkip={handleSkip}
                            onEditRule={handleEditRule}
                            listMode
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Hint do timer — visível apenas em views normais */}
        {!loading && view !== 'ciclo' && (
          <p style={styles.footnote}>
            O bloco só é concluído automaticamente quando você registra o estudo específico no timer.
            Registros sem tópico devem ser marcados manualmente.
          </p>
        )}
        </>
        )}

        {/* ── Modais ── */}
        {modalDate && (
          <BlockModal
            blockDate={modalDate}
            dateLabel={dateLabelOf(new Date(modalDate + 'T00:00:00'))}
            onClose={() => setModalDate(null)}
            onCreated={load}
          />
        )}

        {editingBlock && (
          <BlockModal
            blockDate={editingBlock.block_date}
            dateLabel={dateLabelOf(new Date(editingBlock.block_date + 'T00:00:00'))}
            editBlock={{
              id: editingBlock.id,
              subjectId: editingBlock.subject_id,
              topicId: editingBlock.topic_id,
              plannedMinutes: editingBlock.planned_minutes,
            }}
            onClose={() => setEditingBlock(null)}
            onCreated={load}
          />
        )}

        {(recurrenceOpen || editingRule) && (
          <RecurrenceModal
            editRule={editingRule}
            modoInicial={recurrenceMode}
            onClose={() => { setRecurrenceOpen(false); setEditingRule(null); }}
            onCreated={handleRecurrenceCreated}
          />
        )}

        {panelOpen && (
          <RecurrencePanel
            onClose={() => setPanelOpen(false)}
            onChanged={load}
            onEdit={handlePanelEdit}
          />
        )}

        {generatorOpen && (
          <GeneratorModal
            onClose={() => setGeneratorOpen(false)}
            onGenerated={() => { load(); checkCycle(); }}
          />
        )}

        {replanModalOpen && (
          <ReplanModal
            moves={replanMoves}
            applying={replanning}
            onConfirm={handleApplyReplan}
            onClose={() => setReplanModalOpen(false)}
          />
        )}
      </div>
    </>
  );
}

// ── BlockCard ──────────────────────────────────────────────────────────────────
// memo: só re-renderiza se block ou algum handler mudar.
// handlers são useCallback estáveis — cada toggle re-renderiza apenas 1 card.
const BlockCard = memo(function BlockCard({ block, onToggle, onDelete, onEdit, onSkip, onEditRule, listMode }: {
  block: ScheduleBlock;
  onToggle: (b: ScheduleBlock) => void;
  onDelete: (b: ScheduleBlock) => void;
  onEdit: (b: ScheduleBlock) => void;
  onSkip: (b: ScheduleBlock) => void;
  onEditRule: (b: ScheduleBlock) => void;
  listMode?: boolean;
}) {
  const cor = block.subjectColor ?? '#C9B8DD';
  const t = tons(cor);
  const isRec = block.origin === 'recorrencia';

  // Animação de pop no check ao marcar como concluído
  const [justChecked, setJustChecked] = useState(false);
  const prevDoneRef = useRef(block.is_done);
  useEffect(() => {
    if (block.is_done && !prevDoneRef.current) {
      setJustChecked(true);
      prevDoneRef.current = true;
      const timer = setTimeout(() => setJustChecked(false), 400);
      return () => clearTimeout(timer);
    }
    if (!block.is_done) prevDoneRef.current = false;
  }, [block.is_done]);

  return (
    <div style={{
      ...blockStyles.card,
      borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: t.border,
      background: theme.card,
      opacity: block.is_done ? 0.6 : 1,
      transition: 'opacity .3s ease',
      ...(listMode ? blockStyles.cardList : blockStyles.cardGrid),
    }}>
      <button
        onClick={() => onToggle(block)}
        className={`block-check${justChecked ? ' check-pop' : ''}`}
        style={{
          ...blockStyles.check,
          ...(listMode ? {} : blockStyles.checkSm),
          borderColor: block.is_done ? t.border : 'rgba(15,23,42,.2)',
          ...(block.is_done ? { background: t.border, color: '#fff' } : { background: 'transparent' }),
        }}
        aria-label="Concluir"
      >
        {block.is_done ? '✓' : ''}
      </button>
      <div style={blockStyles.info}>
        <div
          title={block.subjectName ?? 'Matéria'}
          style={{ ...blockStyles.name, ...(block.is_done ? { textDecoration: 'line-through', color: theme.inkSoft } : {}) }}
        >
          {isRec && <RepeatIcon size={10} color={t.border} mr={3} />}
          {block.subjectName ?? 'Matéria'}
        </div>
        <div title={block.topicName ?? undefined} style={blockStyles.sub}>
          {block.topicName ? `${block.topicName} · ` : ''}{block.planned_minutes}min
        </div>
      </div>
      <BlockMenu
        block={block}
        onEditManual={() => onEdit(block)}
        onDeleteManual={() => onDelete(block)}
        onSkipRecurrence={() => onSkip(block)}
        onEditRule={() => onEditRule(block)}
      />
    </div>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1080, margin: '0 auto', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 24 },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  toolbar: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 },
  toolbarRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', rowGap: 10 },
  toolbarActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line },
  nav: { display: 'flex', alignItems: 'center', gap: 10 },
  navBtn: { width: 44, height: 44, borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  weekLabel: { position: 'relative', fontSize: 15, fontWeight: 700, color: theme.ink, minWidth: 150, textAlign: 'center', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', fontFamily: 'inherit' },
  datePicker: { position: 'absolute', opacity: 0, width: '100%', height: '100%', left: 0, top: 0, cursor: 'pointer' },
  todayBtn: { padding: '8px 16px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  recBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  recBtnGhost: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  cycleBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  genBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  viewToggle: { display: 'flex', gap: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 3 },
  viewBtn: { padding: '7px 14px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  viewBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  footnote: { fontSize: 12, color: theme.inkFaint, margin: '24px 0 0', lineHeight: 1.5, textAlign: 'center' },

  // Skeleton
  skelLine: { height: 8, background: theme.muted, borderRadius: 4, width: '60%' },
  skelBlock: { borderRadius: 8, background: theme.muted },

  // Resumo semanal
  weekSummary: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: theme.card, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, marginBottom: 14 },
  weekSummaryLabel: { fontSize: 13, fontWeight: 600, color: theme.ink, whiteSpace: 'nowrap', minWidth: 0 },
  weekSummaryTrack: { flex: 1, height: 8, background: 'rgba(15,23,42,.08)', borderRadius: 999, overflow: 'hidden' },
  weekSummaryFill: { height: '100%', borderRadius: 999, transition: 'width .5s ease' },
  weekSummaryPct: { fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 36, textAlign: 'right' },

  // Cronograma vivo — banner de replanejamento
  replanBanner: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: theme.warnBg, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.warn, marginBottom: 14 },
  replanMsg: { fontSize: 13.5, color: theme.ink },
  replanBtn: { padding: '8px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.warn, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },

  // Callout semana vazia
  emptyCallout: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: theme.card, borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, marginBottom: 14 },
  emptyCalloutMsg: { fontSize: 13.5, color: theme.ink, margin: 0, lineHeight: 1.5, flex: 1, minWidth: 200 },
  emptyCalloutActions: { display: 'flex', gap: 8, flexShrink: 0 },

  // Grade
  weekGrid: { gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 8 },
  dayCol: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  dayHead: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '8px 4px', borderRadius: '10px 10px 0 0', borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line, borderLeftWidth: 0.5, borderLeftStyle: 'solid', borderLeftColor: theme.line, borderRightWidth: 0.5, borderRightStyle: 'solid', borderRightColor: theme.line, background: theme.card },
  dayHeadToday: { borderTopWidth: 2, borderTopStyle: 'solid', borderTopColor: theme.teal },
  dayName: { fontSize: 10, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' },
  dayNum: { fontSize: 18, fontWeight: 700, color: theme.ink, lineHeight: 1 },
  dayNumToday: { background: theme.teal, color: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 },
  progressWrap: { padding: '6px 10px 8px', borderLeftWidth: 0.5, borderLeftStyle: 'solid', borderLeftColor: theme.line, borderRightWidth: 0.5, borderRightStyle: 'solid', borderRightColor: theme.line, background: theme.card },
  progressLabels: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  progressText: { fontSize: 10, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  progressPct: { fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  progressTrack: { height: 6, background: 'rgba(15,23,42,.08)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width .4s ease' },
  progressEmpty: { fontSize: 10, color: theme.inkFaint, textAlign: 'center' },
  dayBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: 6, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: '0 0 10px 10px', minHeight: 180, background: theme.bg },
  addBtn: { marginTop: 'auto', padding: '7px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  // Lista
  listView: { flexDirection: 'column', gap: 14 },
  listDay: { background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  listDayEmpty: { background: 'transparent', boxShadow: 'none', borderColor: 'transparent', paddingTop: 10, paddingBottom: 10 },
  listDayHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' },
  listDayName: { fontSize: 15, fontWeight: 700, color: theme.ink },
  listDayRight: { display: 'flex', alignItems: 'center', gap: 12 },
  listDayLoad: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  addBtnSm: { padding: '5px 12px', borderRadius: 7, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: 'transparent', color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  listEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  listBlocks: { display: 'flex', flexDirection: 'column', gap: 8 },
};

const blockStyles: Record<string, React.CSSProperties> = {
  card: { display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 8, minWidth: 0, boxShadow: '0 1px 3px rgba(15,23,42,.06)' },
  cardGrid: { gap: 6, padding: '6px 8px' },
  cardList: { gap: 8, padding: '10px 14px' },
  check: { width: 18, height: 18, borderRadius: '50%', borderWidth: 1.5, borderStyle: 'solid', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 },
  checkSm: { width: 15, height: 15, fontSize: 9 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', wordBreak: 'break-word' },
  sub: { fontSize: 11, marginTop: 2, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
