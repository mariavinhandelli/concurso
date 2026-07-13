// components/features/calendar/CalendarView.tsx
// Aba "Mês" do hub Agenda (M9): visão de eventos do calendário — revisões,
// flashcards, provas e lembretes — em grade Mês/Semana. Extraída da antiga
// página /calendar SEM alterar a lógica; o hub Agenda cuida do título e das
// abas. Mostra eventos (não blocos de estudo); blocos ficam nas abas
// Grade/Lista. Traz os próprios controles (nav + "+ Lembrete").
'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Clock, FileText, Layers, Bell, RefreshCw, Plus, type LucideIcon } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { listEvents, type CalendarEvent } from '@/services/calendar.service';
import { createReminder, deleteReminder } from '@/services/reminders.service';
import { getScheduleBlocks } from '@/services/scheduleEngine.service';
import { theme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUI } from '@/components/layout/UIContext';

type Mode = 'week' | 'month';

// M9 fase 2: além dos eventos, o Mês mostra os blocos de estudo planejados.
type EvType = CalendarEvent['type'] | 'block';
interface ViewEvent { date: string; type: EvType; label: string; color: string; reminderId?: string; }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function chipBg(type: EvType, color: string): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.10)`;
}

const EVENT_ICON: Record<EvType, LucideIcon> = {
  block: Clock, exam: FileText, flashcard: Layers, reminder: Bell, topic: RefreshCw,
};

function EventIcon({ type, color, size = 11 }: { type: EvType; color: string; size?: number }) {
  const sw = size >= 16 ? 1.8 : 2;
  const Icon = EVENT_ICON[type] ?? RefreshCw;
  return <Icon width={size} height={size} color={color} strokeWidth={sw} style={{ flexShrink: 0 }} />;
}

function tipoLabel(type: EvType): string {
  if (type === 'block') return 'Bloco de estudo';
  if (type === 'exam') return 'Prova';
  if (type === 'flashcard') return 'Flashcards';
  if (type === 'reminder') return 'Lembrete';
  return 'Revisão';
}

export function CalendarView() {
  const { isMobile } = useUI();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(new Date());

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const { days, rangeStart, rangeEnd, label } = computeGrid(mode, anchor);
  const startISO = toLocalISO(rangeStart);
  const endISO = toLocalISO(rangeEnd);

  // React Query cuida da carga/cache (sem efeito com setState); um erro deixa o
  // calendário vazio em vez de derrubar a página (o original não tratava a falha).
  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events', startISO, endISO],
    queryFn: () => listEvents(startISO, endISO),
    staleTime: 60_000,
  });
  // M9 fase 2: blocos de estudo planejados no intervalo, mostrados junto dos eventos.
  const { data: blocks = [] } = useQuery({
    queryKey: ['calendar-blocks', startISO, endISO],
    queryFn: () => getScheduleBlocks(startISO, endISO),
    staleTime: 60_000,
  });
  const allEvents = useMemo<ViewEvent[]>(() => {
    const blockEvents: ViewEvent[] = blocks.map((b) => ({
      date: b.block_date,
      type: 'block',
      label: `${b.subjectName ?? 'Estudo'}${b.topicName ? ` · ${b.topicName}` : ''} · ${b.planned_minutes}min`,
      color: b.subjectColor ?? '#C9B8DD',
    }));
    return [...(events as ViewEvent[]), ...blockEvents];
  }, [events, blocks]);
  const reload = () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] });

  function navigate(dir: -1 | 1) {
    const next = new Date(anchor);
    if (mode === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }

  function eventsForDay(d: Date | string): ViewEvent[] {
    const iso = typeof d === 'string' ? d : toLocalISO(d);
    return allEvents.filter((e) => e.date === iso);
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
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar lembrete.');
    }
  }

  async function apagarLembrete(ev: ViewEvent) {
    if (!ev.reminderId) return;
    if (!await confirm({ title: `Apagar o lembrete "${ev.label}"?`, confirmLabel: 'Apagar', danger: true })) return;
    try {
      await deleteReminder(ev.reminderId);
      reload();
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
      {/* Controles do calendário (o título "Agenda" e as abas vêm do hub) */}
      <div style={{ ...styles.controlsRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center' }}>
        <p style={styles.periodLabel}>{label}</p>
        <div style={{ ...styles.controls, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="icon-touch-target" onClick={() => navigate(-1)} style={styles.navBtn} aria-label="Anterior">‹</button>
            <button className="touch-target" onClick={() => setAnchor(new Date())} style={styles.todayBtn}>Hoje</button>
            <button className="icon-touch-target" onClick={() => navigate(1)} style={styles.navBtn} aria-label="Próximo">›</button>
          </div>
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

      <div style={{ ...styles.weekHeader, gap: gridGap }}>
        {WEEKDAYS.map((w) => <div key={w} style={styles.weekDay}>{isMobile ? w.charAt(0) : w}</div>)}
      </div>

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
                    style={{ ...styles.event, background: chipBg(e.type, e.color) }}
                    title={e.label}
                  >
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

      <div style={{ ...styles.legend, gap: isMobile ? '8px 12px' : 18 }}>
        {([
          { color: theme.teal,    label: 'Bloco de estudo' },
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

      {selectedDay && (
        <div
          style={{ ...styles.overlay, alignItems: isMobile ? 'flex-end' : 'center' }}
          onClick={fecharDia}
        >
          <div
            style={{ ...styles.sheet, ...(isMobile ? styles.sheetMobile : styles.sheetDesktop) }}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && <div style={styles.grabber} />}

            <div style={styles.sheetHead}>
              <div>
                <div style={styles.sheetDate}>{formataDataExtenso(selectedDay)}</div>
                <div style={styles.sheetCount}>
                  {selectedEvents.length === 0 ? 'Nenhum evento' : `${selectedEvents.length} evento(s)`}
                </div>
              </div>
              <button onClick={fecharDia} style={styles.sheetClose} aria-label="Fechar">
                <X size={18} color={theme.inkSoft} strokeWidth={1.9} />
              </button>
            </div>

            <div style={styles.sheetList}>
              {selectedEvents.length === 0 ? (
                <p style={styles.sheetEmpty}>Nada agendado para este dia.</p>
              ) : (
                selectedEvents.map((e, j) => {
                  const isReminder = e.type === 'reminder';
                  return (
                    <div key={j} style={{ ...styles.sheetItem }}>
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
                          <Trash2 size={16} color={theme.inkFaint} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {adding ? (
              <div style={styles.addForm}>
                <Input
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarLembrete();
                    if (e.key === 'Escape') setAdding(false);
                  }}
                  placeholder="Título do lembrete…"
                  autoFocus
                  style={{ flex: 1, minWidth: 140, padding: '11px 14px', borderRadius: 10, background: theme.bg }}
                />
                <Button onClick={salvarLembrete}>Salvar</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} style={styles.addTrigger}>
                <Plus size={16} strokeWidth={2} style={{ marginRight: 8 }} />
                Adicionar lembrete neste dia
              </button>
            )}
          </div>
        </div>
      )}
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
  controlsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' },
  periodLabel: { fontSize: 15, color: theme.ink, margin: 0, fontWeight: 700, textTransform: 'capitalize' },
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  addReminderBtn: { padding: '8px 14px', borderRadius: 10, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  modeToggle: { display: 'flex', gap: 4, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: theme.radiusSm, marginRight: 4 },
  modeBtn: { padding: '6px 14px', borderRadius: 9, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  modeBtnActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow, fontWeight: 600 },
  navBtn: { width: 44, height: 44, borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center' },
  todayBtn: { padding: '8px 16px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  weekHeader: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 },
  weekDay: { textAlign: 'center', fontSize: 12, color: theme.inkFaint, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 },
  cell: {
    minWidth: 0, minHeight: 96, background: theme.card,
    borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    padding: 8, display: 'flex', flexDirection: 'column', gap: 4,
    overflow: 'hidden', cursor: 'pointer',
    transition: 'box-shadow .15s, border-color .15s',
  },
  cellOther: { background: 'transparent', opacity: 0.38 },
  cellSelected: { border: `1.5px solid ${theme.teal}`, boxShadow: `0 0 0 3px ${theme.tealBg}` },
  dayNum: { fontSize: 13, color: theme.inkSoft, fontWeight: 500, lineHeight: 1 },
  dayNumToday: {
    background: theme.teal, color: theme.onTeal, borderRadius: '50%',
    width: 24, height: 24, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 700, fontSize: 13,
  },
  events: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  event: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 500, color: theme.ink,
    borderRadius: 6, padding: '3px 7px',
    minWidth: 0, overflow: 'hidden',
  },
  eventLabel: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 },
  more: { fontSize: 11, color: theme.inkFaint, fontWeight: 500, paddingLeft: 2 },
  legend: { display: 'flex', gap: 18, marginTop: 20, flexWrap: 'wrap', padding: '10px 0 0', borderTop: `0.5px solid ${theme.line}` },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.inkSoft, fontWeight: 500 },

  overlay: { position: 'fixed', inset: 0, zIndex: 60, background: 'var(--backdrop)', display: 'flex', justifyContent: 'center', padding: 0 },
  sheet: { background: theme.card, boxShadow: '0 -8px 40px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', fontFamily: theme.font },
  sheetMobile: { width: '100%', maxHeight: '78dvh', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '10px 18px max(env(safe-area-inset-bottom), 20px)' },
  sheetDesktop: { width: 420, maxWidth: '92vw', maxHeight: '80vh', borderRadius: 18, padding: 22, alignSelf: 'center', boxShadow: theme.shadowHover },
  grabber: { width: 40, height: 4, borderRadius: theme.radiusPill, background: theme.line, margin: '4px auto 14px' },
  sheetHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sheetDate: { fontSize: 17, fontWeight: 700, color: theme.ink, textTransform: 'capitalize' },
  sheetCount: { fontSize: 13, color: theme.inkFaint, marginTop: 2 },
  sheetClose: { width: 44, height: 44, borderRadius: 10, border: 'none', background: theme.muted, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  sheetList: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  sheetEmpty: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '20px 0', margin: 0 },
  sheetItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', background: theme.bg,
    borderRadius: theme.radiusSm, borderLeft: 'none', minWidth: 0,
    border: `0.5px solid ${theme.line}`,
  },
  sheetItemInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  sheetItemLabel: { fontSize: 15, color: theme.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sheetItemType: { fontSize: 12, color: theme.inkSoft, fontWeight: 400 },
  sheetItemDel: { width: 44, height: 44, borderRadius: theme.radiusXs, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
  addForm: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  addTrigger: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14, padding: '12px 0', borderRadius: 10, border: `1px dashed ${theme.line}`, background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
};
