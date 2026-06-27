// components/features/goals/GoalsWidget.tsx
// Metas: progresso de HOJE e da SEMANA. Edição em horas + minutos separados.
'use client';

import { useEffect, useState } from 'react';
import {
  getGoalsSummary, setDailyTarget, type GoalsSummary,
} from '@/services/goals.service';
import { theme } from '@/lib/theme';

export function GoalsWidget() {
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const s = await getGoalsSummary();
      setSummary(s);
      setHours(String(Math.floor(s.targetMinutesPerDay / 60)));
      setMins(String(s.targetMinutesPerDay % 60));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar metas.');
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSaveTarget() {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(mins, 10) || 0;
    const totalMin = h * 60 + m;
    if (totalMin < 0) return;
    try {
      await setDailyTarget(totalMin);
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar meta.');
    }
  }

  if (!summary) {
    return <p style={styles.muted}>Carregando metas…</p>;
  }

  const noTarget = summary.targetMinutesPerDay === 0;
  const todayPct = noTarget ? 0
    : Math.min(100, Math.round((summary.todayMinutes / summary.targetMinutesPerDay) * 100));
  const weekPct = summary.weekTargetMinutes === 0 ? 0
    : Math.min(100, Math.round((summary.weekMinutes / summary.weekTargetMinutes) * 100));

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Metas</span>
        {!editing && (
          <button onClick={() => setEditing(true)} style={styles.editBtn}>
            {noTarget ? 'Definir meta' : 'Ajustar'}
          </button>
        )}
      </div>

      {editing ? (
        <div style={styles.editRow}>
          <input type="number" value={hours} onChange={(e) => setHours(e.target.value)}
            style={styles.numInput} min="0" />
          <span style={styles.unit}>h</span>
          <input type="number" value={mins} onChange={(e) => setMins(e.target.value)}
            style={styles.numInput} min="0" max="59" />
          <span style={styles.unit}>min/dia</span>
          <button onClick={handleSaveTarget} style={styles.saveBtn}>Salvar</button>
        </div>
      ) : noTarget ? (
        <p style={styles.muted}>Defina uma meta diária para acompanhar seu ritmo.</p>
      ) : (
        <div style={styles.blocks}>
          <div style={styles.block}>
            <div style={styles.blockHeader}>
              <span style={styles.blockLabel}>Hoje</span>
              <span style={styles.blockValue}>
                <b style={{ color: theme.ink, fontWeight: 600 }}>{todayPct}%</b>
                <span style={styles.frac}>{formatHM(summary.todayMinutes)} / {formatHM(summary.targetMinutesPerDay)}</span>
              </span>
            </div>
            <div style={styles.track}>
              <div style={{ ...styles.fill, width: `${todayPct}%`, background: theme.ok }} />
            </div>
          </div>

          <div style={styles.block}>
            <div style={styles.blockHeader}>
              <span style={styles.blockLabel}>Últimos 7 dias</span>
              <span style={styles.blockValue}>
                <b style={{ color: theme.ink, fontWeight: 600 }}>{weekPct}%</b>
                <span style={styles.frac}>{formatHM(summary.weekMinutes)} / {formatHM(summary.weekTargetMinutes)}</span>
              </span>
            </div>
            <div style={styles.track}>
              <div style={{ ...styles.fill, width: `${weekPct}%`, background: theme.tealSoft }} />
            </div>
          </div>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

// Formata minutos como "Xh Ymin" / "Xh" / "Ymin".
function formatHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  editBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0 },
  editRow: { display: 'flex', alignItems: 'center', gap: 8 },
  numInput: { width: 56, padding: 10, borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, fontSize: 14, color: theme.ink, fontFamily: 'inherit' },
  unit: { fontSize: 13, color: theme.inkFaint },
  saveBtn: { marginLeft: 'auto', padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.teal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  blocks: { display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center', flex: 1 },
  block: {},
  blockHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  blockLabel: { fontSize: 13, color: theme.inkSoft, fontWeight: 500 },
  blockValue: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 15 },
  frac: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  track: { height: 8, background: theme.muted, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, transition: 'width 0.4s cubic-bezier(.2,.7,.3,1)' },
  muted: { color: theme.inkFaint, fontSize: 14, margin: 0, fontFamily: theme.font },
  error: { color: theme.danger, fontSize: 13, marginTop: 12, marginBottom: 0, fontFamily: theme.font },
};