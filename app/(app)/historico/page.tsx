// app/(app)/historico/page.tsx
// Histórico de sessões agrupado por dia, com filtro de período (atalhos) e busca
// por texto. Cada sessão expande para revelar feedback, insight, horário e modo.
'use client';

import { useState, useEffect, useMemo } from 'react';
import { theme } from '@/lib/theme';
import { getHistory, type HistoryDay, type HistorySession } from '@/services/history.service';

const PERIODOS = [
  { label: 'Hoje', dias: 1 },
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: 'Tudo', dias: 365 },
];

export default function HistoricoPage() {
  const [dias, setDias] = useState(7);
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    setLoading(true);
    getHistory(dias)
      .then((d) => setDays(d))
      .finally(() => setLoading(false));
  }, [dias]);

  function toggle(id: string) {
    setExpandido((cur) => (cur === id ? null : id));
  }

  // Filtra por texto (matéria, feedback, insight) dentro do período carregado.
  const daysFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return days;
    return days
      .map((day) => {
        const sessions = day.sessions.filter((s) => {
          const alvo = [s.subjectName, s.qualitativeFeedback ?? '', s.insight ?? '']
            .join(' ')
            .toLowerCase();
          return alvo.includes(termo);
        });
        if (sessions.length === 0) return null;
        const totalSec = sessions.reduce((acc, s) => acc + s.durationSec, 0);
        const totalQuestions = sessions.reduce((acc, s) => acc + s.questionsTotal, 0);
        return { ...day, sessions, totalSec, totalQuestions };
      })
      .filter((d): d is HistoryDay => d !== null);
  }, [days, busca]);

  const temResultado = daysFiltrados.length > 0;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Histórico</h1>
        <p style={styles.sub}>Suas sessões de estudo, dia a dia. Toque numa sessão para ver os detalhes.</p>
      </div>

      {/* Barra de filtros */}
      <div style={styles.filters}>
        <div style={styles.segment}>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              style={{ ...styles.segmentBtn, ...(dias === p.dias ? styles.segmentActive : {}) }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={styles.searchWrap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={styles.searchIcon}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar em anotações e matérias…"
            style={styles.search}
          />
          {busca && (
            <button onClick={() => setBusca('')} style={styles.clearBtn} aria-label="Limpar busca">✕</button>
          )}
        </div>
      </div>

      {loading && days.length === 0 ? (
        <p style={styles.muted}>Carregando…</p>
      ) : !temResultado ? (
        <p style={styles.muted}>
          {busca
            ? `Nada encontrado para "${busca}" no período selecionado.`
            : `Nenhuma sessão registrada no período selecionado.`}
        </p>
      ) : (
        daysFiltrados.map((day) => (
          <section key={day.dateKey} style={styles.daySection}>
            <div style={styles.dayHead}>
              <span style={styles.dayTitle}>{formataDia(day.dateKey)}</span>
              <span style={styles.daySummary}>
                {formataDuracao(day.totalSec)}
                {day.totalQuestions > 0 && ` · ${day.totalQuestions} questões`}
                {` · ${day.sessions.length} ${day.sessions.length === 1 ? 'sessão' : 'sessões'}`}
              </span>
            </div>

            <div style={styles.sessionList}>
              {day.sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  aberto={expandido === s.id}
                  onToggle={() => toggle(s.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function SessionRow({ session, aberto, onToggle }: { session: HistorySession; aberto: boolean; onToggle: () => void }) {
  const temDetalhe = !!(session.qualitativeFeedback || session.insight);
  const acerto = session.questionsTotal > 0
    ? Math.round((session.questionsCorrect / session.questionsTotal) * 100)
    : null;

  return (
    <div style={styles.row}>
      <button onClick={onToggle} style={styles.rowMain}>
        <span style={{ ...styles.subjectDot, background: session.subjectColor }} />
        <span style={styles.subjectName}>{session.subjectName}</span>

        <span style={styles.metaGroup}>
          <span style={styles.metaItem}>{formataDuracao(session.durationSec)}</span>
          {session.questionsTotal > 0 && (
            <span style={styles.metaItem}>
              {session.questionsCorrect}/{session.questionsTotal}
              {acerto !== null && <span style={styles.acerto}> ({acerto}%)</span>}
            </span>
          )}
          <EnergyMeter level={session.energyLevel} />
        </span>

        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={theme.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div style={styles.detail}>
          <div style={styles.detailMeta}>
            <span>{formataHora(session.startedAt)}</span>
            {session.mode && <span>· {traduzModo(session.mode)}</span>}
            {session.energyLevel !== null && <span>· energia {session.energyLevel}/5</span>}
          </div>

          {session.qualitativeFeedback ? (
            <div style={styles.detailBlock}>
              <span style={styles.detailLabel}>Como foi a sessão</span>
              <p style={styles.detailText}>{session.qualitativeFeedback}</p>
            </div>
          ) : null}

          {session.insight ? (
            <div style={styles.detailBlock}>
              <span style={styles.detailLabel}>Insight</span>
              <p style={styles.detailText}>{session.insight}</p>
            </div>
          ) : null}

          {!temDetalhe && (
            <p style={styles.semDetalhe}>Sem anotações nesta sessão.</p>
          )}
        </div>
      )}
    </div>
  );
}

function EnergyMeter({ level }: { level: number | null }) {
  if (level === null) return null;
  return (
    <span style={styles.energyWrap} title={`Energia ${level}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            ...styles.energyBar,
            background: n <= level ? theme.teal : theme.muted,
          }}
        />
      ))}
    </span>
  );
}

function formataDuracao(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function formataHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function traduzModo(mode: string): string {
  const m: Record<string, string> = {
    questoes: 'Questões',
    teoria: 'Teoria',
    revisao: 'Revisão',
    leitura: 'Leitura',
  };
  return m[mode] ?? mode;
}

function formataDia(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const data = new Date(y, m - 1, d);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const igual = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (igual(data, hoje)) return 'Hoje';
  if (igual(data, ontem)) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 760, margin: '0 auto', padding: '34px 40px', fontFamily: theme.font },
  header: { marginBottom: 18 },
  h1: { fontSize: 30, fontWeight: 800, color: theme.ink, letterSpacing: -0.8, margin: 0 },
  sub: { fontSize: 14.5, color: theme.inkSoft, margin: '6px 0 0', fontWeight: 500 },
  muted: { color: theme.inkFaint, fontSize: 14 },

  filters: { display: 'flex', gap: 12, marginBottom: 26, flexWrap: 'wrap', alignItems: 'center' },
  segment: { display: 'flex', gap: 3, padding: 3, background: theme.muted, borderRadius: 10, flexShrink: 0 },
  segmentBtn: { padding: '7px 14px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  segmentActive: { background: theme.card, color: theme.teal, boxShadow: theme.shadow },
  searchWrap: { position: 'relative', flex: 1, minWidth: 200, display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, pointerEvents: 'none' },
  search: { width: '100%', boxSizing: 'border-box', padding: '10px 34px 10px 36px', borderRadius: 10, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  clearBtn: { position: 'absolute', right: 10, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer' },

  daySection: { marginBottom: 26 },
  dayHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' },
  dayTitle: { fontSize: 15, fontWeight: 700, color: theme.ink, textTransform: 'capitalize', letterSpacing: -0.2 },
  daySummary: { fontSize: 12.5, color: theme.inkFaint, fontWeight: 500 },

  sessionList: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 12, boxShadow: theme.shadow, overflow: 'hidden' },
  rowMain: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  subjectDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  subjectName: { fontSize: 14.5, fontWeight: 600, color: theme.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  metaGroup: { display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 },
  metaItem: { fontSize: 13, color: theme.inkSoft, fontWeight: 500, whiteSpace: 'nowrap' },
  acerto: { color: theme.inkFaint },

  energyWrap: { display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 },
  energyBar: { width: 3, height: 14, borderRadius: 1 },

  detail: { padding: '4px 16px 16px', borderTop: `0.5px solid ${theme.line}` },
  detailMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12, color: theme.inkFaint, fontWeight: 500, margin: '12px 0 14px' },
  detailBlock: { marginBottom: 12 },
  detailLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  detailText: { fontSize: 14, color: theme.ink, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' },
  semDetalhe: { fontSize: 13, color: theme.inkFaint, fontStyle: 'italic', margin: 0 },
};