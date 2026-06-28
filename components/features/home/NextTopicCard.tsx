// components/features/home/NextTopicCard.tsx
// "Próximo tópico sugerido": 1 principal em destaque + lista colapsável de
// até 5 "também pendentes". A plataforma decide o que estudar agora.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSuggestions, type SuggestedTopic } from '@/services/suggestion.service';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';

export function NextTopicCard() {
  const router = useRouter();
  const [sugestoes, setSugestoes] = useState<SuggestedTopic[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    getSuggestions()
      .then(setSugestoes)
      .catch(() => {
        setHasError(true);
        setSugestoes([]);
      });
  }, []);

  function estudar(s: SuggestedTopic) {
    router.push(`/?topicId=${s.id}&subjectId=${s.subjectId}`);
  }

  if (sugestoes === null) {
    return (
      <div style={styles.card}>
        {/* eyebrow */}
        <Skeleton width={170} height={11} borderRadius={4} style={{ marginBottom: 14 }} />
        {/* main row: info + botão */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton height={20} borderRadius={6} style={{ marginBottom: 7 }} />
            <Skeleton width="55%" height={13} borderRadius={4} />
          </div>
          <Skeleton width={118} height={40} borderRadius={10} style={{ flexShrink: 0 }} />
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

  // Nada pendente → mensagem de "em dia".
  if (sugestoes.length === 0) {
    return (
      <div style={styles.card}>
        <span style={styles.eyebrow}>Próximo tópico</span>
        <p style={styles.emptyMsg}>Você está em dia! Nenhuma revisão vencida ou tópico frágil agora. 🎯</p>
      </div>
    );
  }

  const principal = sugestoes[0];
  const tambem = sugestoes.slice(1); // até 5

  return (
    <div style={styles.card}>
      <div style={styles.headRow}>
        <span style={styles.eyebrow}>Próximo tópico sugerido</span>
      </div>

      {/* Sugestão principal */}
      <div style={styles.mainRow}>
        <div style={styles.mainInfo}>
          <div style={styles.mainName}>{principal.name}</div>
          <div style={styles.mainMeta}>{principal.subjectName} · {principal.motivo}</div>
        </div>
        <button style={styles.studyBtn} onClick={() => estudar(principal)}>Estudar agora</button>
      </div>

      {/* Lista colapsável de "também pendentes" */}
      {tambem.length > 0 && (
        <div style={styles.alsoWrap}>
          <button style={styles.alsoToggle} onClick={() => setAberto((v) => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
            também pendentes ({tambem.length})
          </button>
          {aberto && (
            <div style={styles.alsoList}>
              {tambem.map((s) => (
                <button key={s.id} style={styles.alsoItem} onClick={() => estudar(s)}>
                  <span style={styles.alsoName}>{s.name}</span>
                  <span style={styles.alsoMotivo}>{s.motivo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: theme.card, border: `1.5px solid ${theme.teal}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 18, fontFamily: theme.font },
  headRow: { marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase' },
  emptyMsg: { fontSize: 15, color: theme.inkSoft, margin: '10px 0 0', lineHeight: 1.5 },
  mainRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  mainInfo: { flex: 1, minWidth: 0 },
  mainName: { fontSize: 17, fontWeight: 700, color: theme.ink, marginBottom: 3 },
  mainMeta: { fontSize: 13, color: theme.inkSoft },
  studyBtn: { padding: '10px 18px', borderRadius: 10, border: 'none', background: theme.teal, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
  alsoWrap: { marginTop: 14, borderTop: `0.5px solid ${theme.line}`, paddingTop: 12 },
  alsoToggle: { display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  alsoList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 },
  alsoItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderRadius: 9, border: `0.5px solid ${theme.line}`, background: theme.card, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' },
  alsoName: { fontSize: 14, color: theme.ink, fontWeight: 500 },
  alsoMotivo: { fontSize: 12, color: theme.inkFaint, whiteSpace: 'nowrap' },
  muted: { color: theme.inkFaint, fontSize: 14 },
};