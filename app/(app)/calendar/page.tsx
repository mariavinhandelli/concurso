// app/(app)/calendar/page.tsx
// Calendário de planejamento: revisões, provas e lembretes manuais.
// Clicar num dia abre um painel de detalhes (bottom sheet no mobile, modal no desktop)
// com os eventos do dia + opção de adicionar/remover lembrete.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { listEvents, type CalendarEvent } from '@/services/calendar.service';
import { createReminder, deleteReminder } from '@/services/reminders.service';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';

type Mode = 'week' | 'month';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* Retorna fundo sutil por tipo para os chips nas células */
function chipBg(type: CalendarEvent['type'], color: string): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.10)`;
}

function EventIcon({ type, color, size = 11 }: { type: CalendarEvent['type']; color: string; size?: number }) {
  const sw = size >= 16 ? 1.8 : 2;
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
  };
  if (type === 'exam') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </svg>
    );
  }
  if (type === 'flashcard') {
    return (
      <svg {...common}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
      </svg>
    );
  }
  if (type === 'reminder') {
    return (
      <svg {...common}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    );
  }
  // topic (revisão)
  return (
    <svg {...common}>
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function tipoLabel(type: CalendarEvent['type']): string {
  if (type === 'exam') return 'Prova';
  if (type === 'flashcard') return 'Flashcards';
  if (type === 'reminder') return 'Lembrete';
  return 'Revisão';
}

export default function CalendarPage() {
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Dia selecionado (abre o painel de detalhes). null = painel fechado.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const { days, rangeStart, rangeEnd, label } = computeGrid(mode, anchor);

  const load = useCallback(async () => {
    setEvents(await listEvents(toLocalISO(rangeStart), toLocalISO(rangeEnd)));
  }, [rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load]);

  function navigate(dir: -1 | 1) {
    const next = new Date(anchor);
    if (mode === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  function eventsForDay(d: Date | string): CalendarEvent[] {
    const iso = typeof d === 'string' ? d : toLocalISO(d);
    return events.filter((e) => e.date === iso);
  }

  function abrirDia(dateISO: string) {
    setSelectedDay(dateISO);
    setReminderTitle('');
    setAdding(false);
  }

  function fecharDia() {
    setSelectedDay(null);
    setReminderTitle('');
    setAdding(false);
  }

  async function salvarLembrete() {
    if (!selectedDay || !reminderTitle.trim()) { setAdding(false); return; }
    try {
      await createReminder(reminderTitle, selectedDay);
      setReminderTitle('');
      setAdding(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar lembrete.');
    }
  }

  async function apagarLembrete(ev: CalendarEvent) {
    if (!ev.reminderId) return;
    if (!await confirm({ title: `Apagar o lembrete "${ev.label}"?`, confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteReminder(ev.reminderId);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar lembrete.');
    }
  }

  const todayISO = toLocalISO(new Date());
  const cellMinHeight = isMobile ? 58 : 96;
  const gridGap = isMobile ? 4 : 8;
  const maxEventsShown = isMobile ? 3 : 4;

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <>
    {dialog}
    <div style={{ ...styles.container, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      <div style={{ ...styles.header, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
        <div>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 28 }}>Calendário</h1>
          <p style={styles.sub}>{label}</p>
        </div>
        <div style={{ ...styles.controls, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          {/* Navegação temporal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="icon-touch-target" onClick={() => navigate(-1)} style={styles.navBtn} aria-label="Anterior">‹</button>
            <button className="touch-target" onClick={() => setAnchor(new Date())} style={styles.todayBtn}>Hoje</button>
            <button className="icon-touch-target" onClick={() => navigate(1)} style={styles.navBtn} aria-label="Próximo">›</button>
          </div>
          {/* Toggle de modo + lembrete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={styles.modeToggle}>
              <button className="touch-target" onClick={() => setMode('week')}
                style={{ ...styles.modeBtn, ...(mode === 'week' ? styles.modeBtnActive : {}) }}>Semana</button>
              <button className="touch-target" onClick={() => setMode('month')}
                style={{ ...styles.modeBtn, ...(mode === 'month' ? styles.modeBtnActive : {}) }}>Mês</button>
            </div>
            <button className="touch-target" onClick={() => abrirDia(todayISO)} style={styles.addReminderBtn}>+ Lembrete</button>
          </div>
        </div>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div style={{ ...styles.weekHeader, gap: gridGap }}>
        {WEEKDAYS.map((w) => <div key={w} style={styles.weekDay}>{isMobile ? w.charAt(0) : w}</div>)}
      </div>

      {/* Grade */}
      <div style={{ ...styles.grid, gap: gridGap }}>
        {days.map((d, i) => {
          const iso = toLocalISO(d);
          const dayEvents = eventsForDay(d);
          const isToday = iso === todayISO;
          const isOtherMonth = mode === 'month' && d.getMonth() !== anchor.getMonth();
          const isSelected = iso === selectedDay;
          return (
            <div
              key={i}
              style={{
                ...styles.cell,
                minHeight: cellMinHeight,
                padding: isMobile ? 5 : 8,
                ...(isOtherMonth ? styles.cellOther : {}),
                ...(isSelected ? styles.cellSelected : {}),
              }}
              onClick={() => abrirDia(iso)}
              title="Ver eventos do dia"
            >
              <span style={{ ...styles.dayNum, ...(isToday ? styles.dayNumToday : {}) }}>
                {d.getDate()}
              </span>
              <div style={styles.events}>
                {dayEvents.slice(0, maxEventsShown).map((e, j) => (
                  <div
                    key={j}
                    style={{
                      ...styles.event,
                      background: chipBg(e.type, e.color),
                    }}
                    title={e.label}
                  >
                    {/* Dot colorido por tipo */}
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, flexShrink: 0, display: 'inline-block' }} />
                    {!isMobile && <span style={styles.eventLabel}>{e.label}</span>}
                  </div>
                ))}
                {dayEvents.length > maxEventsShown && (
                  <span style={styles.more}>+{dayEvents.length - maxEventsShown} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ ...styles.legend, gap: isMobile ? '8px 12px' : 18 }}>
        {([
          { color: theme.ok,      label: 'Revisão de tópico' },
          { color: theme.clay,    label: 'Flashcards' },
          { color: theme.danger,  label: 'Prova' },
          { color: theme.primary, label: 'Lembrete' },
        ] as { color: string; label: string }[]).map((item) => (
          <span key={item.label} style={styles.legendItem}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block', flexShrink: 0 }} />
            {item.label}
          </span>
        ))}
      </div>

      {/* Painel de detalhes do dia — bottom sheet no mobile, modal no desktop */}
      {selectedDay && (
        <div
          style={{ ...styles.overlay, alignItems: isMobile ? 'flex-end' : 'center' }}
          onClick={fecharDia}
        >
          <div
            style={{
              ...styles.sheet,
              ...(isMobile ? styles.sheetMobile : styles.sheetDesktop),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pega-mão visual no mobile */}
            {isMobile && <div style={styles.grabber} />}

            <div style={styles.sheetHead}>
              <div>
                <div style={styles.sheetDate}>{formataDataExtenso(selectedDay)}</div>
                <div style={styles.sheetCount}>
                  {selectedEvents.length === 0 ? 'Nenhum evento' : `${selectedEvents.length} evento(s)`}
                </div>
              </div>
              <button onClick={fecharDia} style={styles.sheetClose} aria-label="Fechar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.inkSoft} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Lista de eventos do dia */}
            <div style={styles.sheetList}>
              {selectedEvents.length === 0 ? (
                <p style={styles.sheetEmpty}>Nada agendado para este dia.</p>
              ) : (
                selectedEvents.map((e, j) => {
                  const isReminder = e.type === 'reminder';
                  return (
                    <div key={j} style={{ ...styles.sheetItem }}>
                      {/* Ícone do tipo com fundo colorido sutil */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: chipBg(e.type, e.color),
                        display: 'grid', placeItems: 'center',
                      }}>
                        <EventIcon type={e.type} color={e.color} size={16} />
                      </div>
                      <div style={styles.sheetItemInfo}>
                        <span style={styles.sheetItemLabel}>{e.label}</span>
                        <span style={styles.sheetItemType}>{tipoLabel(e.type)}</span>
                      </div>
                      {isReminder && (
                        <button onClick={() => apagarLembrete(e)} style={styles.sheetItemDel} aria-label="Apagar lembrete">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Adicionar lembrete */}
            {adding ? (
              <div style={styles.addForm}>
                <input
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarLembrete();
                    if (e.key === 'Escape') setAdding(false);
                  }}
                  placeholder="Título do lembrete…"
                  autoFocus
                  style={styles.addInput}
                />
                <button onClick={salvarLembrete} style={styles.addSave}>Salvar</button>
                <button onClick={() => setAdding(false)} style={styles.addCancel}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} style={styles.addTrigger}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Adicionar lembrete neste dia
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function computeGrid(mode: Mode, anchor: Date) {
  if (mode === 'week') {
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
    const end = days[6];
    const label = `${start.getDate()}–${end.getDate()} de ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    return { days, rangeStart: start, rangeEnd: end, label };
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
    });
    const label = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    return { days, rangeStart: gridStart, rangeEnd: days[41], label };
  }
}

