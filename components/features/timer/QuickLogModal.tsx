// components/features/timer/QuickLogModal.tsx
// Quick-Log de questões: registrar um bloco de questões resolvido fora da
// plataforma em ~10 segundos. Matéria pré-selecionada pela última sessão,
// total + acertos, tempo sugerido automaticamente. Reaproveita saveStudyLog —
// mesmos efeitos de uma sessão real (saúde, ciclo, metas, streak).
'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { listSubjects, type Subject } from '@/services/subjects.service';
import { listTopics, type Topic } from '@/services/topics.service';
import { saveStudyLog, type ErrorCause } from '@/services/studyLogs.service';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastProvider';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { createSessionId, type PendingSession } from '@/lib/timer-storage';
import { theme } from '@/lib/theme';
import { Overlay } from '@/components/ui/Overlay';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  // Troca para o registro completo (ManualLogModal) sem perder o gesto do usuário.
  onSwitchToFull?: () => void;
}

const ERROR_CAUSES: { value: ErrorCause; label: string }[] = [
  { value: 'teoria', label: 'Teoria' },
  { value: 'interpretacao', label: 'Interpretação' },
  { value: 'tempo', label: 'Tempo' },
];

// Sugestão de duração: ~2 min por questão (editável).
const MIN_POR_QUESTAO = 2;

