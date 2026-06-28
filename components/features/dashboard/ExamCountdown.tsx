// components/features/dashboard/ExamCountdown.tsx
// Contagem regressiva derivada dos concursos-alvo do usuário (target_exams.exam_date).
// Cada usuário vê apenas os seus próprios concursos — dados isolados por RLS + filtro explícito.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listTargetExams, type TargetExam } from '@/services/targetExams.service';
import { theme } from '@/lib/theme';

function daysUntil(examDate: string): number {
  const target = new Date(examDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function rotulo(t: TargetExam): string {
  return [t.boardName, t.orgao, t.cargo].filter(Boolean).join(' · ') || 'Concurso sem nome';
}

export function ExamCountdown() {
  const router = useRouter();
  const [targets, setTargets] = useState<TargetExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    listTargetExams()
      .then(setTargets)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const comData = targets.filter((t) => t.exam_date);
  const semData = targets.filter((t) => !t.exam_date);

  if (loading) return <div style={styles.wrap}><p style={styles.muted}>Carregando…</p></div>;

  if (error) return <div style={styles.wrap}><p style={{ ...styles.muted, color: theme.danger }}>{error}</p></div>;

  if (targets.length === 0) {
    return (
      <div style={styles.wrap}>
        <div style={styles.header}>
          <span style={styles.eyebrow}>Contagem para a prova</span>
        </div>
        <div style={styles.emptyWrap}>
          <p style={styles.muted}>Nenhum concurso-alvo cadastrado.</p>
          <button onClick={() => router.push('/targets')} style={styles.linkBtn}>
            Cadastrar concurso →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.eyebrow}>Contagem para a prova</span>
        <button onClick={() => router.push('/targets')} style={styles.manageBtn}>Gerenciar</button>
      </div>

      <div style={styles.list}>
        {/* Concursos COM data — exibe contagem */}
        {comData.map((t) => {
          const dias = daysUntil(t.exam_date!);
          const passou = dias < 0;
          const critico = dias >= 0 && dias <= 7;
          const urgente = dias > 7 && dias <= 30;
          const numColor = passou ? theme.inkFaint : critico ? theme.crit : urgente ? theme.warn : theme.ok;

          return (
            <div key={t.id} style={{ ...styles.item, ...(t.is_primary ? styles.itemPrimary : {}) }}>
              <div style={styles.itemInfo}>
                <span style={styles.itemName}>{rotulo(t)}</span>
                <span style={styles.itemDate}>
                  {new Date(t.exam_date! + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div style={styles.itemCount}>
                {passou ? (
                  <span style={styles.passed}>realizada</span>
                ) : (
                  <>
                    <span style={{ ...styles.days, color: numColor }}>{dias}</span>
                    <span style={styles.daysLabel}>{dias === 1 ? 'dia' : 'dias'}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Concursos SEM data — convite para definir */}
        {semData.map((t) => (
          <div key={t.id} style={styles.itemNoDate} onClick={() => router.push('/targets')}>
            <div style={styles.itemInfo}>
              <span style={{ ...styles.itemName, color: theme.inkSoft }}>{rotulo(t)}</span>
              <span style={styles.itemDate}>{t.phase === 'pos' ? 'Pós-edital' : 'Pré-edital'}</span>
            </div>
            <span style={styles.setDateHint}>+ definir data</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: theme.font, width: '100%', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: 500, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase' },
  manageBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  emptyWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  linkBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' },
  muted: { color: theme.inkFaint, fontSize: 13, margin: 0 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 12, background: theme.bg, borderRadius: 12, padding: '12px 14px', border: `0.5px solid transparent` },
  itemPrimary: { border: `0.5px solid ${theme.teal}`, background: theme.tealBg },
  itemNoDate: { display: 'flex', alignItems: 'center', gap: 12, background: theme.bg, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', opacity: 0.65, border: `0.5px dashed ${theme.line}` },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  itemName: { fontSize: 13.5, color: theme.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemDate: { fontSize: 11.5, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  itemCount: { display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 },
  days: { fontSize: 28, fontWeight: 600, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  daysLabel: { fontSize: 11, color: theme.inkFaint },
  passed: { fontSize: 12, color: theme.inkFaint, fontStyle: 'italic' },
  setDateHint: { fontSize: 11.5, color: theme.teal, flexShrink: 0, fontWeight: 500 },
};