function formataDataExtenso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = WEEKDAYS[date.getDay()];
  return `${wd}, ${d} de ${MONTHS[m - 1]}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1080, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font, minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 12 },
  h1: { fontSize: 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500, textTransform: 'capitalize' },
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  addReminderBtn: { padding: '8px 14px', borderRadius: 10, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modeToggle: { display: 'flex', gap: 4, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: 12, marginRight: 4 },
  modeBtn: { padding: '6px 14px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  modeBtnActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
  navBtn: { width: 44, height: 44, borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center' },
  todayBtn: { padding: '8px 16px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 },
  weekDay: { textAlign: 'center', fontSize: 11.5, color: theme.inkFaint, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 },
  cell: {
    minWidth: 0, minHeight: 96, background: theme.card,
    borderRadius: 12, border: `0.5px solid ${theme.line}`,
    padding: 8, display: 'flex', flexDirection: 'column', gap: 4,
    overflow: 'hidden', cursor: 'pointer',
    transition: 'box-shadow .15s, border-color .15s',
  },
  cellOther: { background: 'transparent', opacity: 0.38 },
  cellSelected: { border: `1.5px solid ${theme.teal}`, boxShadow: `0 0 0 3px ${theme.tealBg}` },
  dayNum: { fontSize: 13, color: theme.inkSoft, fontWeight: 500, lineHeight: 1 },
  dayNumToday: {
    background: theme.teal, color: '#fff', borderRadius: '50%',
    width: 24, height: 24, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 700, fontSize: 13,
  },
  events: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  event: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 11.5, fontWeight: 500, color: theme.ink,
    borderRadius: 6, padding: '3px 7px',
    minWidth: 0, overflow: 'hidden',
  },
  eventLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 },
  more: { fontSize: 11, color: theme.inkFaint, fontWeight: 500, paddingLeft: 2 },
  legend: { display: 'flex', gap: 18, marginTop: 20, flexWrap: 'wrap', padding: '10px 0 0', borderTop: `0.5px solid ${theme.line}` },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.inkSoft, fontWeight: 500 },

  // --- Painel de detalhes (sheet/modal) ---
  overlay: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,28,30,.46)', display: 'flex', justifyContent: 'center', padding: 0 },
  sheet: { background: theme.card, boxShadow: '0 -8px 40px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', fontFamily: theme.font },
  sheetMobile: { width: '100%', maxHeight: '78dvh', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '10px 18px max(env(safe-area-inset-bottom), 20px)' },
  sheetDesktop: { width: 420, maxWidth: '92vw', maxHeight: '80vh', borderRadius: 18, padding: 22, alignSelf: 'center', boxShadow: theme.shadowHover },
  grabber: { width: 40, height: 4, borderRadius: 999, background: theme.line, margin: '4px auto 14px' },
  sheetHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetDate: { fontSize: 17, fontWeight: 700, color: theme.ink, textTransform: 'capitalize' },
  sheetCount: { fontSize: 13, color: theme.inkFaint, marginTop: 2 },
  sheetClose: { width: 44, height: 44, borderRadius: 10, border: 'none', background: theme.muted, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  sheetList: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  sheetEmpty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '20px 0', margin: 0 },
  sheetItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', background: theme.bg,
    borderRadius: 12, borderLeft: 'none', minWidth: 0,
    border: `0.5px solid ${theme.line}`,
  },
  sheetItemInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  sheetItemLabel: { fontSize: 14.5, color: theme.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sheetItemType: { fontSize: 12, color: theme.inkSoft, fontWeight: 400 },
  sheetItemDel: { width: 44, height: 44, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  addForm: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  addInput: { flex: 1, minWidth: 140, padding: '11px 14px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addSave: { padding: '11px 18px', borderRadius: 10, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  addCancel: { padding: '11px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  addTrigger: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: '12px 0', borderRadius: 10, border: `1px dashed ${theme.line}`, background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
};
