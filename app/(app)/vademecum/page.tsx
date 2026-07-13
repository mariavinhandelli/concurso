// app/(app)/vademecum/page.tsx
// Biblioteca do Vade Mecum: busca + filtro por matéria, atalho para revisões
// vencidas e o gatilho do simulado combinado (abre modal — mesmo padrão
// compacto do "Simular" da lista de jurisprudências, em vez de uma caixa
// fixa ocupando a página).
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp, AlarmClock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LEIS_CATALOG, getLei, type LeiMeta } from '@/services/leis.service';
import { countRevisoesDue, listInteracoesByLei } from '@/services/leiInteracoes.service';
import { LEIS_COM_QUESTOES } from '@/services/leiQuestoes.service';
import { VademecumSimuladoModal } from '@/components/features/vademecum/VademecumSimuladoModal';
import { theme } from '@/lib/theme';
import { PageContainer, PageHeader } from '@/components/ui/Page';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// % da lei grifada (sobre artigos vigentes) — carregado por card, sem
// bloquear a lista (cada lei pesa o próprio fetch, cacheado por slug).
function usePctGrifado(slug: string): number | null {
  const { data } = useQuery({
    queryKey: ['vademecum-pct', slug],
    queryFn: async () => {
      const [lei, interacoes] = await Promise.all([getLei(slug), listInteracoesByLei(slug)]);
      const vigentes = lei.artigos.filter((a) => !a.revogado);
      if (vigentes.length === 0) return 0;
      const comGrifo = vigentes.filter((a) => (interacoes.get(a.key)?.grifos.length ?? 0) > 0).length;
      return Math.round((comGrifo / vigentes.length) * 100);
    },
    staleTime: 60_000,
  });
  return data ?? null;
}

function LeiCard({ lei, onOpen }: { lei: LeiMeta; onOpen: () => void }) {
  const pct = usePctGrifado(lei.slug);
  return (
    <button onClick={onOpen} style={s.card}>
      <div style={s.cardTop}>
        <span style={s.cardSigla}>{lei.nomeCurto}</span>
        {pct !== null && pct > 0 && <span style={s.pctChip}>{pct}% grifado</span>}
      </div>
      <div style={s.cardNome}>{lei.nome}</div>
      <div style={s.cardMeta}>{lei.disciplina} · {lei.totalArtigos} artigos</div>
      <div style={s.cardDesc}>{lei.descricao}</div>
    </button>
  );
}

export default function VademecumPage() {
  const router = useRouter();
  const [dueCount, setDueCount] = useState(0);
  const [busca, setBusca] = useState('');
  const [disciplina, setDisciplina] = useState('todas');
  const [showSimulado, setShowSimulado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    countRevisoesDue().then((n) => { if (!cancelled) setDueCount(n); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const disciplinas = useMemo(() => {
    const set = new Set(LEIS_CATALOG.map((l) => l.disciplina));
    return ['todas', ...set];
  }, []);

  const leisFiltradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return LEIS_CATALOG.filter((l) => {
      if (disciplina !== 'todas' && l.disciplina !== disciplina) return false;
      if (!termo) return true;
      return normalizar(`${l.nome} ${l.nomeCurto} ${l.descricao}`).includes(termo);
    });
  }, [busca, disciplina]);

  return (
    <PageContainer>
      <PageHeader title="Vade Mecum" subtitle="Lei seca para grifar, anotar e revisar — o texto vira estudo ativo." />

      {dueCount > 0 && (
        <button onClick={() => router.push('/vademecum/revisar')} style={{ ...s.dueBanner, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlarmClock size={14} strokeWidth={2} />
          <b>{dueCount} artigo{dueCount === 1 ? '' : 's'}</b> com revisão vencida — revisar agora →
        </button>
      )}

      {/* Ações rápidas — mesmo padrão do hub de jurisprudências */}
      {LEIS_COM_QUESTOES.length > 0 && (
        <div style={s.acoesRow}>
          <button onClick={() => setShowSimulado(true)} style={s.simuladoBtn}>
            <CircleHelp size={13} strokeWidth={1.7} style={{ marginRight: 6 }} />
            Simulado C/E
          </button>
        </div>
      )}
      {showSimulado && <VademecumSimuladoModal onClose={() => setShowSimulado(false)} />}

      {/* Busca + filtro por matéria */}
      <div style={s.buscaRow}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar lei por nome, sigla ou assunto…"
          style={s.buscaInput}
          aria-label="Buscar lei"
        />
      </div>
      <div style={s.filtroRow}>
        {disciplinas.map((d) => (
          <button
            key={d}
            onClick={() => setDisciplina(d)}
            style={{ ...s.filtroChip, ...(disciplina === d ? s.filtroChipOn : {}) }}
          >
            {d === 'todas' ? 'Todas' : d}
          </button>
        ))}
      </div>

      {leisFiltradas.length === 0 ? (
        <p style={s.semResultado}>Nenhuma lei encontrada com esses filtros.</p>
      ) : (
        <div style={s.grid}>
          {leisFiltradas.map((lei) => (
            <LeiCard key={lei.slug} lei={lei} onOpen={() => router.push(`/vademecum/${lei.slug}`)} />
          ))}
        </div>
      )}

      <p style={s.rodape}>
        Mais leis em breve — a estrutura já aceita qualquer norma (estatutos, leis orgânicas, códigos).
      </p>
    </PageContainer>
  );
}

const s: Record<string, CSSProperties> = {
  dueBanner: { display: 'block', width: '100%', textAlign: 'left', background: 'rgba(226,75,74,.10)', color: '#C03A39', border: '0.5px solid rgba(226,75,74,.35)', borderRadius: theme.radius, padding: '12px 16px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 },

  acoesRow: { display: 'flex', gap: 10, marginBottom: 18 },
  simuladoBtn: { display: 'inline-flex', alignItems: 'center', padding: '9px 18px', borderRadius: theme.radiusPill, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  buscaRow: { marginBottom: 10 },
  buscaInput: { width: '100%', boxSizing: 'border-box', padding: '11px 16px', borderRadius: theme.radiusPill, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  filtroRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  filtroChip: { fontSize: 13, color: theme.inkSoft, background: 'transparent', borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, borderRadius: theme.radiusPill, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit' },
  filtroChipOn: { borderColor: theme.teal, background: theme.tealBg, color: theme.tealDeep, fontWeight: 600 },
  semResultado: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '30px 0' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  card: { textAlign: 'left', background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '18px 20px', cursor: 'pointer', fontFamily: 'inherit' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardSigla: { fontSize: 13, fontWeight: 700, color: theme.teal },
  pctChip: { fontSize: 11, fontWeight: 700, color: theme.tealDeep, background: theme.tealBg, borderRadius: theme.radiusPill, padding: '2px 8px' },
  cardNome: { fontSize: 16, fontWeight: 600, color: theme.ink, lineHeight: 1.4, marginTop: 6 },
  cardMeta: { fontSize: 13, color: theme.inkFaint, margin: '6px 0 8px' },
  cardDesc: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55 },
  rodape: { fontSize: 13, color: theme.inkFaint, marginTop: 20 },
};
