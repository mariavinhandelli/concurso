'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star, RefreshCw, Search, CircleHelp, Scale, Landmark, FileSearch, Gavel, Lock, Users,
  FileText, Briefcase, Vote, Percent, ShieldCheck, Medal, CalendarClock, ChartNoAxesColumn,
  TriangleAlert, type LucideIcon,
} from 'lucide-react';
import { DISCIPLINAS_HUB, countByDisciplina } from '@/services/jurisprudencias.service';
import { getSimuladoInsights, type SimuladoInsights } from '@/services/jurisInteracoes.service';
import { countRevisoesHoje } from '@/services/jurisRevisao.service';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { PageContainer, PageHeader } from '@/components/ui/Page';

const DISCIPLINA_ICON: Record<string, LucideIcon> = {
  Constitucional: Scale,
  Administrativo: Landmark,
  'Controle Externo': FileSearch,
  Penal: Gavel,
  'Processo Penal': Lock,
  Civil: Users,
  'Processo Civil': FileText,
  Trabalho: Briefcase,
  Eleitoral: Vote,
  Tributário: Percent,
  Previdenciário: ShieldCheck,
  'Penal e Proc. Penal Militar': Medal,
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
    <PageContainer style={{ minWidth: 0 }}>
      <PageHeader title="Jurisprudências" subtitle="Teses que caem em concurso, organizadas por disciplina." />

      {/* Busca */}
      <form onSubmit={handleSearch} style={{ maxWidth: 560, margin: '0 auto 28px' }}>
        <div style={{ position: 'relative' }}>
          <button
            type="submit"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            aria-label="Buscar"
          >
            <Search size={18} color={theme.inkFaint} strokeWidth={1.7} />
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
          <Star size={13} fill="#f59e0b" color="#f59e0b" strokeWidth={1.7} />
          Favoritas
        </button>
        <button onClick={() => router.push('/jurisprudencias/revisar')} style={{ ...styles.quickBtn, ...(revisoesHoje ? styles.quickBtnAlert : {}), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} strokeWidth={1.7} />
          Revisões de hoje{revisoesHoje ? ` (${revisoesHoje})` : ''}
        </button>
        <button onClick={() => router.push('/jurisprudencias/simulados')} style={{ ...styles.quickBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CircleHelp size={13} strokeWidth={1.7} />
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
              <CalendarClock size={18} color={theme.warnDeep} strokeWidth={1.8} />
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
              <ChartNoAxesColumn size={18} color={theme.ink} strokeWidth={1.8} />
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
              <TriangleAlert size={18} color={theme.danger} strokeWidth={1.8} />
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
              {(() => { const Icon = DISCIPLINA_ICON[d]; return <Icon size={22} strokeWidth={1.7} />; })()}
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
    </PageContainer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  insightCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`,
    background: theme.card, boxShadow: theme.shadow, cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left' as const, flex: '1 1 200px', minWidth: 0,
  },
  quickBtn: { padding: '9px 18px', borderRadius: theme.radiusPill, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  quickBtnAlert: { border: `0.5px solid ${theme.warn}`, background: theme.warnTint, color: theme.warnDeep },
  quickBtnPrimary: { padding: '9px 18px', borderRadius: theme.radiusPill, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  discCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '20px 12px', borderRadius: theme.radius, border: `0.5px solid ${theme.line}`,
    background: theme.card, boxShadow: theme.shadow, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'border-color .15s, transform .15s',
  },
  discIcon: { width: 44, height: 44, borderRadius: theme.radiusSm, display: 'grid', placeItems: 'center', flexShrink: 0 },
  discLabel: { fontSize: 13, fontWeight: 600, color: theme.ink, textAlign: 'center', lineHeight: 1.3 },
  discCount: { fontSize: 11, color: theme.inkFaint, fontWeight: 500 },
  verTodasBtn: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
