'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/ToastProvider';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { invalidateReviewCounts } from '@/lib/review-counts';
import { savePassiveSession } from '@/services/passiveSession.service';
import {
  listRevisoesHoje, submitRevisao,
  type JurisComInteracao,
} from '@/services/jurisInteracoes.service';
import { type JurisRating, jurisDaysOverdue, fromJurisDbRow } from '@/lib/juris-review';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { PageContainer } from '@/components/ui/Page';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { JurisRevisaoCard } from '@/components/features/jurisprudencias/JurisRevisaoCard';

export default function RevisarPage() {
  const router = useRouter();
  const { isMobile } = useUI();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<JurisComInteracao[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [feitas, setFeitas] = useState(0); // avaliadas de fato — pulos não contam
  // Sessão passiva (mode: jurisprudencia) gravada uma única vez na conclusão.
  // Início setado no efeito (Date.now() no render viola pureza).
  const inicioRef = useRef(0);
  const sessaoGravadaRef = useRef(false);
  useEffect(() => { if (!inicioRef.current) inicioRef.current = Date.now(); }, []);

  useEffect(() => {
    if (!done || feitas === 0 || sessaoGravadaRef.current) return;
    sessaoGravadaRef.current = true;
    // Avaliar julgados esvazia a fila de juris — os contadores do Plano de Hoje
    // mudaram MESMO se a sessão passiva não gravar (< 30s). O player unificado e
    // o do Vade Mecum já faziam isso; este era o único que não invalidava nada.
    invalidateReviewCounts(queryClient);
    void savePassiveSession({
      mode: 'jurisprudencia',
      startedAtMs: inicioRef.current,
      itemsLabel: `Revisão de jurisprudências: ${feitas} julgado${feitas === 1 ? '' : 's'}.`,
    }).then((gravou) => { if (gravou) refreshHomeAfterSession(queryClient); });
  }, [done, feitas, queryClient]);

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
        <PartyPopper size={48} color={theme.teal} strokeWidth={1.5} style={{ marginBottom: 20 }} />
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
        <BackLink href="/jurisprudencias" style={{ marginBottom: 0 }}>Jurisprudências</BackLink>
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
          <JurisRevisaoCard
            item={current}
            interacaoState={current.interacao ? fromJurisDbRow(current.interacao) : null}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onRate={handleRate}
            disabled={submitting}
            overdueDays={overdue}
            revealHint={current.flashcard_frente && current.flashcard_verso
              ? 'Tente responder de cabeça antes de revelar'
              : 'Clique para revelar o conteúdo completo antes de avaliar'}
            footer={(
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <button
                  onClick={() => router.push(`/jurisprudencias/${current.id}`)}
                  style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Ver jurisprudência completa →
                </button>
              </div>
            )}
          />
          {!revealed && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={handleSkip}
                style={{ border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Pular por agora →
              </button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
