'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISCIPLINAS_HUB, countByDisciplina } from '@/services/jurisprudencias.service';
import { getSimuladoInsights, type SimuladoInsights } from '@/services/jurisInteracoes.service';
import { countRevisoesHoje } from '@/services/jurisRevisao.service';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

const DISCIPLINA_ICON: Record<string, React.ReactNode> = {
  // Balança da justiça → CF/CRFB
  Constitucional: <>
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3"  y1="21" x2="21" y2="21" />
    <line x1="4"  y1="8"  x2="20" y2="8"  />
    <path d="M6 8L3.5 14h5L6 8z" />
    <path d="M18 8l2.5 6h-5L18 8z" />
  </>,
  // Prédio com janelas → órgão público / Administração
  Administrativo: <>
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    <path d="M10 21v-3h4v3" />
  </>,
  // Lupa sobre documento → fiscalização / Tribunais de Contas
  'Controle Externo': <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6" />
    <path d="M14 2v6h6" />
    <path d="M9 13h2M9 9h1" />
    <circle cx="16.5" cy="16.5" r="3.5" />
    <path d="m19 19 3 3" />
  </>,
  // Martelo do juiz → sanção penal
  Penal: <>
    <path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
    <path d="m16 16 6-6" />
    <path d="m8 8 6-6" />
    <path d="m9 7 8 8" />
    <path d="m21 11-8-8" />
  </>,
  // Algemas/cadeado → persecução penal
  'Processo Penal': <>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    <circle cx="12" cy="16" r="1" />
  </>,
  // Pessoas → relações privadas (contratos, família, obrigações)
  Civil: <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
  // Documento com linhas → rito processual civil
  'Processo Civil': <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8M16 17H8M10 9H8" />
  </>,
  // Maleta → relação de trabalho / CLT
  Trabalho: <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>,
  // Urna com voto → eleitoral
  Eleitoral: <>
    <path d="m9 12 2 2 4-4" />
    <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
    <path d="M22 19H2" />
  </>,
  // Percentual → tributos, impostos
  Tributário: <>
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </>,
  // Escudo com check → proteção social / previdência
  Previdenciário: <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>,
  // Estrela de militar → Direito Penal e Processual Penal Militar
  'Penal e Proc. Penal Militar': <>
    <path d="M12 2l2.4 4.86 5.4.74-3.9 3.8.92 5.36L12 14.24l-4.82 2.52.92-5.36-3.9-3.8 5.4-.74z" />
    <path d="M8 21h8" />
  </>,
};

const DISCIPLINA_COLOR: Record<string, string> = {
  Constitucional: '#3892f8', Administrativo: '#0bd8b6', 'Controle Externo': '#0ea5e9', Penal: '#fe2273',
  'Processo Penal': '#da457c', Civil: '#75f9a5', 'Processo Civil': '#86d39b',
  Trabalho: '#ffad6b', Eleitoral: '#ae67ff', Tributário: '#f85838', Previdenciário: '#5f91bf',
  'Penal e Proc. Penal Militar': '#7c5cbf',
};