export function QuickLogModal({ onClose, onSaved, onSwitchToFull }: Props) {
  const sessionIdRef = useRef(createSessionId());
  const totalInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [qTotal, setQTotal] = useState('');
  const [qCorrect, setQCorrect] = useState('');
  const [minutes, setMinutes] = useState('');
  const [minutesTouched, setMinutesTouched] = useState(false);
  const [errorCause, setErrorCause] = useState<ErrorCause | null>(null);

  // Tópico é opcional e fica escondido atrás de um link — o fluxo padrão são 3 campos.
  const [topicOpen, setTopicOpen] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Matérias + matéria da última sessão, em paralelo. Pré-seleciona a última usada.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const [subs, lastRes] = await Promise.all([
          listSubjects(),
          supabase
            .from('study_logs')
            .select('subject_id')
            .not('subject_id', 'is', null)
            .order('started_at', { ascending: false })
            .limit(1),
        ]);
        if (cancelled) return;
        setSubjects(subs);
        const lastId = lastRes.data?.[0]?.subject_id as string | undefined;
        if (lastId && subs.some((s) => s.id === lastId)) setSubjectId(lastId);
        totalInputRef.current?.focus();
      } catch {
        if (!cancelled) setError('Erro ao carregar matérias. Recarregue a página.');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!topicOpen || !subjectId) { setTopics([]); setTopicId(''); return; }
    listTopics(subjectId).then(setTopics).catch(() => setTopics([]));
    setTopicId('');
  }, [topicOpen, subjectId]);

  // Duração sugerida acompanha o total enquanto o usuário não mexer no campo.
  useEffect(() => {
    if (minutesTouched) return;
    const total = Number(qTotal) || 0;
    setMinutes(total > 0 ? String(total * MIN_POR_QUESTAO) : '');
  }, [qTotal, minutesTouched]);

  const total = Number(qTotal) || 0;
  const correct = Number(qCorrect) || 0;
  const houveErro = total > 0 && qCorrect !== '' && total > correct;

  useEffect(() => {
    if (!houveErro && errorCause !== null) setErrorCause(null);
  }, [houveErro, errorCause]);

  async function handleSave() {
    if (!subjectId) { setError('Escolha uma matéria.'); return; }
    if (total <= 0) { setError('Informe quantas questões você fez.'); return; }
    if (qCorrect === '') { setError('Informe quantas você acertou.'); return; }
    if (correct > total) { setError('Os acertos não podem passar do total.'); return; }
    const totalMin = Number(minutes) || 0;
    if (totalMin <= 0) { setError('Informe o tempo gasto (em minutos).'); return; }

    setSaving(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Você precisa estar logado.'); setSaving(false); return; }

    const now = Date.now();
    const session: PendingSession = {
      userId: user.id,
      sessionId: sessionIdRef.current,
      topicId: topicId || null,
      subjectId,
      boardId: null,
      mode: 'questoes',
      startedAt: now - totalMin * 60 * 1000,
      endedAt: now,
      durationSec: totalMin * 60,
      source: 'manual',
    };

    try {
      await saveStudyLog(session, {
        mode: 'questoes',
        subjectId,
        topicId: topicId || null,
        qualitativeFeedback: '',
        energyLevel: 3,
        insight: '',
        questionsTotal: total,
        questionsCorrect: correct,
        errorCause: houveErro ? errorCause : null,
        reviewIntent: null,
      });
      const pct = Math.round((correct / total) * 100);
      toast.success(`${correct}/${total} registrado — ${pct}% de acerto`);
      refreshHomeAfterSession(queryClient);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !saving) handleSave();
  }

  return (
    <Overlay onClose={onClose} maxWidth={400} labelledBy="quicklog-modal-title">
      <div onKeyDown={onKeyDown}>
        <h2 id="quicklog-modal-title" style={{ ...styles.h2, display: 'flex', alignItems: 'center', gap: 6 }}>
          Questões rápidas <Zap size={16} strokeWidth={2} />
        </h2>
        <p style={styles.subtitle}>Resolveu questões em outro lugar? Registre em segundos.</p>

        <label style={styles.label}>Matéria</label>
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Selecione…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>

        <div style={styles.row2}>
          <div style={styles.col}>
            <label style={styles.label}>Fiz</label>
            <Input
              ref={totalInputRef}
              type="number" min="0" inputMode="numeric" placeholder="30"
              value={qTotal} onChange={(e) => setQTotal(e.target.value)}
            />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Acertei</label>
            <Input
              type="number" min="0" inputMode="numeric" placeholder="22"
              value={qCorrect} onChange={(e) => setQCorrect(e.target.value)}
            />
          </div>
          <div style={styles.colSmall}>
            <label style={styles.label}>Tempo</label>
            <div style={styles.minWrap}>
              <Input
                type="number" min="0" inputMode="numeric"
                value={minutes}
                onChange={(e) => { setMinutesTouched(true); setMinutes(e.target.value); }}
                style={{ paddingRight: 34 }}
              />
              <span style={styles.minUnit}>min</span>
            </div>
          </div>
        </div>

        {houveErro && (
          <>
            <label style={styles.label}>O que mais te derrubou? <span style={styles.opt}>(opcional)</span></label>
            <div style={styles.segment}>
              {ERROR_CAUSES.map((c) => {
                const sel = errorCause === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setErrorCause(sel ? null : c.value)}
                    style={{ ...styles.segBtn, ...(sel ? styles.segBtnActive : {}) }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!topicOpen ? (
          <button type="button" onClick={() => setTopicOpen(true)} style={styles.linkBtn} disabled={!subjectId}>
            + vincular a um tópico
          </button>
        ) : (
          <>
            <label style={styles.label}>Tópico <span style={styles.opt}>(opcional)</span></label>
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={topics.length === 0}>
              <option value="">— sem tópico específico —</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </>
        )}

        {error && <p role="alert" aria-live="polite" style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          {onSwitchToFull && (
            <button onClick={onSwitchToFull} style={styles.switchBtn}>
              Registrar sessão completa
            </button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? 'Salvando…' : 'Registrar'}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h2: { fontSize: 18, fontWeight: 700, color: theme.ink, margin: 0 },
  subtitle: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 6px' },
  row2: { display: 'flex', gap: 10 },
  col: { flex: 1, minWidth: 0 },
  colSmall: { flexBasis: 108, flexShrink: 0 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.inkSoft, margin: '14px 0 6px' },
  opt: { fontWeight: 400, color: theme.inkFaint },
  minWrap: { position: 'relative' },
  minUnit: { position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: theme.inkFaint, pointerEvents: 'none' },
  segment: { display: 'flex', gap: 6 },
  segBtn: { flex: 1, padding: '9px 8px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  segBtnActive: { borderColor: theme.teal, background: theme.teal, color: theme.onTeal, fontWeight: 600 },
  linkBtn: { display: 'block', marginTop: 14, padding: 0, border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 },
  switchBtn: { padding: 0, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' },
};
