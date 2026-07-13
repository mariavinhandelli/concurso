// app/(app)/historico/page.tsx
// Histórico de sessões agrupado por dia, com filtro de período (atalhos) e busca
// por texto. Cada sessão expande para revelar feedback, insight, horário e modo.
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search, X } from 'lucide-react';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/components/ui/ToastProvider';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { updateStudyLogDuration, deleteStudyLog } from '@/services/studyLogs.service';
import { getHistory, type HistoryDay, type HistorySession } from '@/services/history.service';
import { YearHeatmap } from '@/components/features/history/YearHeatmap';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const PERIODOS = [
  { label: 'Hoje', dias: 1 },
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: 'Tudo', dias: 365 },
];

export default function HistoricoPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const [dias, setDias] = useState(7);
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const reload = useCallback(() => {
    setLoading(true);
    getHistory(dias)
      .then((d) => setDays(d))
      .finally(() => setLoading(false));
  }, [dias]);

  useEffect(() => { reload(); }, [reload]);

  function toggle(id: string) {
    setExpandido((cur) => (cur === id ? null : id));
  }

  async function handleSaveDuration(id: string, minutes: number) {
    try {
      await updateStudyLogDuration(id, minutes);
      toast.success('Duração corrigida.');
      refreshHomeAfterSession(queryClient); // stats, streak e meta refletem a correção
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao corrigir a duração.');
    }
  }

  async function handleDelete(s: HistorySession) {
    const ok = await confirm({
      title: 'Apagar esta sessão?',
      description: `${s.subjectName} · ${formataDuracao(s.durationSec)}. As estatísticas, o streak e as metas serão recalculados sem ela.`,
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteStudyLog(s.id);
      toast.success('Sessão apagada.');
      refreshHomeAfterSession(queryClient);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao apagar a sessão.');
    }
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
    <PageContainer width="narrow">
      {dialog}
      <PageHeader title="Histórico" subtitle="Suas sessões de estudo, dia a dia. Toque numa sessão para ver os detalhes." />

      {/* Mapa de constância anual (estilo GitHub) — o retrato do hábito */}
      <YearHeatmap />

      {/* Barra de filtros */}
      <div style={styles.filters}>
        <div style={styles.segment}>
          {PERIODOS.map((p) => (
            <button
              className="touch-target"
              key={p.dias}
              onClick={() => setDias(p.dias)}
              style={{ ...styles.segmentBtn, ...(dias === p.dias ? styles.segmentActive : {}) }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar em anotações e matérias…"
            icon={
              <Search size={16} strokeWidth={1.9} />
            }
            style={{ borderRadius: 10, paddingRight: busca ? 34 : undefined }}
          />
          {busca && (
            <button onClick={() => setBusca('')} style={styles.clearBtn} aria-label="Limpar busca"><X size={14} strokeWidth={2} /></button>
          )}
        </div>
      </div>

      {loading && days.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Carregando histórico">
          <Skeleton width={140} height={14} />
          <Skeleton height={72} borderRadius={16} />
          <Skeleton height={72} borderRadius={16} />
          <Skeleton width={120} height={14} style={{ marginTop: 8 }} />
          <Skeleton height={72} borderRadius={16} />
        </div>
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
                  onSaveDuration={handleSaveDuration}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </PageContainer>
  );
}

function SessionRow({ session, aberto, onToggle, onSaveDuration, onDelete }: {
  session: HistorySession;
  aberto: boolean;
  onToggle: () => void;
  onSaveDuration: (id: string, minutes: number) => Promise<void>;
  onDelete: () => void;
}) {
  const temDetalhe = !!(session.qualitativeFeedback || session.insight);
  const acerto = session.questionsTotal > 0
    ? Math.round((session.questionsCorrect / session.questionsTotal) * 100)
    : null;

  // Correção de duração inline (typo no registro manual não pode ser eterno).
  const [editing, setEditing] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [h, setH] = useState('0');
  const [m, setM] = useState('0');

  function startEdit() {
    const totalMin = Math.round(session.durationSec / 60);
    setH(String(Math.floor(totalMin / 60)));
    setM(String(totalMin % 60));
    setEditing(true);
  }

  async function saveEdit() {
    const totalMin = (Number(h) || 0) * 60 + (Number(m) || 0);
    setSalvando(true);
    try {
      await onSaveDuration(session.id, totalMin);
      setEditing(false);
    } finally {
      setSalvando(false);
    }
  }

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

        <ChevronDown
          size={16} color={theme.inkFaint} strokeWidth={2}
          style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}
        />
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

          {/* Ações: corrigir duração / apagar */}
          <div style={styles.actionsRow}>
            {editing ? (
              <div style={styles.editRow}>
                <Input type="number" min="0" value={h} onChange={(e) => setH(e.target.value)} style={{ width: 58, padding: '7px 9px', fontSize: 14 }} aria-label="Horas" />
                <span style={styles.editUnit}>h</span>
                <Input type="number" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} style={{ width: 58, padding: '7px 9px', fontSize: 14 }} aria-label="Minutos" />
                <span style={styles.editUnit}>min</span>
                <Button size="sm" onClick={saveEdit} loading={salvando}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={salvando}>Cancelar</Button>
              </div>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={startEdit}>Corrigir duração</Button>
                <Button size="sm" variant="dangerSoft" onClick={onDelete}>Apagar sessão</Button>
              </>
            )}
          </div>
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
  muted: { color: theme.inkFaint, fontSize: 14 },

  filters: { display: 'flex', gap: 12, marginBottom: 26, flexWrap: 'wrap', alignItems: 'center' },
  segment: { display: 'flex', gap: 3, padding: 3, background: 'rgba(15,23,42,.06)', borderRadius: 10, flexShrink: 0 },
  segmentBtn: { padding: '7px 14px', borderRadius: 7, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  segmentActive: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },
  clearBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer' },

  daySection: { marginBottom: 26 },
  dayHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' },
  dayTitle: { fontSize: 15, fontWeight: 700, color: theme.ink, textTransform: 'capitalize', letterSpacing: -0.2 },
  daySummary: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },

  sessionList: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, boxShadow: theme.shadow, overflow: 'hidden' },
  rowMain: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  subjectDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  subjectName: { fontSize: 15, fontWeight: 600, color: theme.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  metaGroup: { display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 },
  metaItem: { fontSize: 13, color: theme.inkSoft, fontWeight: 500, whiteSpace: 'nowrap' },
  acerto: { color: theme.inkFaint },

  energyWrap: { display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 },
  energyBar: { width: 3, height: 14, borderRadius: 1 },

  detail: { padding: '4px 16px 16px', borderTop: `0.5px solid ${theme.line}` },
  actionsRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  editRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  editUnit: { fontSize: 13, color: theme.inkFaint, fontWeight: 500 },
  detailMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12, color: theme.inkFaint, fontWeight: 500, margin: '12px 0 14px' },
  detailBlock: { marginBottom: 12 },
  detailLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  detailText: { fontSize: 14, color: theme.ink, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' },
  semDetalhe: { fontSize: 13, color: theme.inkFaint, fontStyle: 'italic', margin: 0 },
};
