// app/(app)/calendar/page.tsx
// Calendário de planejamento: revisões, provas e lembretes manuais.
// Clicar num dia adiciona lembrete; clicar num lembrete oferece apagar.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { listEvents, type CalendarEvent } from '@/services/calendar.service';
import { createReminder, deleteReminder } from '@/services/reminders.service';
import { theme } from '@/lib/theme';

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

function EventIcon({ type, color }: { type: CalendarEvent['type']; color: string }) {
  const common = {
    width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none',
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
    // sino
    return (<svg {...common}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>);
  }
  // topic — livro
  return (<svg {...common}><path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" /><path d="M4 5v14" /></svg>);
}

export default function CalendarPage() {
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Estado do formulário de lembrete (data selecionada + título).
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');

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

  function eventsForDay(d: Date): CalendarEvent[] {
    const iso = toLocalISO(d);
    return events.filter((e) => e.date === iso);
  }

  function abrirAdicao(dateISO: string) {
    setAddingDate(dateISO);
    setReminderTitle('');
  }

  function fecharAdicao() {
    setAddingDate(null);
    setReminderTitle('');
  }

  async function salvarLembrete() {
    if (!addingDate || !reminderTitle.trim()) { fecharAdicao(); return; }
    try {
      await createReminder(reminderTitle, addingDate);
      fecharAdicao();
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>Calendário</h1>
          <p style={styles.sub}>{label}</p>
        </div>
        <div style={styles.controls}>
          <button onClick={() => abrirAdicao(todayISO)} style={styles.addReminderBtn}>+ Lembrete</button>
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

      {/* Formulário de novo lembrete (aparece ao clicar num dia ou no botão) */}
      {addingDate && (
        <div style={styles.reminderForm}>
          <span style={styles.reminderFormDate}>{formataDataExtenso(addingDate)}</span>
          <input
            value={reminderTitle}
            onChange={(e) => setReminderTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') salvarLembrete();
              if (e.key === 'Escape') fecharAdicao();
            }}
            placeholder="Título do lembrete…"
            autoFocus
            style={styles.reminderInput}
          />
          <input
            type="date"
            value={addingDate}
            onChange={(e) => setAddingDate(e.target.value)}
            style={styles.reminderDate}
          />
          <button onClick={salvarLembrete} style={styles.reminderSave}>Adicionar</button>
          <button onClick={fecharAdicao} style={styles.reminderCancel}>Cancelar</button>
        </div>
      )}

      {/* Cabeçalho dos dias da semana */}
      <div style={styles.weekHeader}>
        {WEEKDAYS.map((w) => <div key={w} style={styles.weekDay}>{w}</div>)}
      </div>

      {/* Grade */}
      <div style={styles.grid}>
        {days.map((d, i) => {
          const iso = toLocalISO(d);
          const dayEvents = eventsForDay(d);
          const isToday = iso === todayISO;
          const isOtherMonth = mode === 'month' && d.getMonth() !== anchor.getMonth();
          return (
            <div
              key={i}
              style={{ ...styles.cell, ...(isOtherMonth ? styles.cellOther : {}) }}
              onClick={() => abrirAdicao(iso)}
              title="Clique para adicionar um lembrete"
            >
              <span style={{ ...styles.dayNum, ...(isToday ? styles.dayNumToday : {}) }}>
                {d.getDate()}
              </span>
              <div style={styles.events}>
                {dayEvents.slice(0, 4).map((e, j) => {
                  const isReminder = e.type === 'reminder';
                  return (
                    <div
                      key={j}
                      style={{ ...styles.event, borderLeftColor: e.color, cursor: isReminder ? 'pointer' : 'default' }}
                      title={isReminder ? `${e.label} (clique para apagar)` : e.label}
                      onClick={(ev) => {
                        if (isReminder) { ev.stopPropagation(); apagarLembrete(e); }
                      }}
                    >
                      <EventIcon type={e.type} color={e.color} />
                      <span style={styles.eventLabel}>{e.label}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 4 && <span style={styles.more}>+{dayEvents.length - 4}</span>}
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
  return `${d} de ${MONTHS[m - 1]}`;
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
  reminderForm: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 12, boxShadow: theme.shadow, marginBottom: 16, flexWrap: 'wrap' },
  reminderFormDate: { fontSize: 13, fontWeight: 700, color: theme.teal, whiteSpace: 'nowrap' },
  reminderInput: { flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  reminderDate: { padding: '9px 10px', borderRadius: 8, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  reminderSave: { padding: '9px 16px', borderRadius: 8, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  reminderCancel: { padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 },
  weekDay: { textAlign: 'center', fontSize: 11.5, color: theme.inkFaint, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 },
  cell: { minWidth: 0, minHeight: 96, background: theme.card, borderRadius: 12, border: `0.5px solid ${theme.line}`, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden', cursor: 'pointer' },
  cellOther: { background: 'transparent', opacity: 0.45 },
  dayNum: { fontSize: 13, color: theme.inkSoft, fontWeight: 500 },
  dayNumToday: { background: theme.teal, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  events: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  event: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: theme.ink, background: theme.bg, borderRadius: 5, padding: '2px 5px', borderLeftWidth: 3, borderLeftStyle: 'solid', minWidth: 0, overflow: 'hidden' },
  eventLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 },
  more: { fontSize: 10, color: theme.inkFaint, fontWeight: 500 },
  legend: { display: 'flex', gap: 20, marginTop: 22, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.inkFaint },
};