// app/(app)/schedule/page.tsx
// Cronograma: Grade (7 colunas) ou Lista. Blocos manuais + recorrência (motor).
// Recorrência tem ícone de repetição. Cor do dia = carga cumprida.
// No mobile a Grade renderiza como Lista (7 colunas não cabem em tela estreita).
'use client';

import { useEffect, useState, useCallback } from 'react';
import { toggleBlockDone, deleteBlock } from '@/services/studyBlocks.service';
import {
  getScheduleBlocks, toggleRecurrenceDone, skipOccurrence, type ScheduleBlock,
} from '@/services/scheduleEngine.service';
import { listRuleSummaries, type RuleSummary } from '@/services/recurrence.service';
import { BlockModal } from '@/components/features/schedule/BlockModal';
import { RecurrenceModal } from '@/components/features/schedule/RecurrenceModal';
import { RecurrencePanel } from '@/components/features/schedule/RecurrencePanel';
import { BlockMenu } from '@/components/features/schedule/BlockMenu';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { getActiveCycleRule, archiveCycle, reactivateCycle } from '@/services/cycleEngine.service';
import { CycleView } from '@/components/features/schedule/CycleView';
import { GeneratorModal } from '@/components/features/schedule/GeneratorModal';

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

const PREFIXOS = ['direito', 'lingua', 'língua', 'nocoes', 'noções', 'legislacao', 'legislação', 'raciocinio', 'raciocínio'];
function abreviaMateria(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length < 2) return nome;
  if (PREFIXOS.includes(partes[0].toLowerCase())) {
    return `${partes[0][0].toUpperCase()}. ${partes.slice(1).join(' ')}`;
  }
  return nome;
}

