'use client';

import { memo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTargetExams, updateTargetExamDate, createTargetExam, type TargetExam,
} from '@/services/targetExams.service';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

function daysUntil(d: string): number {
  const target = new Date(d + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function rotulo(t: TargetExam): string {
  return [t.boardName, t.orgao, t.cargo].filter(Boolean).join(' · ') || 'Concurso sem nome';
}

function sortTargets(list: TargetExam[]): TargetExam[] {
  return [...list].sort((a, b) => {
    if (!a.exam_date && !b.exam_date) return 0;
    if (!a.exam_date) return 1;
    if (!b.exam_date) return -1;
    return a.exam_date.localeCompare(b.exam_date);
  });
}

export const ExamCountdown = memo(function ExamCountdown() {
  const queryClient = useQueryClient();
  const [idx, setIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [pendingDate, setPendingDate] = useState('');

  const { data: rawTargets = [], isLoading } = useQuery<TargetExam[]>({
    queryKey: ['target-exams'],
    queryFn: listTargetExams,
  });

  const updateDate = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      updateTargetExamDate(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-exams'] });
      setEditingDate(false);
      setPendingDate('');
    },
  });

  const addExam = useMutation({
    mutationFn: () => createTargetExam({
      orgao: newName.trim() || 'Nova prova',
      exam_date: newDate || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-exams'] });
      setAdding(false);
      setNewName('');
      setNewDate('');
      setIdx(rawTargets.length);
    },
  });

  const sorted = sortTargets(rawTargets);
  const total = sorted.length;
  const safeIdx = total > 0 ? Math.min(idx, total - 1) : 0;
  const current = sorted[safeIdx] ?? null;

  function prev() { setIdx((i) => (i - 1 + total) % total); setEditingDate(false); }
  function next() { setIdx((i) => (i + 1) % total); setEditingDate(false); }

  /* ── Skeleton ── */
  if (isLoading) {
    return (
      <div style={styles.wrap}>
        <Skeleton width={130} height={9} borderRadius={4} />
        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Skeleton width={20} height={20} borderRadius={6} />
          <Skeleton height={14} borderRadius={4} style={{ flex: 1 }} />
          <Skeleton width={20} height={20} borderRadius={6} />
        </div>
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <Skeleton width={56} height={36} borderRadius={6} style={{ margin: '0 auto' }} />
          <Skeleton width={80} height={10} borderRadius={4} style={{ margin: '6px auto 0' }} />
        </div>
      </div>
    );
  }

  /* ── Formulário de nova prova ── */
  if (adding) {
    return (
      <div style={styles.wrap}>
        <div style={styles.header}>
          <span style={styles.eyebrow}>Nova prova</span>
          <button style={styles.cancelLink} onClick={() => { setAdding(false); setNewName(''); setNewDate(''); }}>
            cancelar
          </button>
        </div>
        <div style={styles.addForm}>
          <input
            style={styles.inputField}
            placeholder="Nome do concurso (ex: PRF, TJGO...)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            style={styles.inputField}
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...styles.saveBtn, opacity: addExam.isPending ? 0.6 : 1 }}
              onClick={() => addExam.mutate()}
              disabled={addExam.isPending}
            >
              {addExam.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
          {addExam.isError && (
            <p style={styles.errorMsg}>{(addExam.error as Error).message}</p>
          )}
        </div>
      </div>
    );
  }

  /* ── Estado vazio ── */
  if (total === 0) {
    return (
      <div style={styles.wrap}>
        <div style={styles.header}>
          <span style={styles.eyebrow}>Próxima prova</span>
          <button style={styles.addLink} onClick={() => setAdding(true)}>+ adicionar</button>
        </div>
        <p style={styles.emptyText}>Nenhuma prova no radar.</p>
      </div>
    );
  }

  /* ── Carrossel principal ── */
  const dias = current?.exam_date ? daysUntil(current.exam_date) : null;
  const passou = dias !== null && dias < 0;
  const critico = dias !== null && !passou && dias <= 7;
  const urgente = dias !== null && !passou && dias > 7 && dias <= 30;
  const numColor = passou ? theme.inkFaint
    : critico ? theme.crit
    : urgente ? theme.warn
    : theme.ok;

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.eyebrow}>Próxima prova</span>
        <button style={styles.addLink} onClick={() => setAdding(true)}>+ adicionar</button>
      </div>

      {/* Nav row: seta + nome + seta */}
      <div style={styles.navRow}>
        <button
          style={{ ...styles.arrow, visibility: total > 1 ? 'visible' : 'hidden' }}
          onClick={prev}
          aria-label="Anterior"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div style={styles.nameWrap}>
          <span style={styles.examName} title={rotulo(current!)}>
            {rotulo(current!)}
          </span>
          {total > 1 && (
            <div style={styles.dots}>
              {sorted.map((_, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.dot,
                    background: i === safeIdx ? theme.teal : theme.line,
                    width: i === safeIdx ? 14 : 5,
                  }}
                  onClick={() => { setIdx(i); setEditingDate(false); }}
                  aria-label={`Prova ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <button
          style={{ ...styles.arrow, visibility: total > 1 ? 'visible' : 'hidden' }}
          onClick={next}
          aria-label="Próximo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Contador / data */}
      {current?.exam_date ? (
        <div style={styles.countRow}>
          {passou ? (
            <span style={{ ...styles.bigNum, color: theme.inkFaint, fontSize: 13, fontWeight: 500 }}>realizada</span>
          ) : (
            <span style={{ ...styles.bigNum, color: numColor }}>{dias}</span>
          )}
          {!passou && (
            <div style={styles.countMeta}>
              <span style={{ color: numColor, fontSize: 12, fontWeight: 600 }}>
                {dias === 1 ? 'dia' : 'dias'}
              </span>
              <span style={styles.dateStr}>{fmtDate(current.exam_date)}</span>
            </div>
          )}
          {editingDate ? (
            <div style={styles.inlineDateEdit}>
              <input type="date" style={styles.dateInput} value={pendingDate} autoFocus
                onChange={(e) => setPendingDate(e.target.value)} />
              <button style={styles.confirmDateBtn}
                onClick={() => pendingDate && updateDate.mutate({ id: current.id, date: pendingDate })}
                disabled={!pendingDate || updateDate.isPending}>ok</button>
              <button style={styles.cancelDateBtn} onClick={() => { setEditingDate(false); setPendingDate(''); }}>✕</button>
            </div>
          ) : (
            <button style={styles.editDateBtn}
              onClick={() => { setPendingDate(current.exam_date ?? ''); setEditingDate(true); }}>
              editar
            </button>
          )}
        </div>
      ) : (
        /* Sem data */
        editingDate ? (
          <div style={styles.inlineDateEdit}>
            <input type="date" style={styles.dateInput} value={pendingDate} autoFocus
              onChange={(e) => setPendingDate(e.target.value)} />
            <button style={styles.confirmDateBtn}
              onClick={() => pendingDate && updateDate.mutate({ id: current!.id, date: pendingDate })}
              disabled={!pendingDate || updateDate.isPending}>ok</button>
            <button style={styles.cancelDateBtn} onClick={() => { setEditingDate(false); setPendingDate(''); }}>✕</button>
          </div>
        ) : (
          <div style={styles.noDateRow}>
            <span style={styles.noDateText}>Sem data definida</span>
            <button style={styles.setDateBtn} onClick={() => setEditingDate(true)}>Definir →</button>
          </div>
        )
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 10.5, fontWeight: 600, color: theme.inkFaint, letterSpacing: 0.8, textTransform: 'uppercase' },
  addLink: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  cancelLink: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  /* Nav */
  navRow: { display: 'flex', alignItems: 'center', gap: 6 },
  arrow: {
    width: 24, height: 24, borderRadius: 6, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.inkSoft, display: 'grid', placeItems: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  nameWrap: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' },
  examName: {
    fontSize: 13, fontWeight: 600, color: theme.ink, textAlign: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
  },
  dots: { display: 'flex', gap: 4, alignItems: 'center' },
  dot: { height: 5, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0, transition: 'width .2s ease, background .2s ease' },

  /* Countdown row */
  countRow: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  bigNum: { fontSize: 40, fontWeight: 700, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  countMeta: { display: 'flex', flexDirection: 'column', gap: 1 },
  dateStr: { fontSize: 11.5, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  editDateBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  /* No date */
  noDateRow: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' },
  noDateText: { fontSize: 12.5, color: theme.inkFaint },
  setDateBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  /* Inline date editor */
  inlineDateEdit: { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' },
  dateInput: {
    border: `0.5px solid ${theme.line}`, borderRadius: 7, padding: '4px 8px',
    fontSize: 12.5, fontFamily: 'inherit', color: theme.ink, background: theme.bg, outline: 'none',
  },
  confirmDateBtn: {
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  cancelDateBtn: {
    border: 'none', background: 'transparent', color: theme.inkFaint,
    fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px',
  },

  /* Add form */
  addForm: { display: 'flex', flexDirection: 'column', gap: 8 },
  inputField: {
    border: `0.5px solid ${theme.line}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 13, fontFamily: 'inherit', color: theme.ink, background: theme.bg,
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  saveBtn: {
    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  errorMsg: { fontSize: 11.5, color: theme.crit, margin: 0, textAlign: 'center' },
  emptyText: { fontSize: 13, color: theme.inkSoft, margin: 0 },
};
