'use client';

import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getSuggestions, type SuggestionsResult, type SuggestedTopic } from '@/services/suggestion.service';
import { useTimer } from '@/components/features/timer/TimerContext';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

export const NextTopicCard = memo(function NextTopicCard() {
  const router = useRouter();
  const { start, status } = useTimer();
  const [confirming, setConfirming] = useState<SuggestedTopic | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [verMais, setVerMais] = useState(false);

  const { data, isLoading, isError: hasError } = useQuery<SuggestionsResult>({
    queryKey: ['home-suggestions'],
    queryFn: getSuggestions,
  });

  function estudar(s: SuggestedTopic, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (status !== 'idle') { setConfirming(s); return; }
    start({ mode: 'teoria', topicId: s.id, subjectId: s.subjectId });
  }

  function confirmarTroca() {
    if (!confirming) return;
    start({ mode: 'teoria', topicId: confirming.id, subjectId: confirming.subjectId });
    setConfirming(null);
  }

  if (isLoading) {
    return (
      <div style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width={160} height={10} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton height={18} borderRadius={5} />
          </div>
          <Skeleton width={118} height={38} borderRadius={10} style={{ flexShrink: 0 }} />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Próximo tópico</span>
        <p style={styles.emptyMsg}>Não foi possível carregar as sugestões. Recarregue a página.</p>
      </div>
    );
  }

  if (!data) return null;

  const { items: sugestoes, reason } = data;

  if (reason === 'no_topics') {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Próximo passo</span>
        <p style={styles.emptyMsg}>Você ainda não tem tópicos cadastrados. Crie sua primeira matéria para começar a estudar.</p>
        <button style={styles.ctaBtn} onClick={() => router.push('/subjects')}>
          Criar minha primeira matéria →
        </button>
      </div>
    );
  }

  if (reason === 'all_caught_up') {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Próximo tópico</span>
        <p style={styles.emptyMsg}>Você está em dia! Nenhuma revisão vencida ou tópico frágil agora. 🎯</p>
      </div>
    );
  }

  const principal = sugestoes[0];
  const tambem = sugestoes.slice(1);
  const visiveis = tambem.slice(0, 2);
  const ocultos = tambem.slice(2);

  return (
    <div style={styles.card}>
      {confirming && (
        <div style={styles.confirmBanner}>
          <p style={styles.confirmMsg}>
            Há uma sessão em andamento. Iniciar <b>"{confirming.name}"</b> vai encerrar a sessão atual.
          </p>
          <div style={styles.confirmBtns}>
            <button style={styles.confirmCancel} onClick={() => setConfirming(null)}>Cancelar</button>
            <button style={styles.confirmOk} onClick={confirmarTroca}>Encerrar e iniciar</button>
          </div>
        </div>
      )}

      {/* Header compacto — sempre visível, clicável para expandir */}
      <div
        style={styles.header}
        onClick={() => setExpandido((v) => !v)}
        role="button"
        aria-expanded={expandido}
      >
        <div style={styles.headerLeft}>
          <span style={styles.eyebrow}>Próximo tópico sugerido</span>
          <div style={styles.titulo}>{principal.name}</div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.studyBtn} onClick={(e) => estudar(principal, e)}>
            Estudar agora
          </button>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={theme.inkFaint} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transition: 'transform .2s ease', transform: expandido ? 'rotate(180deg)' : 'none' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Detalhe + sugestões secundárias — só visíveis quando expandido */}
      {expandido && (
        <div style={styles.body}>
          <div style={styles.meta}>{principal.subjectName} · {principal.motivo}</div>

          {visiveis.length > 0 && (
            <div style={styles.alsoWrap}>
              <div style={styles.alsoList}>
                {visiveis.map((s) => (
                  <button key={s.id} style={styles.alsoItem} onClick={(e) => estudar(s, e)}>
                    <span style={styles.alsoName}>{s.name}</span>
                    <span style={styles.alsoMotivo}>{s.motivo}</span>
                  </button>
                ))}
                {verMais && ocultos.map((s) => (
                  <button key={s.id} style={styles.alsoItem} onClick={(e) => estudar(s, e)}>
                    <span style={styles.alsoName}>{s.name}</span>
                    <span style={styles.alsoMotivo}>{s.motivo}</span>
                  </button>
                ))}
              </div>
              {ocultos.length > 0 && (
                <button
                  style={styles.verMaisBtn}
                  onClick={(e) => { e.stopPropagation(); setVerMais((v) => !v); }}
                >
                  {verMais ? 'ver menos' : `ver mais ${ocultos.length} pendente${ocultos.length > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.card,
    border: `1.5px solid ${theme.teal}`,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    padding: '14px 18px',
    fontFamily: theme.font,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: { flex: 1, minWidth: 0 },
  titulo: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: 3,
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  body: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: `0.5px solid ${theme.line}`,
  },
  meta: { fontSize: 13, color: theme.inkSoft, marginBottom: 2 },
  eyebrow: {
    fontSize: 11, fontWeight: 700, color: theme.teal,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  emptyMsg: { fontSize: 15, color: theme.inkSoft, margin: '10px 0 0', lineHeight: 1.5 },
  ctaBtn: {
    marginTop: 12, border: 'none', background: 'transparent',
    color: theme.teal, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  studyBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: theme.teal, color: '#fff', fontSize: 13.5,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  alsoWrap: { marginTop: 10 },
  alsoList: { display: 'flex', flexDirection: 'column', gap: 5 },
  alsoItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '8px 12px', borderRadius: 8,
    border: `0.5px solid ${theme.line}`, background: theme.bg,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  alsoName: {
    fontSize: 13.5, color: theme.ink, fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  alsoMotivo: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap', flexShrink: 0 },
  verMaisBtn: {
    marginTop: 8, border: 'none', background: 'transparent',
    color: theme.inkSoft, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  confirmBanner: {
    marginBottom: 12, padding: '11px 14px',
    borderRadius: theme.radiusSm, background: theme.warnBg,
    border: `0.5px solid ${theme.warn}`,
  },
  confirmMsg: { margin: '0 0 10px', fontSize: 13.5, color: theme.ink, lineHeight: 1.5 },
  confirmBtns: { display: 'flex', gap: 8 },
  confirmCancel: {
    padding: '7px 14px', borderRadius: 8,
    border: `0.5px solid ${theme.line}`, background: theme.card,
    color: theme.inkSoft, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  confirmOk: {
    padding: '7px 14px', borderRadius: 8, border: 'none',
    background: theme.warn, color: '#fff', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
};
