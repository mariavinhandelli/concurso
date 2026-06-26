// app/(app)/calendar/page.tsx
// Calendário de planejamento: revisões, provas e lembretes manuais.
// Clicar num dia abre um painel de detalhes (bottom sheet no mobile, modal no desktop)
// com os eventos do dia + opção de adicionar/remover lembrete.
'use client';

import { useEffect, useState, useCallback } from 'react';
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

function EventIcon({ type, color, size = 11 }: { type: CalendarEvent['type']; color: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 },
  };
  if (type === 'exam') {
    return (<svg {...common}><path d="M4 21.4V2.6a.6.6 0 0 1 .6-.6h11.652a.6.6 0 0 1 .424.176l3.148 3.148A.6.6 0 0 1 20 5.75V21.4a.6.6 0 0 1-.6.6H4.6a.6.6 0 0 1-.6-.6"></path>
    <path d="M16 2v3.4a.6.6 0 0 0 .6.6H20"></path></svg>);
  }
  if (type === 'flashcard') {
    return (<svg {...common}><rect x="3" y="7" width="14" height="13" rx="2" /><path d="m21 12l-9 4l-9-4m18 4l-9 4l-9-4m18-8l-9 4l-9-4l9-4z" /></svg>);
  }
  if (type === 'reminder') {
    return (<svg {...common}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>);
  }
  return (<svg {...common}><path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" /><path d="M4 5v14" /></svg>);
}

function tipoLabel(type: CalendarEvent['type']): string {
  if (type === 'exam') return 'Prova';
  if (type === 'flashcard') return 'Flashcards';
  if (type === 'reminder') return 'Lembrete';
  return 'Revisão';
}

export default function CalendarPage() {
  const { isMobile } = useUI();
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
      alert(e instanceof Error ? e.message : 'Erro ao criar lembrete.');
    }
  }

  async function apagarLembrete(ev: CalendarEvent) {
    if (!ev.reminderId) return;
    if (!window.confirm(`Apagar o lembrete "${ev.label}"?`)) return;
    try {
      await deleteReminder(ev.reminderId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao apagar lembrete.');
    }
  }

  const todayISO = toLocalISO(new Date());
  const cellMinHeight = isMobile ? 58 : 96;
  const gridGap = isMobile ? 4 : 8;
  const maxEventsShown = isMobile ? 3 : 4;

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <div style={{ ...styles.container, padding: isMobile ? '20px 12px' : '34px 40px' }}>
      <div style={styles.header}>
        <div>
          <h1 style={{ ...styles.h1, fontSize: isMobile ? 24 : 30 }}>Calendário</h1>
          <p style={styles.sub}>{label}</p>
        </div>
        <div style={styles.controls}>
          <button onClick={() => abrirDia(todayISO)} style={styles.addReminderBtn}>+ Lembrete</button>
          <div style={styles.modeToggle}>
            <button onClick={() => setMode('week')}
              style={{ ...styles.modeBtn, ...(mode === 'week' ? styles.modeBtnActive : {}) }}>Semana</button>
            <button onClick={() => setMode('month')}
              style={{ ...styles.modeBtn, ...(mode === 'month' ? styles.modeBtnActive : {}) }}>Mês</button>
          </div>
          <button onClick={() => navigate(-1)} style={styles.navBtn} aria-label="Anterior">‹</button>
          <button onClick={() => setAnchor(new Date())} style={styles.todayBtn}>Hoje</button>
          <button onClick={() => navigate(1)} style={styles.navBtn} aria-label="Próximo">›</button>
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
                      borderLeftColor: e.color,
                      padding: isMobile ? '2px 3px' : '2px 5px',
                      justifyContent: isMobile ? 'center' : 'flex-start',
                    }}
                    title={e.label}
                  >
                    <EventIcon type={e.type} color={e.color} />
                    {!isMobile && <span style={styles.eventLabel}>{e.label}</span>}
                  </div>
                ))}
                {dayEvents.length > maxEventsShown && <span style={styles.more}>+{dayEvents.length - maxEventsShown}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={styles.legend}>
        <span style={styles.legendItem}><EventIcon type="topic" color={theme.inkFaint} /> Revisão de tópico</span>
        <span style={styles.legendItem}><EventIcon type="flashcard" color={theme.inkFaint} /> Flashcards</span>
        <span style={styles.legendItem}><EventIcon type="exam" color={theme.inkFaint} /> Prova</span>
        <span style={styles.legendItem}><EventIcon type="reminder" color={theme.inkFaint} /> Lembrete</span>
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
                    <div key={j} style={{ ...styles.sheetItem, borderLeftColor: e.color }}>
                      <EventIcon type={e.type} color={e.color} size={16} />
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500, textTransform: 'capitalize' },
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  addReminderBtn: { padding: '8px 14px', borderRadius: 10, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modeToggle: { display: 'flex', gap: 4, padding: 3, background: theme.muted, borderRadius: 12, marginRight: 4 },
  modeBtn: { padding: '6px 14px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  modeBtnActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
  navBtn: { width: 36, height: 36, borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center' },
  todayBtn: { padding: '8px 16px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 },
  weekDay: { textAlign: 'center', fontSize: 11.5, color: theme.inkFaint, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 },
  cell: { minWidth: 0, minHeight: 96, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden', cursor: 'pointer' },
  cellOther: { background: 'transparent', opacity: 0.45 },
  cellSelected: { border: `1.5px solid ${theme.teal}` },
  dayNum: { fontSize: 13, color: theme.inkSoft, fontWeight: 500 },
  dayNumToday: { background: theme.teal, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  events: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  event: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: theme.ink, background: theme.bg, borderRadius: 5, padding: '2px 5px', borderLeftWidth: 3, borderLeftStyle: 'solid', minWidth: 0, overflow: 'hidden' },
  eventLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 },
  more: { fontSize: 10, color: theme.inkFaint, fontWeight: 500 },
  legend: { display: 'flex', gap: 20, marginTop: 22, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.inkFaint },

  // --- Painel de detalhes (sheet/modal) ---
  overlay: { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,28,30,.46)', display: 'flex', justifyContent: 'center', padding: 0 },
  sheet: { background: theme.card, boxShadow: '0 -8px 40px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', fontFamily: theme.font },
  sheetMobile: { width: '100%', maxHeight: '78vh', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '10px 18px 24px' },
  sheetDesktop: { width: 420, maxWidth: '92vw', maxHeight: '80vh', borderRadius: 18, padding: 22, alignSelf: 'center', boxShadow: theme.shadowHover },
  grabber: { width: 40, height: 4, borderRadius: 999, background: theme.line, margin: '4px auto 14px' },
  sheetHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetDate: { fontSize: 17, fontWeight: 700, color: theme.ink, textTransform: 'capitalize' },
  sheetCount: { fontSize: 13, color: theme.inkFaint, marginTop: 2 },
  sheetClose: { width: 32, height: 32, borderRadius: 8, border: 'none', background: theme.muted, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  sheetList: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  sheetEmpty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '20px 0', margin: 0 },
  sheetItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: theme.bg, borderRadius: 10, borderLeftWidth: 3, borderLeftStyle: 'solid', minWidth: 0 },
  sheetItemInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  sheetItemLabel: { fontSize: 14.5, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sheetItemType: { fontSize: 12, color: theme.inkFaint },
  sheetItemDel: { width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  addForm: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  addInput: { flex: 1, minWidth: 140, padding: '11px 14px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  addSave: { padding: '11px 18px', borderRadius: 10, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  addCancel: { padding: '11px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  addTrigger: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: '12px 0', borderRadius: 10, border: `1px dashed ${theme.line}`, background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
};