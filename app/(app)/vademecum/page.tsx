// app/(app)/vademecum/page.tsx
// Biblioteca do Vade Mecum: busca + filtro por matéria, atalho para revisões
// vencidas e o gatilho do simulado combinado (abre modal — mesmo padrão
// compacto do "Simular" da lista de jurisprudências, em vez de uma caixa
// fixa ocupando a página).
'use client';

import { Suspense, useMemo, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleHelp, AlarmClock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LEIS_CATALOG, getLei, type LeiMeta } from '@/services/leis.service';
import { countRevisoesDuePorLei, countArtigosComGrifoPorLei } from '@/services/leiInteracoes.service';
import { LEIS_COM_QUESTOES } from '@/services/leiQuestoes.service';
import { VademecumSimuladoModal } from '@/components/features/vademecum/VademecumSimuladoModal';
import { theme } from '@/lib/theme';
import { Badge } from '@/components/ui/Badge';
import { PageContainer, PageHeader } from '@/components/ui/Page';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Rótulo do chip: "Direito Processual Penal Militar" tem 32 caracteres e sozinho
// consumia uma linha inteira no celular. O prefixo "Direito " é redundante num
// filtro de matéria jurídica; o nome completo continua no aria-label.
function rotuloCurto(disciplina: string): string {
  return disciplina
    .replace(/^Direito\s+/, '')
    .replace(/^Legislação\s+Estadual\s+—\s+/, '')
    .replace(/^Legislação\s+/, 'Leg. ')
    .replace(/\s+da Criança e do Adolescente/, ' Criança e Adolescente');
}

// % da lei grifada (sobre artigos vigentes). Uma única query leve traz a
// contagem de artigos grifados de TODAS as leis; o JSON completo da lei só é
// baixado para as leis que realmente têm grifo (antes: 35 leis ≈ 10MB por
// visita à biblioteca, só para pintar os chips).
function useGrifosPorLei(): Map<string, number> | null {
  const { data } = useQuery({
    queryKey: ['vademecum-grifos-por-lei'],
    queryFn: countArtigosComGrifoPorLei,
    staleTime: 60_000,
  });
  return data ?? null;
}

function usePctGrifado(slug: string, artigosComGrifo: number): number | null {
  const { data } = useQuery({
    queryKey: ['vademecum-pct', slug, artigosComGrifo],
    enabled: artigosComGrifo > 0,
    queryFn: async () => {
      const lei = await getLei(slug);
      const vigentes = lei.artigos.filter((a) => !a.revogado).length;
      if (vigentes === 0) return 0;
      return Math.round((artigosComGrifo / vigentes) * 100);
    },
    staleTime: 60_000,
  });
  if (artigosComGrifo === 0) return 0;
  return data ?? null;
}

function LeiCard({ lei, artigosComGrifo, revisoesDue, onOpen }: { lei: LeiMeta; artigosComGrifo: number; revisoesDue: number; onOpen: () => void }) {
  const pct = usePctGrifado(lei.slug, artigosComGrifo);
  return (
    <button onClick={onOpen} style={s.card}>
      <div style={s.cardTop}>
        <span style={s.cardSigla}>{lei.nomeCurto}</span>
        {/* A revisão vencida vem antes do % grifado: é a única informação do
            card que pede ação hoje. O banner do topo dá só o total — sem isto,
            descobrir QUAL lei está atrasada exigia abrir a fila. */}
        <span style={s.cardBadges}>
          {revisoesDue > 0 && <Badge variant="danger">{revisoesDue} a revisar</Badge>}
          {pct !== null && pct > 0 && <Badge variant="brand">{pct}% grifado</Badge>}
        </span>
      </div>
      <div style={s.cardNome}>{lei.nome}</div>
      <div style={s.cardMeta}>{lei.disciplina} · {lei.totalArtigos} artigos</div>
      <div style={s.cardDesc}>{lei.descricao}</div>
    </button>
  );
}

