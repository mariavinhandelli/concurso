'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import {
  listRevisoesHoje, submitRevisao,
  type JurisComInteracao,
} from '@/services/jurisInteracoes.service';
import { RATING_LABEL, type JurisRating, jurisDaysOverdue, calculateNextJurisReview, fromJurisDbRow, INITIAL_JURIS_STATE } from '@/lib/juris-review';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { PageContainer } from '@/components/ui/Page';
import { Button } from '@/components/ui/Button';

const RATINGS: { key: JurisRating; color: string; bg: string }[] = [
  { key: 'errei',   color: theme.danger,   bg: theme.dangerTint },
  { key: 'dificil', color: theme.warnDeep, bg: theme.warnTint },
  { key: 'ok',      color: theme.tealDeep, bg: theme.tealBg },
  { key: 'dominei', color: theme.okDeep,   bg: theme.okTint },
];


export default function RevisarPage() {
  const router = useRouter();
  const { isMobile } = useUI();
  const toast = useToast();

  const [items, setItems] = useState<JurisComInteracao[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [feitas, setFeitas] = useState(0); // avaliadas de fato — pulos não contam

  useEffect(() => {
    listRevisoesHoje()
      .then((data) => {
        setItems(data);
        if (data.length === 0) setDone(true);
      })
      .catch(() => setItems([]));
  }, []);

  const total = items?.length ?? 0;
  const current = items?.[idx] ?? null;
  const overdue = current ? jurisDaysOverdue(current.interacao?.next_review_date ?? null) : 0;

  function handleSkip() {
    if (idx + 1 >= total) setDone(true);
    else { setIdx((v) => v + 1); setRevealed(false); }
  }

  async function handleRate(rating: JurisRating) {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await submitRevisao(current.id, rating, current.interacao);
      setFeitas((n) => n + 1);
      if (idx + 1 >= total) {
        setDone(true);
      } else {
        setIdx((v) => v + 1);
        setRevealed(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar avaliação. Tente novamente.');
      // Reseta para o estado "não revelado" para que o retry preserve a etapa de memória ativa.
      setRevealed(false);
    } finally { setSubmitting(false); }
  }

  if (items === null) {
    return (
      <PageContainer width="narrow" style={{ padding: isMobile ? '40px 16px' : '72px 40px', textAlign: 'center' }}>
        <p style={{ color: theme.inkFaint, fontSize: 15 }}>Carregando revisões…</p>
      </PageContainer>
    );
  }

  if (done || total === 0) {
    return (
      <PageContainer width="narrow" style={{ padding: isMobile ? '40px 16px' : '72px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.ink, margin: '10px 0 6px' }}>
          {total === 0 ? 'Nada para revisar hoje!' : feitas > 0 ? 'Sessão concluída!' : 'Até a próxima!'}
        </h1>
        <p style={{ fontSize: 15, color: theme.inkSoft, margin: '0 0 32px' }}>
          {total === 0
            ? 'Você está em dia com suas revisões.'
            : feitas > 0
              ? `Você revisou ${feitas} jurisprudência${feitas !== 1 ? 's' : ''} hoje.`
              : 'Você pulou as revisões de hoje — elas continuam na fila.'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => router.push('/jurisprudencias')}>
            Voltar ao início
          </Button>
          <Button variant="outline" onClick={() => router.push('/jurisprudencias/lista')}>
            Ver todas
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow">

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button
          className="touch-target"
          onClick={() => router.push('/jurisprudencias')}
          style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
        >
          ← Jurisprudências
        </button>
        <span style={{ fontSize: 13, color: theme.inkFaint, fontWeight: 500 }}>
          {idx + 1} / {total}
        </span>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 4, background: theme.line, borderRadius: theme.radiusPill, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: theme.teal, borderRadius: theme.radiusPill, width: `${((idx + 1) / total) * 100}%`, transition: 'width .3s' }} />
      </div>

      {current && (
        <>
          {/* Tags do item */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={styles.badge(theme.teal, '#fff')}>{current.tribunal}</span>
            <span style={styles.badge('rgba(15,23,42,.08)', theme.inkSoft)}>{current.disciplina}</span>
            {overdue > 0 && (
              <span style={styles.badge(theme.dangerTint, theme.danger)}>
                {overdue}d atrasada
              </span>
            )}
          </div>

          {/* Card principal — quando há flashcard, revisa em modo pergunta→resposta
              (memória ativa); sem flashcard, cai no modo releitura da tese. */}
          <div style={styles.card}>
            {current.flashcard_frente && current.flashcard_verso ? (
              <div style={styles.teseBox}>
                <p style={{ fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
                  Pergunta
                </p>
                <p style={{ fontSize: isMobile ? 16 : 17, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
                  {current.flashcard_frente}
                </p>
              </div>
            ) : (
              <div style={styles.teseBox}>
                <p style={{ fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
                  Tese Principal
                </p>
                <p style={{ fontSize: isMobile ? 16 : 17, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
                  {current.tese}
                </p>
              </div>
            )}

            {/* Conteúdo revelado */}
            {revealed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
                {current.flashcard_frente && current.flashcard_verso && (
                  <>
                    <div style={{ background: theme.okTint, borderRadius: 10, padding: '12px 14px' }}>
                      <p style={{ ...styles.sectionLabel, color: theme.okDeep }}>Resposta</p>
                      <p style={styles.sectionText}>{current.flashcard_verso}</p>
                    </div>
                    <div>
                      <p style={styles.sectionLabel}>Tese completa</p>
                      <p style={styles.sectionText}>{current.tese}</p>
                    </div>
                  </>
                )}
                {!current.flashcard_frente && current.resumo && (
                  <div>
                    <p style={styles.sectionLabel}>Resumo</p>
                    <p style={styles.sectionText}>{current.resumo}</p>
                  </div>
                )}
                {current.como_banca_cobra && (
                  <div style={{ background: 'rgba(99,102,241,.06)', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ ...styles.sectionLabel, color: theme.clay }}>Como a banca cobra</p>
                    <p style={styles.sectionText}>{current.como_banca_cobra}</p>
                  </div>
                )}
                {current.pegadinhas && (
                  <div style={{ background: theme.dangerTint, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ ...styles.sectionLabel, color: theme.danger }}>Pegadinha</p>
                    <p style={styles.sectionText}>{current.pegadinhas}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ações */}
          {!revealed ? (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Button size="lg" onClick={() => setRevealed(true)}>
                {current.flashcard_frente && current.flashcard_verso ? 'Ver resposta e avaliar' : 'Ver tudo e avaliar'}
              </Button>
              <p style={{ fontSize: 12, color: theme.inkFaint, marginTop: 12 }}>
                {current.flashcard_frente && current.flashcard_verso
                  ? 'Tente responder de cabeça antes de revelar'
                  : 'Clique para revelar o conteúdo completo antes de avaliar'}
              </p>
              <button
                onClick={handleSkip}
                style={{ marginTop: 8, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Pular por agora →
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: theme.inkFaint, textAlign: 'center', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Como foi?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {RATINGS.map(({ key, color, bg }) => {
                  const state = current?.interacao
                    ? fromJurisDbRow(current.interacao)
                    : INITIAL_JURIS_STATE;
                  const nextDays = calculateNextJurisReview(state, key).intervalDays;
                  return (
                  <button
                    key={key}
                    onClick={() => handleRate(key)}
                    disabled={submitting}
                    style={{
                      padding: '14px 10px', borderRadius: theme.radiusSm,
                      border: `0.5px solid ${color}`, background: bg,
                      color, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: theme.font,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    {RATING_LABEL[key]}
                    <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>
                      → volta em {nextDays} {nextDays === 1 ? 'dia' : 'dias'}
                    </span>
                  </button>
                  );
                })}
              </div>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                  onClick={() => router.push(`/jurisprudencias/${current.id}`)}
                  style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Ver jurisprudência completa →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

const styles = {
  card: {
    background: theme.card, border: `0.5px solid ${theme.line}`,
    borderRadius: theme.radius, boxShadow: theme.shadow,
    padding: '22px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16,
  },
  teseBox: {
    background: theme.tealBg, border: `1px solid ${theme.teal}`,
    borderRadius: theme.radiusSm, padding: '16px 18px',
  },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase' as const, letterSpacing: 0.4, margin: '0 0 5px' },
  sectionText: { fontSize: 14, color: theme.ink, lineHeight: 1.65, margin: 0 },
  badge: (bg: string, color: string): React.CSSProperties => ({
    fontSize: 12, fontWeight: 600, color, background: bg, borderRadius: 6, padding: '3px 10px',
  }),
};
