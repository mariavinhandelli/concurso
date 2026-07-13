// components/features/home/CoachSemanal.tsx
// Coach semanal: banner discreto na Home ("seu resumo está pronto") que abre
// um modal com a leitura narrativa da semana — reusa dados que já existem
// (energia, causa de erro, tópicos negligenciados, Raio-X). Sem chamada de
// IA: é geração determinística de texto a partir de sinais reais.
// Dispensa por semana (localStorage), mesmo padrão do Marco do Edital.
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, X } from 'lucide-react';
import { getCoachSemanal, type CoachResumo } from '@/services/coach.service';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Overlay } from '@/components/ui/Overlay';
import { IconButton } from '@/components/ui/IconButton';

function dismissKey(weekStart: string): string { return `focali_coach_dismissed_${weekStart}`; }

function fmtH(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function fmtPeriodo(weekStart: string, weekEnd: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const s = new Date(weekStart + 'T00:00:00').toLocaleDateString('pt-BR', opts);
  const e = new Date(weekEnd + 'T00:00:00').toLocaleDateString('pt-BR', opts);
  return `${s} – ${e}`;
}

// Monta a narrativa como uma lista de parágrafos — cada bloco só aparece se
// os dados sustentarem algo honesto (sem preencher lacuna com genérico vago).
function montarNarrativa(r: CoachResumo): { abertura: string; destaques: string[]; decisoes: string[] } {
  const dias = r.totalDays === 1 ? '1 dia' : `${r.totalDays} dias`;
  const abertura = `Você estudou ${fmtH(r.totalMinutes)} em ${dias}${r.topicsCount > 0 ? `, passando por ${r.topicsCount} ${r.topicsCount === 1 ? 'tópico' : 'tópicos'}` : ''}.`;

  const destaques: string[] = [];
  if (r.questionsTotal >= 10) {
    const pct = Math.round((r.questionsCorrect / r.questionsTotal) * 100);
    destaques.push(`Você resolveu ${r.questionsTotal} questões com ${pct}% de acerto.`);
  }
  if (r.melhorMateria) {
    destaques.push(`${r.melhorMateria.subjectName} foi seu ponto forte: ${r.melhorMateria.acertoPct}% de acerto em ${r.melhorMateria.totalQuestoes} questões.`);
  }
  if (r.avgEnergy !== null) {
    if (r.avgEnergy < 2.5) {
      destaques.push(`Sua energia andou baixa nas sessões (média ${r.avgEnergy.toFixed(1)}/5) — vale olhar o horário em que você estuda.`);
    } else if (r.avgEnergy >= 4) {
      destaques.push(`Energia alta na maioria das sessões (média ${r.avgEnergy.toFixed(1)}/5) — bom sinal de ritmo sustentável.`);
    }
  }
  if (r.causaPredominante) {
    destaques.push(`${r.causaPredominante.pct}% dos seus erros marcados vieram de ${r.causaPredominante.label} — foque nisso, não só em mais volume.`);
  }
  if (r.streakAtual >= 3) {
    destaques.push(`Sua sequência está em ${r.streakAtual} dias — continue.`);
  }

  const decisoes: string[] = [];
  if (r.focoPrincipal && r.focoPrincipal.score < 85) {
    decisoes.push(`Priorize ${r.focoPrincipal.subjectName} — é a matéria de maior peso ainda com prontidão baixa (${r.focoPrincipal.score}%).`);
  }
  for (const t of r.topicosNegligenciados) {
    decisoes.push(`Retome "${t.name}" — ${t.motivo}.`);
  }
  if (r.causaPredominante) {
    decisoes.push(`Na próxima sessão de questões, pare 5s antes de responder e pergunte: "isso é ${r.causaPredominante.label === 'gestão de tempo' ? 'pressa' : r.causaPredominante.label}?"`);
  }

  return { abertura, destaques, decisoes: decisoes.slice(0, 3) };
}

// variant 'row': linha compacta dentro do SemanaPanel (sem dispensa semanal — o
// resumo faz parte do painel). variant 'banner': o banner dispensável original.
export function CoachSemanal({ variant = 'banner' }: { variant?: 'banner' | 'row' } = {}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true); // começa true — só libera após checar localStorage (evita flash)

  const { data } = useQuery<CoachResumo>({
    queryKey: ['coach-semanal'],
    queryFn: getCoachSemanal,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data?.hasData) return;
    setDismissed(window.localStorage.getItem(dismissKey(data.weekStart)) === '1');
  }, [data]);

  if (!data || !data.hasData) return null;
  if (variant === 'banner' && dismissed) return null;

  // No banner, fechar dispensa a semana. Na linha do painel, só fecha o modal.
  function fecharModal() {
    if (variant === 'banner') {
      if (data?.weekStart) window.localStorage.setItem(dismissKey(data.weekStart), '1');
      setDismissed(true);
    }
    setModalOpen(false);
  }

  const { abertura, destaques, decisoes } = montarNarrativa(data);

  const trigger = variant === 'row' ? (
    <>
      <div style={s.rowDivider} />
      <button style={s.row} onClick={() => setModalOpen(true)}>
        <span style={s.rowMsg}><ClipboardList size={14} strokeWidth={2} style={{ marginRight: 5, verticalAlign: -2 }} />Seu resumo {data.isCurrentWeek ? 'da semana' : 'da semana passada'} está pronto</span>
        <span style={s.rowCta}>Ver →</span>
      </button>
    </>
  ) : (
    <div style={s.banner}>
      <span style={s.bannerMsg}>
        <ClipboardList size={14} strokeWidth={2} style={{ marginRight: 5, verticalAlign: -2 }} />Seu resumo {data.isCurrentWeek ? 'da semana' : 'da semana passada'} está pronto.
      </span>
      <div style={s.bannerActions}>
        <button onClick={() => setModalOpen(true)} style={s.bannerBtn}>Ver resumo →</button>
        <button onClick={fecharModal} style={s.bannerDismiss} aria-label="Dispensar"><X size={14} strokeWidth={2} /></button>
      </div>
    </div>
  );

  return (
    <>
      {trigger}

      {modalOpen && (
        <Overlay onClose={() => setModalOpen(false)} maxWidth={520} labelledBy="coach-semanal-title" padding={0} hideClose>
            <div style={s.head}>
              <div>
                <span style={s.eyebrow}>Seu coach semanal</span>
                <h2 id="coach-semanal-title" style={s.h2}>{fmtPeriodo(data.weekStart, data.weekEnd)}</h2>
              </div>
              <IconButton onClick={() => setModalOpen(false)} aria-label="Fechar" size="sm" style={{ flexShrink: 0 }}><X size={16} strokeWidth={2} /></IconButton>
            </div>

            <div style={s.body}>
              <p style={s.abertura}>{abertura}</p>

              {destaques.length > 0 && (
                <div style={s.secao}>
                  <p style={s.secaoTitulo}>Como foi</p>
                  {destaques.map((d, i) => <p key={i} style={s.item}>• {d}</p>)}
                </div>
              )}

              {decisoes.length > 0 && (
                <div style={s.secao}>
                  <p style={s.secaoTitulo}>3 decisões pra semana que vem</p>
                  {decisoes.map((d, i) => <p key={i} style={s.itemDecisao}>{i + 1}. {d}</p>)}
                </div>
              )}

              {destaques.length === 0 && decisoes.length === 0 && (
                <p style={s.item}>Ainda não há sinal suficiente pra ir além do básico — continue registrando suas sessões com energia e (quando for o caso) a causa do erro.</p>
              )}
            </div>

            <div style={s.actions}>
              <Button variant="outline" onClick={fecharModal}>Fechar</Button>
              <Button onClick={() => { fecharModal(); router.push('/performance'); }}>Ver desempenho completo →</Button>
            </div>
        </Overlay>
      )}
    </>
  );
}