function tons(hex: string): { bg: string; text: string; border: string } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.78);
  const dark = (c: number) => Math.round(c * 0.4);
  return {
    bg: `rgb(${mix(r)},${mix(g)},${mix(b)})`,
    border: hex,
    text: `rgb(${dark(r)},${dark(g)},${dark(b)})`,
  };
}

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

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function SchedulePage() {
  const { isMobile } = useUI();
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [view, setView] = useState<'semana' | 'lista' | 'ciclo'>('semana');
  const [cycleRuleId, setCycleRuleId] = useState<string | null>(null);
  const [viewingArchivedId, setViewingArchivedId] = useState<string | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'dia_fixo' | 'ciclo'>('dia_fixo');
  const [arquivarAposCriar, setArquivarAposCriar] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleSummary | null>(null);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const load = useCallback(async () => {
    try {
      const start = localDateStr(dias[0]);
      const end = localDateStr(dias[6]);
      setBlocks(await getScheduleBlocks(start, end));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);
  const checkCycle = useCallback(() => {
    getActiveCycleRule().then(setCycleRuleId).catch(() => setCycleRuleId(null));
  }, []);

  useEffect(() => { checkCycle(); }, [checkCycle]);

  // Botão Ciclo: se já existe ciclo ativo, abre a visualização; senão, abre o
  // modal de recorrência já no modo "ciclo".
  function handleCycleButton() {
    if (cycleRuleId) {
      setViewingArchivedId(null);
      setView('ciclo');
    } else {
      setRecurrenceMode('ciclo');
      setRecurrenceOpen(true);
    }
  }

  // Criar um novo ciclo havendo um ativo: o atual será arquivado quando o novo for criado.
  function iniciarNovoCiclo() {
    setArquivarAposCriar(cycleRuleId); // guarda o atual (pode ser null se não houver)
    setRecurrenceMode('ciclo');
    setRecurrenceOpen(true);
  }

  // Reativar um ciclo arquivado (com aviso se houver um ativo a ser trocado).
  async function handleReativar(id: string) {
    const temAtivo = !!cycleRuleId && cycleRuleId !== id;
    const msg = temAtivo
      ? 'Reativar este ciclo? O ciclo ativo atual será arquivado no lugar.'
      : 'Reativar este ciclo? Ele voltará a ser o ciclo ativo.';
    if (!window.confirm(msg)) return;
    try {
      await reactivateCycle(id);
      setViewingArchivedId(null);
      await checkCycle();
      setView('ciclo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao reativar.');
    }
  }

  function abrirRecorrencia() {
    setRecurrenceMode('dia_fixo');
    setRecurrenceOpen(true);
  }

  function blocksOf(date: Date): ScheduleBlock[] {
    const key = localDateStr(date);
    return blocks.filter((b) => b.block_date === key);
  }

  async function handleToggle(b: ScheduleBlock) {
    setBlocks((prev) => prev.map((x) => x.id === b.id ? { ...x, is_done: !x.is_done } : x));
    try {
      if (b.origin === 'manual') {
        await toggleBlockDone(b.id, !b.is_done);
      } else {
        await toggleRecurrenceDone(b, !b.is_done);
        load();
      }
    } catch {
      load();
    }
  }

  async function handleDelete(b: ScheduleBlock) {
    if (b.origin !== 'manual') return;
    setBlocks((prev) => prev.filter((x) => x.id !== b.id));
    try {
      await deleteBlock(b.id);
    } catch {
      load();
    }
  }

  async function handleSkip(b: ScheduleBlock) {
    try {
      await skipOccurrence(b);
      load();
    } catch {
      load();
    }
  }

  async function handleEditRule(b: ScheduleBlock) {
    if (!b.rule_id) return;
    const todas = await listRuleSummaries();
    const alvo = todas.find((r) => r.id === b.rule_id) ?? null;
    if (alvo) setEditingRule(alvo);
  }

  function dayLoad(date: Date): { planned: number; done: number; pct: number } {
    const bs = blocksOf(date);
    const planned = bs.reduce((s, b) => s + b.planned_minutes, 0);
    const done = bs.filter((b) => b.is_done).reduce((s, b) => s + b.planned_minutes, 0);
    const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
    return { planned, done, pct };
  }

  const isToday = (d: Date) => localDateStr(d) === localDateStr(new Date());

  function navWeek(deltaWeeks: number) {
    const x = new Date(weekStart);
    x.setDate(x.getDate() + deltaWeeks * 7);
    setWeekStart(x);
  }

  const weekLabel = `${dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;

  function dateLabelOf(d: Date): string {
    return `${DIAS[(d.getDay() + 6) % 7]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  }

  function fmtH(min: number): string {
    return `${Math.round(min / 60 * 10) / 10}h`;
  }

  const cicloAtivo = !!cycleRuleId;
  // Qual ciclo o CycleView mostra: o arquivado aberto (se houver) ou o ativo.
  const cycleViewId = viewingArchivedId ?? cycleRuleId;

  // No mobile, a "Grade" não cabe (7 colunas) — renderiza como Lista.
  const mostrarGrade = view === 'semana' && !isMobile;
  const mostrarLista = view === 'lista' || (view === 'semana' && isMobile);

  return (
    <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.h1, fontSize: isMobile ? 25 : 28 }}>Cronograma</h1>
      </div>

      {/* Barra de controles — duas linhas */}
      <div style={styles.toolbar}>
        {/* Linha 1: navegação (esq) + visualização (dir) */}
        <div style={styles.toolbarRow}>
          <div style={styles.nav}>
            <button style={styles.navBtn} onClick={() => navWeek(-1)} aria-label="Semana anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              style={styles.weekLabel}
              title="Ir para uma data"
              onClick={(e) => {
                const inp = (e.currentTarget.querySelector('input[type=date]') as HTMLInputElement | null);
                if (inp) { inp.showPicker ? inp.showPicker() : inp.focus(); }
              }}
            >
              {weekLabel}
              <input
                type="date"
                onChange={(e) => { if (e.target.value) setWeekStart(mondayOf(new Date(e.target.value + 'T12:00:00'))); }}
                style={styles.datePicker}
              />
            </button>
            <button style={styles.navBtn} onClick={() => navWeek(1)} aria-label="Próxima semana">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button style={styles.todayBtn} onClick={() => setWeekStart(mondayOf(new Date()))}>Hoje</button>
          </div>

          <div style={styles.viewToggle}>
            {/* "Grade" não aparece no mobile (vira Lista de qualquer forma) */}
            {!isMobile && (
              <button onClick={() => setView('semana')} style={{ ...styles.viewBtn, ...(view === 'semana' ? styles.viewBtnOn : {}) }}>Grade</button>
            )}
            <button onClick={() => setView('lista')} style={{ ...styles.viewBtn, ...(mostrarLista ? styles.viewBtnOn : {}) }}>Lista</button>
            {cicloAtivo && (
              <button onClick={() => { setViewingArchivedId(null); setView('ciclo'); }} style={{ ...styles.viewBtn, ...(view === 'ciclo' ? styles.viewBtnOn : {}) }}>Ciclo</button>
            )}
          </div>
        </div>

        {/* Linha 2: ações de montar cronograma — no mobile: primária full + 3 compactos */}
        <div style={{ ...styles.toolbarActions, flexDirection: isMobile ? 'column' : 'row' }}>
          <button onClick={() => setGeneratorOpen(true)} style={{ ...styles.genBtn, justifyContent: 'center', width: isMobile ? '100%' : undefined }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 6 }}>
              <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
            </svg>
            Gerar do edital
          </button>

          {/* Trio compacto — no mobile divide a linha igualmente (1/3 cada) */}
          <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto' }}>
            <button onClick={handleCycleButton} style={{ ...styles.cycleBtn, justifyContent: 'center', flex: isMobile ? 1 : undefined }}>
              <CycleIcon size={14} color={theme.teal} mr={6} />
              {cicloAtivo ? 'Ver ciclo' : 'Criar ciclo'}
            </button>
            <button onClick={abrirRecorrencia} style={{ ...styles.recBtn, justifyContent: 'center', flex: isMobile ? 1 : undefined }}>
              <RepeatIcon size={14} color={theme.teal} mr={6} />
              Recorrência
            </button>
            <button onClick={() => setPanelOpen(true)} style={{ ...styles.recBtnGhost, justifyContent: 'center', flex: isMobile ? 1 : undefined }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 6 }}>
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
              Gerenciar
            </button>
          </div>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p style={styles.muted}>Carregando…</p>
      ) : view === 'ciclo' && cycleViewId ? (
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
      ) : mostrarGrade ? (
        <div style={styles.weekGrid}>
          {dias.map((d, i) => {
            const bs = blocksOf(d);
            const { done, planned, pct } = dayLoad(d);
            return (
              <div key={i} style={styles.dayCol}>
                <div style={{ ...styles.dayHead, ...(isToday(d) ? styles.dayHeadToday : {}) }}>
                  <span style={styles.dayName}>{DIAS[i]}</span>
                  <span style={styles.dayNum}>{d.getDate()}</span>
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
                      onToggle={() => handleToggle(b)}
                      onDelete={() => handleDelete(b)}
                      onEdit={() => setEditingBlock(b)}
                      onSkip={() => handleSkip(b)}
                      onEditRule={() => handleEditRule(b)}
                    />
                  ))}
                  <button style={styles.addBtn} onClick={() => setModalDate(localDateStr(d))}>+ bloco</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={styles.listView}>
          {dias.map((d, i) => {
            const bs = blocksOf(d);
            const { done, planned, pct } = dayLoad(d);
            return (
              <div key={i} style={styles.listDay}>
                <div style={styles.listDayHead}>
                  <span style={{ ...styles.listDayName, ...(isToday(d) ? { color: theme.teal } : {}) }}>
                    {DIAS[i]}, {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <div style={styles.listDayRight}>
                    {planned > 0 && <span style={styles.listDayLoad}>{fmtH(done)}/{fmtH(planned)} · {pct}%</span>}
                    <button style={styles.addBtnSm} onClick={() => setModalDate(localDateStr(d))}>+ bloco</button>
                  </div>
                </div>
                {bs.length === 0 ? (
                  <p style={styles.listEmpty}>Sem blocos.</p>
                ) : (
                  <div style={styles.listBlocks}>
                    {bs.map((b) => (
                      <BlockCard
                        key={b.id}
                        block={b}
                        onToggle={() => handleToggle(b)}
                        onDelete={() => handleDelete(b)}
                        onEdit={() => setEditingBlock(b)}
                        onSkip={() => handleSkip(b)}
                        onEditRule={() => handleEditRule(b)}
                        listMode
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Frase de instrução — rodapé discreto */}
      <p style={styles.footnote}>
        O bloco só é concluído automaticamente quando você registra o estudo específico no timer. Registros sem tópico devem ser marcados manualmente.
      </p>

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
          onCreated={async () => {
            // Se havia um ciclo ativo a substituir, arquiva agora que o novo foi criado.
            if (arquivarAposCriar) {
              try { await archiveCycle(arquivarAposCriar); } catch { /* segue mesmo se falhar */ }
              setArquivarAposCriar(null);
            }
            load();
            checkCycle();
          }}
        />
      )}

      {panelOpen && (
        <RecurrencePanel
          onClose={() => setPanelOpen(false)}
          onChanged={load}
          onEdit={async (ruleId) => {
            const todas = await listRuleSummaries();
            const alvo = todas.find((r) => r.id === ruleId) ?? null;
            if (alvo) {
              setPanelOpen(false);
              setEditingRule(alvo);
            }
          }}
        />
      )}
      {generatorOpen && (
        <GeneratorModal
          onClose={() => setGeneratorOpen(false)}
          onGenerated={() => { load(); checkCycle(); }}
        />
      )}
    </div>
  );
}

function BlockCard({ block, onToggle, onDelete, onEdit, onSkip, onEditRule, listMode }: {
  block: ScheduleBlock; onToggle: () => void; onDelete: () => void;
  onEdit: () => void; onSkip: () => void; onEditRule: () => void; listMode?: boolean;
}) {
  const cor = block.subjectColor ?? '#C9B8DD';
  const t = tons(cor);
  const isRec = block.origin === 'recorrencia';
  return (
    <div style={{
      ...blockStyles.card,
      borderLeftWidth: 3,
      borderLeftStyle: 'solid',
      borderLeftColor: t.border,
      background: t.bg,
      opacity: block.is_done ? 0.6 : 1,
      ...(listMode ? blockStyles.cardList : {}),
    }}>
      <button
        onClick={onToggle}
        style={{
          ...blockStyles.check,
          borderColor: t.border,
          ...(block.is_done ? { background: t.border, color: '#fff' } : { background: '#fff' }),
        }}
        aria-label="Concluir"
      >
        {block.is_done ? '✓' : ''}
      </button>
      <div style={blockStyles.info}>
        <div style={{ ...blockStyles.name, color: t.text, ...(block.is_done ? { textDecoration: 'line-through' } : {}) }}>
          {isRec && <RepeatIcon size={11} color={t.border} mr={4} />}
          {abreviaMateria(block.subjectName ?? 'Matéria')}
        </div>
        <div style={{ ...blockStyles.sub, color: t.border }}>
          {block.topicName ? `${block.topicName} · ` : ''}{block.planned_minutes}min
        </div>
      </div>
      <BlockMenu
        block={block}
        onEditManual={onEdit}
        onDeleteManual={onDelete}
        onSkipRecurrence={onSkip}
        onEditRule={onEditRule}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1100, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  header: { marginBottom: 18 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  toolbar: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 },
  toolbarRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  toolbarActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line },
  nav: { display: 'flex', alignItems: 'center', gap: 10 },
  navBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.teal, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  weekLabel: { position: 'relative', fontSize: 15, fontWeight: 700, color: theme.ink, minWidth: 150, textAlign: 'center', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', fontFamily: 'inherit' },
  datePicker: { position: 'absolute', opacity: 0, width: '100%', height: '100%', left: 0, top: 0, cursor: 'pointer' },
  todayBtn: { padding: '7px 14px', borderRadius: 8, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  recBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  recBtnGhost: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  cycleBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal,  background: theme.card, color: theme.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  genBtn: { display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  viewToggle: { display: 'flex', gap: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, padding: 3 },
  viewBtn: { padding: '7px 16px', border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderRadius: theme.radiusSm - 2 },
  viewBtnOn: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  error: { color: theme.danger, fontSize: 13, marginBottom: 12 },
  muted: { color: theme.inkFaint, fontSize: 14 },
  footnote: { fontSize: 12, color: theme.inkFaint, margin: '24px 0 0', lineHeight: 1.5, textAlign: 'center' },
  weekGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 },
  dayCol: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  dayHead: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '8px 4px', borderRadius: '10px 10px 0 0', borderTopWidth: 0.5, borderTopStyle: 'solid', borderTopColor: theme.line, borderLeftWidth: 0.5, borderLeftStyle: 'solid', borderLeftColor: theme.line, borderRightWidth: 0.5, borderRightStyle: 'solid', borderRightColor: theme.line, background: theme.card },
  dayHeadToday: { borderTopWidth: 2, borderTopStyle: 'solid', borderTopColor: theme.teal },
  dayName: { fontSize: 11, fontWeight: 700, color: theme.inkSoft, textTransform: 'uppercase' },
  dayNum: { fontSize: 17, fontWeight: 700, color: theme.ink },
  progressWrap: { padding: '6px 10px 8px', borderLeftWidth: 0.5, borderLeftStyle: 'solid', borderLeftColor: theme.line, borderRightWidth: 0.5, borderRightStyle: 'solid', borderRightColor: theme.line, background: theme.card },
  progressLabels: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  progressText: { fontSize: 10, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  progressPct: { fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  progressTrack: { height: 5, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, transition: 'width .4s ease' },
  progressEmpty: { fontSize: 10, color: theme.inkFaint, textAlign: 'center' },
  dayBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, padding: 6, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: '0 0 10px 10px', minHeight: 180, background: theme.bg },
  addBtn: { marginTop: 'auto', padding: '7px', borderRadius: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.line, background: 'transparent', color: theme.inkFaint, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  listView: { display: 'flex', flexDirection: 'column', gap: 14 },
  listDay: { background: theme.card, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 16, minWidth: 0 },
  listDayHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' },
  listDayName: { fontSize: 15, fontWeight: 700, color: theme.ink },
  listDayRight: { display: 'flex', alignItems: 'center', gap: 12 },
  listDayLoad: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  addBtnSm: { padding: '5px 12px', borderRadius: 7, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.teal, background: 'transparent', color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  listEmpty: { fontSize: 13, color: theme.inkFaint, margin: 0 },
  listBlocks: { display: 'flex', flexDirection: 'column', gap: 8 },
};

const blockStyles: Record<string, React.CSSProperties> = {
  card: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, minWidth: 0 },
  cardList: { padding: '10px 14px' },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderStyle: 'solid', fontSize: 11, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  del: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12, cursor: 'pointer', opacity: 0.5, flexShrink: 0 },
};