function VademecumContent() {
  const router = useRouter();
  // ?disciplina= — deep-link vindo do Hub do Concurso ("revisar a lei seca
  // relacionada" chega já filtrado pela disciplina do edital).
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState('');
  const [disciplina, setDisciplina] = useState(() => {
    const d = searchParams.get('disciplina');
    return d && LEIS_CATALOG.some((l) => l.disciplina === d) ? d : 'todas';
  });
  const [showSimulado, setShowSimulado] = useState(false);
  const grifosPorLei = useGrifosPorLei();
  // A mesma query serve o banner e os cards — o total sai do mapa, então
  // saber a lei de cada revisão vencida não custa uma segunda ida ao banco.
  const { data: duePorLei } = useQuery({
    queryKey: ['vademecum-revisoes-por-lei'],
    queryFn: countRevisoesDuePorLei,
    staleTime: 60_000,
  });
  const dueCount = useMemo(() => {
    let n = 0;
    for (const qtd of duePorLei?.values() ?? []) n += qtd;
    return n;
  }, [duePorLei]);

  // Os 16 filtros com o nome completo ("Direito Processual Penal Militar") em
  // wrap ocupavam 5+ linhas no celular — meia tela antes da primeira lei. Agora:
  // rótulo curto, contagem por matéria e uma única linha rolável (mesmo padrão
  // do Caderno no mobile).
  const disciplinas = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const l of LEIS_CATALOG) contagem.set(l.disciplina, (contagem.get(l.disciplina) ?? 0) + 1);
    const lista = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([nome, qtd]) => ({ valor: nome, rotulo: rotuloCurto(nome), qtd }));
    return [{ valor: 'todas', rotulo: 'Todas', qtd: LEIS_CATALOG.length }, ...lista];
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
      <div style={s.filtroRow} role="group" aria-label="Filtrar por matéria">
        {disciplinas.map((d) => {
          const ativo = disciplina === d.valor;
          return (
            <button
              key={d.valor}
              onClick={() => setDisciplina(d.valor)}
              aria-pressed={ativo}
              aria-label={d.valor === 'todas' ? `Todas as matérias (${d.qtd} leis)` : `${d.valor} (${d.qtd} ${d.qtd === 1 ? 'lei' : 'leis'})`}
              style={{ ...s.filtroChip, ...(ativo ? s.filtroChipOn : {}) }}
            >
              {d.rotulo}
              <span style={{ ...s.filtroQtd, ...(ativo ? s.filtroQtdOn : {}) }}>{d.qtd}</span>
            </button>
          );
        })}
      </div>

      {leisFiltradas.length === 0 ? (
        <p style={s.semResultado}>Nenhuma lei encontrada com esses filtros.</p>
      ) : (
        <div style={s.grid}>
          {leisFiltradas.map((lei) => (
            <LeiCard
              key={lei.slug}
              lei={lei}
              artigosComGrifo={grifosPorLei?.get(lei.slug) ?? 0}
              revisoesDue={duePorLei?.get(lei.slug) ?? 0}
              onOpen={() => router.push(`/vademecum/${lei.slug}`)}
            />
          ))}
        </div>
      )}

      <p style={s.rodape}>
        Mais leis em breve — a estrutura já aceita qualquer norma (estatutos, leis orgânicas, códigos).
      </p>
    </PageContainer>
  );
}

// useSearchParams exige Suspense no App Router — mesmo padrão da lista de juris.
export default function VademecumPage() {
  return (
    <Suspense fallback={null}>
      <VademecumContent />
    </Suspense>
  );
}

const s: Record<string, CSSProperties> = {
  dueBanner: { display: 'block', width: '100%', textAlign: 'left', background: theme.dangerTint, color: theme.danger, border: `0.5px solid color-mix(in srgb, ${theme.danger} 35%, transparent)`, borderRadius: theme.radius, padding: '12px 16px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 },

  acoesRow: { display: 'flex', gap: 10, marginBottom: 18 },
  simuladoBtn: { display: 'inline-flex', alignItems: 'center', padding: '9px 18px', borderRadius: theme.radiusPill, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  buscaRow: { marginBottom: 10 },
  buscaInput: { width: '100%', boxSizing: 'border-box', padding: '11px 16px', borderRadius: theme.radiusPill, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  // Uma linha rolável em vez de wrap: no celular os 16 chips viravam 5+ linhas.
  // `scrollbarWidth: none` esconde a barra (o gesto de arrastar continua), e o
  // padding lateral evita que o chip ativo encoste na borda ao rolar.
  filtroRow: {
    display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4,
    scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
  },
  filtroChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
    fontSize: 13, color: theme.inkSoft, background: 'transparent',
    borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line,
    borderRadius: theme.radiusPill, padding: '7px 13px', cursor: 'pointer', fontFamily: 'inherit',
    // alvo de toque de 44px (mesmo padrão de Matérias/Concursos/Agenda); em uma
    // linha rolável o dedo erra com facilidade se o chip for baixo
    minHeight: 44, boxSizing: 'border-box',
  },
  filtroChipOn: { borderColor: theme.teal, background: theme.tealBg, color: theme.tealDeep, fontWeight: 600 },
  filtroQtd: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, background: theme.muted, borderRadius: theme.radiusPill, padding: '1px 6px' },
  filtroQtdOn: { color: theme.tealDeep, background: 'color-mix(in srgb, currentColor 12%, transparent)' },
  semResultado: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '30px 0' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  card: { textAlign: 'left', background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '18px 20px', cursor: 'pointer', fontFamily: 'inherit' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardBadges: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  cardSigla: { fontSize: 13, fontWeight: 700, color: theme.teal },
  cardNome: { fontSize: 16, fontWeight: 600, color: theme.ink, lineHeight: 1.4, marginTop: 6 },
  cardMeta: { fontSize: 13, color: theme.inkFaint, margin: '6px 0 8px' },
  cardDesc: { fontSize: 13, color: theme.inkSoft, lineHeight: 1.55 },
  rodape: { fontSize: 13, color: theme.inkFaint, marginTop: 20 },
};
