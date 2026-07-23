// components/features/home/RetaFinalCard.tsx
// Modo Reta Final (M10): quando a prova mais próxima está a ≤30 dias, este card
// domina o topo da Home e reenquadra o estudo para a reta final — prontidão
// (Raio-X ponderado por peso), o playbook (revisar / fechar lacuna / praticar)
// e, nos últimos dias (≤3), uma checklist de véspera marcável. Trata a ansiedade
// pré-prova como feature. Aditivo e não-destrutivo: só reaproveita queries que já
// existem (React Query deduplica) e não altera nenhum dado.
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { listTargetExams, type TargetExam } from '@/services/targetExams.service';
import { getRaioX, NIVEL_LABEL, type RaioX, type NivelProntidao } from '@/services/raiox.service';
import { daysUntilExam, formatTargetLabel } from '@/lib/targets';
import { usePersistedState } from '@/hooks/usePersistedState';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

const LIMITE_RETA = 30;
const LIMITE_CHECKLIST = 3;

const NIVEL_COR: Record<NivelProntidao, string> = {
  construcao: theme.danger, progresso: theme.warn, quase_la: theme.teal, pronto: theme.ok,
};

const CHECKLIST: { id: string; label: string }[] = [
  { id: 'doc', label: 'Documento oficial com foto' },
  { id: 'insc', label: 'Comprovante de inscrição / local da prova' },
  { id: 'local', label: 'Local e sala conferidos no mapa' },
  { id: 'cedo', label: 'Planejar chegar ~1h antes' },
  { id: 'caneta', label: 'Caneta preta transparente' },
  { id: 'agua', label: 'Água e lanche leve' },
  { id: 'sono', label: 'Dormir cedo na véspera' },
];

function proximaProva(list: TargetExam[]): { exam: TargetExam; dias: number } | null {
  let best: { exam: TargetExam; dias: number } | null = null;
  for (const t of list) {
    if (!t.exam_date) continue;
    const dias = daysUntilExam(t.exam_date);
    if (dias < 0) continue; // ignora provas já realizadas
    if (!best || dias < best.dias) best = { exam: t, dias };
  }
  return best;
}

function tituloDias(dias: number): string {
  if (dias === 0) return 'É hoje';
  if (dias === 1) return 'Falta 1 dia';
  return `Faltam ${dias} dias`;
}

export function RetaFinalCard() {
  const router = useRouter();

  const { data: exams } = useQuery<TargetExam[]>({ queryKey: ['target-exams'], queryFn: listTargetExams });
  const prox = useMemo(() => proximaProva(exams ?? []), [exams]);
  const ativo = !!prox && prox.dias <= LIMITE_RETA;

  const { data: raiox } = useQuery<RaioX>({ queryKey: ['raiox'], queryFn: getRaioX, enabled: ativo });

  // Checklist persistida por prova (ids marcados unidos por vírgula → SSR-safe).
  const examId = prox?.exam.id ?? 'none';
  const [checkedStr, setCheckedStr] = usePersistedState<string>(
    `reta-final:checklist:${examId}`, '', (v) => v ?? '',
  );

  if (!ativo || !prox) return null;

  const { dias, exam } = prox;
  const critico = dias <= 7;
  const cor = critico ? theme.danger : theme.warn;
  const corBg = critico ? theme.dangerBg : theme.warnBg;
  const nome = formatTargetLabel(exam);
  const foco = raiox?.focoPrincipal ?? null;
  const temProntidao = !!raiox?.hasBlueprint && (raiox?.materias.length ?? 0) > 0;

  const checked = new Set(checkedStr ? checkedStr.split(',').filter(Boolean) : []);
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCheckedStr([...next].join(','));
  };
  const mostrarChecklist = dias <= LIMITE_CHECKLIST;
  const feitos = CHECKLIST.filter((i) => checked.has(i.id)).length;

  return (
    <div style={{ ...s.card, background: corBg, borderColor: cor }}>
      <div style={s.top}>
        <span style={{ ...s.eyebrow, color: cor }}>Reta final</span>
        <span style={{ ...s.diasNum, color: cor }}>{dias}</span>
      </div>

      <h2 style={s.titulo}>{tituloDias(dias)} para <span style={{ whiteSpace: 'nowrap' }}>{nome}</span></h2>

      {temProntidao && raiox ? (
        <p style={s.prontidao}>
          Se a prova fosse hoje: <b style={{ color: NIVEL_COR[raiox.nivel] }}>{raiox.score}</b> · {NIVEL_LABEL[raiox.nivel]}.
          {' '}Agora é consolidar, não começar do zero.
        </p>
      ) : (
        <p style={s.prontidao}>Foque em revisar o que já viu e fechar as lacunas de maior peso.</p>
      )}

      <div style={s.actions}>
        <Button onClick={() => router.push('/revisar')} style={{ background: cor, color: critico ? theme.onDanger : theme.onWarn }}>
          Revisar tudo
        </Button>
        {foco && (
          <Button variant="outline" onClick={() => router.push(`/subjects/${foco.subjectId}`)}>
            Fechar lacuna: {foco.subjectName}
          </Button>
        )}
        <Button variant="outline" onClick={() => router.push('/vademecum/simulado')}>
          Praticar questões
        </Button>
      </div>

      {mostrarChecklist && (
        <div style={s.checklist}>
          <div style={s.checkHead}>
            <span style={s.checkTitle}>Checklist da véspera</span>
            <span style={s.checkCount}>{feitos}/{CHECKLIST.length}</span>
          </div>
          {CHECKLIST.map((i) => {
            const on = checked.has(i.id);
            return (
              <button key={i.id} onClick={() => toggle(i.id)} style={s.checkItem}>
                <span style={{ ...s.checkbox, ...(on ? { background: cor, borderColor: cor } : {}) }}>
                  {on && <Check size={12} color={critico ? theme.onDanger : theme.onWarn} strokeWidth={3.2} />}
                </span>
                <span style={{ ...s.checkLabel, ...(on ? { color: theme.inkFaint, textDecoration: 'line-through' } : {}) }}>{i.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    border: `1px solid ${theme.warn}`,
    borderRadius: theme.radius,
    padding: 22,
    marginBottom: 16,
    fontFamily: theme.font,
    minWidth: 0,
  },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
  diasNum: { fontSize: 30, fontWeight: 800, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  titulo: { fontSize: 20, fontWeight: 800, color: theme.ink, letterSpacing: -0.4, margin: '2px 0 8px', lineHeight: 1.25 },
  prontidao: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.55, margin: '0 0 16px', maxWidth: 640 },

  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },

  checklist: { marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${theme.line}` },
  checkHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  checkTitle: { fontSize: 13, fontWeight: 700, color: theme.ink, letterSpacing: 0.3, textTransform: 'uppercase' },
  checkCount: { fontSize: 13, fontWeight: 600, color: theme.inkSoft, fontVariantNumeric: 'tabular-nums' },
  checkItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 4px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  checkbox: { width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${theme.line}`, background: theme.card, display: 'grid', placeItems: 'center', flexShrink: 0 },
  checkLabel: { fontSize: 14, color: theme.ink, fontWeight: 500 },
};