const s: Record<string, CSSProperties> = {
  banner: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(127,119,221,.10)', border: '0.5px solid rgba(127,119,221,.35)', borderRadius: theme.radius, marginBottom: 16 },
  bannerMsg: { fontSize: 14, color: theme.ink },
  bannerActions: { display: 'flex', alignItems: 'center', gap: 6 },
  bannerBtn: { padding: '8px 14px', borderRadius: theme.radiusSm, border: 'none', background: theme.clay, color: theme.onClay, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  bannerDismiss: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, cursor: 'pointer', padding: '4px 6px' },

  rowDivider: { height: '0.5px', background: theme.line, margin: '16px 0' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '4px 2px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: theme.font, textAlign: 'left' },
  rowMsg: { fontSize: 14, color: theme.inkSoft, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowCta: { fontSize: 13, fontWeight: 600, color: '#7F77DD', flexShrink: 0 },

  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 22px 12px' },
  eyebrow: { fontSize: 11, fontWeight: 700, color: '#7F77DD', letterSpacing: 0.6, textTransform: 'uppercase' },
  h2: { fontSize: 19, fontWeight: 700, color: theme.ink, margin: '4px 0 0' },

  body: { overflowY: 'auto', padding: '4px 22px 8px' },
  abertura: { fontSize: 15, color: theme.ink, lineHeight: 1.6, margin: '0 0 16px', fontWeight: 500 },
  secao: { marginBottom: 16 },
  secaoTitulo: { fontSize: 12, fontWeight: 700, color: theme.inkFaint, letterSpacing: 0.4, textTransform: 'uppercase', margin: '0 0 8px' },
  item: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: '0 0 8px' },
  itemDecisao: { fontSize: 14, color: theme.ink, lineHeight: 1.6, margin: '0 0 10px', fontWeight: 500 },

  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 22px', borderTop: `0.5px solid ${theme.line}` },
  fecharBtn: { padding: '9px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  verMaisBtn: { padding: '9px 16px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