export default function JurisprudenciasHubPage() {
  const router = useRouter();
  const { isMobile, isTablet } = useUI();
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [revisoesHoje, setRevisoesHoje] = useState<number | null>(null);
  const [insights, setInsights] = useState<SimuladoInsights | null>(null);

  useEffect(() => {
    countByDisciplina().then(setCounts).catch(() => {});
    countRevisoesHoje().then(setRevisoesHoje).catch(() => setRevisoesHoje(0));
    getSimuladoInsights().then(setInsights).catch(() => {});
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/jurisprudencias/lista${search.trim() ? `?busca=${encodeURIComponent(search.trim())}` : ''}`);
  }

  function openDisciplina(d: string) {
    router.push(`/jurisprudencias/lista?disciplina=${encodeURIComponent(d)}`);
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 16px' : '34px 40px', fontFamily: theme.font, minWidth: 0 }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: 0 }}>
          Jurisprudências
        </h1>
        <p style={{ fontSize: 14, color: theme.inkSoft, margin: '8px 0 0' }}>
          Teses que caem em concurso, organizadas por disciplina.
        </p>
      </div>

      {/* Busca */}
      <form onSubmit={handleSearch} style={{ maxWidth: 560, margin: '0 auto 28px' }}>
        <div style={{ position: 'relative' }}>
          <button
            type="submit"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            aria-label="Buscar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jurisprudência…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '15px 16px 15px 46px',
              borderRadius: 14, border: `0.5px solid ${theme.line}`, background: theme.card,
              fontSize: 15, color: theme.ink, fontFamily: 'inherit', outline: 'none',
              boxShadow: theme.shadow,
            }}
          />
        </div>
      </form>

      {/* Ações rápidas */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/jurisprudencias/lista?favoritas=1')} style={{ ...styles.quickBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.7">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
          </svg>
          Favoritas
        </button>
        <button onClick={() => router.push('/jurisprudencias/revisar')} style={{ ...styles.quickBtn, ...(revisoesHoje ? styles.quickBtnAlert : {}), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 0113-6.2L20 8M20 4v4h-4M20 12a8 8 0 01-13 6.2L4 16M4 20v-4h4" />
          </svg>
          Revisões de hoje{revisoesHoje ? ` (${revisoesHoje})` : ''}
        </button>
        <button onClick={() => router.push('/jurisprudencias/simulados')} style={{ ...styles.quickBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
          Simulados
        </button>
        <Button size="sm" style={{ borderRadius: theme.radiusPill }} onClick={() => router.push('/jurisprudencias/nova')}>
          + Nova jurisprudência
        </Button>
      </div>

      {/* Painel de insights — só aparece quando há dados de simulado */}
      {insights && (insights.ultimoScore !== null || (revisoesHoje !== null && revisoesHoje > 0)) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28, flexDirection: isMobile ? 'column' : 'row' }}>
          {revisoesHoje !== null && revisoesHoje > 0 && (
            <button
              onClick={() => router.push('/jurisprudencias/revisar')}
              style={{ ...styles.insightCard, borderColor: theme.warn, background: theme.warnTint }}
            >
              <span style={{ fontSize: 18 }}>📅</span>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: theme.warnDeep, margin: 0 }}>
                  {revisoesHoje} revisão{revisoesHoje > 1 ? 'ões' : ''} pendente{revisoesHoje > 1 ? 's' : ''}
                </p>
                <p style={{ fontSize: 11, color: theme.warnDeep, margin: 0, opacity: 0.75 }}>Revisar agora →</p>
              </div>
            </button>
          )}
          {insights.ultimoScore !== null && (
            <button
              onClick={() => router.push('/jurisprudencias/simulados')}
              style={{ ...styles.insightCard, borderColor: insights.ultimoScore >= 70 ? theme.ok : insights.ultimoScore >= 50 ? theme.warn : theme.danger }}
            >
              <span style={{ fontSize: 18 }}>📊</span>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: theme.ink, margin: 0 }}>
                  Último simulado: <span style={{ color: insights.ultimoScore >= 70 ? theme.okDeep : insights.ultimoScore >= 50 ? theme.warnDeep : theme.danger }}>{insights.ultimoScore}%</span>
                </p>
                <p style={{ fontSize: 11, color: theme.inkFaint, margin: 0 }}>Ver histórico →</p>
              </div>
            </button>
          )}
          {insights.disciplinaMaisFraga && insights.taxaDisciplinaMaisFraga !== null && (
            <button
              onClick={() => router.push(`/jurisprudencias/lista?disciplina=${encodeURIComponent(insights.disciplinaMaisFraga!)}`)}
              style={{ ...styles.insightCard, borderColor: theme.danger }}
            >
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: theme.ink, margin: 0 }}>
                  Ponto fraco: <span style={{ color: theme.danger }}>{insights.disciplinaMaisFraga}</span>
                </p>
                <p style={{ fontSize: 11, color: theme.inkFaint, margin: 0 }}>{insights.taxaDisciplinaMaisFraga}% de acerto · Estudar →</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Grid de disciplinas */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
      }}>
        {/* Todas as disciplinas do hub sempre aparecem; as zeradas ficam
            esmaecidas (mas clicáveis) até receberem conteúdo. */}
        {DISCIPLINAS_HUB.map((d) => {
          const vazia = Object.keys(counts).length > 0 && (counts[d] ?? 0) === 0;
          return (
          <button
            key={d}
            onClick={() => openDisciplina(d)}
            style={{ ...styles.discCard, opacity: vazia ? 0.55 : 1, width: isMobile ? 'calc(50% - 6px)' : isTablet ? 'calc(25% - 9px)' : 'calc(100% / 6 - 10px)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = DISCIPLINA_COLOR[d]; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = theme.line; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
          >
            <div style={{ ...styles.discIcon, background: `${DISCIPLINA_COLOR[d]}1a`, color: DISCIPLINA_COLOR[d] }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {DISCIPLINA_ICON[d]}
              </svg>
            </div>
            <span style={styles.discLabel}>{d}</span>
            <span style={styles.discCount}>{vazia ? 'em breve' : counts[d] ?? 0}</span>
          </button>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button onClick={() => router.push('/jurisprudencias/lista')} style={styles.verTodasBtn}>
          Ver todas as jurisprudências →
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  insightCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, boxShadow: theme.shadow, cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left' as const, flex: '1 1 200px', minWidth: 0,
  },
  quickBtn: { padding: '9px 18px', borderRadius: theme.radiusPill, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  quickBtnAlert: { border: `0.5px solid ${theme.warn}`, background: theme.warnTint, color: theme.warnDeep },
  quickBtnPrimary: { padding: '9px 18px', borderRadius: theme.radiusPill, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  discCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '20px 12px', borderRadius: theme.radius, border: `0.5px solid ${theme.line}`,
    background: theme.card, boxShadow: theme.shadow, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'border-color .15s, transform .15s',
  },
  discIcon: { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0 },
  discLabel: { fontSize: 13, fontWeight: 600, color: theme.ink, textAlign: 'center', lineHeight: 1.3 },
  discCount: { fontSize: 11, color: theme.inkFaint, fontWeight: 500 },
  verTodasBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
