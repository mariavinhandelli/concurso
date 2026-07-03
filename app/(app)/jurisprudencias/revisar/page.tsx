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
      <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '40px 16px' : '60px 40px', textAlign: 'center', fontFamily: theme.font }}>
        <p style={{ color: theme.inkFaint, fontSize: 15 }}>Carregando revisões…</p>
      </div>
    );
  }

  if (done || total === 0) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '40px 16px' : '80px 40px', textAlign: 'center', fontFamily: theme.font }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.ink, margin: '0 0 12px' }}>
          {total === 0 ? 'Nada para revisar hoje!' : 'Sessão concluída!'}
        </h1>
        <p style={{ fontSize: 15, color: theme.inkSoft, margin: '0 0 32px' }}>
          {total === 0
            ? 'Você está em dia com suas revisões.'
            : `Você revisou ${total} jurisprudência${total !== 1 ? 's' : ''} hoje.`}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/jurisprudencias')} style={styles.btnPrimary}>
            Voltar ao início
          </button>
          <button onClick={() => router.push('/jurisprudencias/lista')} style={styles.btnSecondary}>
            Ver todas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 40px', fontFamily: theme.font }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button
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
      <div style={{ height: 4, background: theme.line, borderRadius: 99, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: theme.teal, borderRadius: 99, width: `${((idx + 1) / total) * 100}%`, transition: 'width .3s' }} />
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

          {/* Card principal */}
          <div style={styles.card}>
            {/* Tese — sempre visível */}
            <div style={styles.teseBox}>
              <p style={{ fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
                Tese Principal
              </p>
              <p style={{ fontSize: isMobile ? 16 : 17, color: theme.ink, lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
                {current.tese}
              </p>
            </div>

            {/* Conteúdo revelado */}
            {revealed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
                {current.resumo && (
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
              <button onClick={() => setRevealed(true)} style={styles.revealBtn}>
                Ver tudo e avaliar
              </button>
              <p style={{ fontSize: 12, color: theme.inkFaint, marginTop: 12 }}>
                Clique para revelar o conteúdo completo antes de avaliar
              </p>
              <button
                onClick={handleSkip}
                style={{ marginTop: 8, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
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
                    <span style={{ fontSize: 10.5, fontWeight: 400, opacity: 0.75 }}>
                      → volta em {nextDays} {nextDays === 1 ? 'dia' : 'dias'}
                    </span>
                  </button>
                  );
                })}
              </div>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                  onClick={() => router.push(`/jurisprudencias/${current.id}`)}
                  style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Ver jurisprudência completa →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
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
    borderRadius: 12, padding: '16px 18px',
  },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase' as const, letterSpacing: 0.4, margin: '0 0 5px' },
  sectionText: { fontSize: 14, color: theme.ink, lineHeight: 1.65, margin: 0 },
  badge: (bg: string, color: string): React.CSSProperties => ({
    fontSize: 11.5, fontWeight: 600, color, background: bg, borderRadius: 6, padding: '3px 10px',
  }),
  revealBtn: {
    padding: '13px 32px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font,
  },
  btnPrimary: {
    padding: '12px 28px', borderRadius: theme.radiusSm, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font,
  },
  btnSecondary: {
    padding: '12px 28px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: theme.font,
  },
};
