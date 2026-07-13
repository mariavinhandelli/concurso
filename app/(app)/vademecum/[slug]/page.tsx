// app/(app)/vademecum/[slug]/page.tsx
// Leitor de lei: aba "Texto" (artigos com grifo/anotações/revisão/questão C/E,
// agrupados por capítulo, colapsáveis, com filtro por cor de grifo) e aba
// "Mapa de incidência" (heatmap de relevância).
'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Book } from 'lucide-react';
import { getLei, type Lei, type LeiArtigo } from '@/services/leis.service';
import { listInteracoesByLei, type LeiInteracao, type GrifoCor } from '@/services/leiInteracoes.service';
import { getQuestoesLei, agruparPorArtigo, type LeiQuestao } from '@/services/leiQuestoes.service';
import { GRIFO_CORES, GRIFO_CORES_ORDEM } from '@/lib/lei-grifos';
import { ArtigoCard } from '@/components/features/vademecum/ArtigoCard';
import { MapaIncidencia } from '@/components/features/vademecum/MapaIncidencia';
import { QuestoesBanco } from '@/components/features/vademecum/QuestoesBanco';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { EmptyState } from '@/components/ui/EmptyState';
import { pushRecent } from '@/lib/recents';
import { theme } from '@/lib/theme';

type Aba = 'texto' | 'mapa' | 'questoes';

interface Grupo {
  caminho: string;
  artigos: LeiArtigo[];
}

function emptyInteracao(artigoKey: string): LeiInteracao {
  return {
    id: '', user_id: '', artigo_key: artigoKey, favorito: false, grifos: [],
    anotacoes: null, is_review_active: false, next_review_date: null,
    interval_days: 0, repetitions: 0, last_reviewed: null, created_at: '', updated_at: '',
  };
}

export default function LeiReaderPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useUI();

  const [lei, setLei] = useState<Lei | null>(null);
  const [erro, setErro] = useState('');
  const [interacoes, setInteracoes] = useState<Map<string, LeiInteracao>>(new Map());
  const [questoesPorArtigo, setQuestoesPorArtigo] = useState<Map<string, LeiQuestao[]>>(new Map());
  const [questoes, setQuestoes] = useState<LeiQuestao[]>([]);
  const totalQuestoes = questoes.length;
  const [aba, setAba] = useState<Aba>('texto');
  const [abertos, setAbertos] = useState<Set<number>>(new Set([0]));
  const [busca, setBusca] = useState('');
  const [filtroCores, setFiltroCores] = useState<Set<GrifoCor>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getLei(slug)
      .then((l) => {
        if (cancelled) return;
        setLei(l);
        // M12: registra a lei nos "recentes" (client-side).
        pushRecent({ kind: 'lei', id: slug, label: l.nomeCurto, sublabel: l.nome, href: `/vademecum/${slug}` });
      })
      .catch((e) => { if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar a lei.'); });
    listInteracoesByLei(slug)
      .then((m) => { if (!cancelled) setInteracoes(m); })
      .catch(() => { /* leitura segue sem interações */ });
    getQuestoesLei(slug)
      .then((qs) => { if (!cancelled) { setQuestoesPorArtigo(agruparPorArtigo(qs)); setQuestoes(qs); } })
      .catch(() => { /* leitura segue sem questões */ });
    return () => { cancelled = true; };
  }, [slug]);

  // Grupos = artigos consecutivos com o mesmo caminho (capítulo/seção).
  const grupos = useMemo<Grupo[]>(() => {
    if (!lei) return [];
    const out: Grupo[] = [];
    for (const a of lei.artigos) {
      const caminho = a.caminho ?? 'Disposições';
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.caminho === caminho) ultimo.artigos.push(a);
      else out.push({ caminho, artigos: [a] });
    }
    return out;
  }, [lei]);

  // Filtro por cor: quando ativo, mostra lista plana dos artigos que têm ao
  // menos um grifo de alguma das cores selecionadas — útil pra "revisar só
  // meus prazos" ou "só minhas exceções" antes da prova.
  const filtroAtivo = filtroCores.size > 0;
  const artigosFiltrados = useMemo(() => {
    if (!lei || !filtroAtivo) return [];
    return lei.artigos.filter((a) => {
      const grifos = interacoes.get(a.key)?.grifos ?? [];
      return grifos.some((g) => g.cor && filtroCores.has(g.cor));
    });
  }, [lei, filtroAtivo, filtroCores, interacoes]);

  function toggleCorFiltro(cor: GrifoCor) {
    setFiltroCores((prev) => {
      const next = new Set(prev);
      if (next.has(cor)) next.delete(cor); else next.add(cor);
      return next;
    });
  }

  const handleUpdate = useCallback((artigoKey: string, patch: Partial<LeiInteracao>) => {
    setInteracoes((prev) => {
      const next = new Map(prev);
      const base = next.get(artigoKey) ?? emptyInteracao(artigoKey);
      next.set(artigoKey, { ...base, ...patch });
      return next;
    });
  }, []);

  const jumpTo = useCallback((numeroRaw: string) => {
    if (!lei) return;
    const numero = numeroRaw.trim().toLowerCase().replace(/^art\.?\s*/, '').replace(/[ºo°.\s]/g, '').toUpperCase();
    if (!numero) return;
    const artigo = lei.artigos.find((a) => a.numero.toUpperCase() === numero)
      ?? lei.artigos.find((a) => a.numero.split('-')[0] === numero);
    if (!artigo) { toast.info(`Não achei o art. ${numeroRaw} nesta lei.`); return; }

    setAba('texto');
    setFiltroCores(new Set());
    const gi = grupos.findIndex((g) => g.artigos.some((a) => a.key === artigo.key));
    if (gi >= 0) setAbertos((prev) => new Set(prev).add(gi));
    setTimeout(() => {
      document.getElementById(`art-${artigo.numero}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [lei, grupos, toast]);

  function toggleGrupo(i: number) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  if (erro) {
    return (
      <div style={{ ...s.wrap, padding: 40 }}>
        <EmptyState
          icon={<Book size={26} color={theme.teal} strokeWidth={1.8} />}
          title="Não encontramos essa lei"
          body="O endereço pode ter mudado ou a lei ainda não está no Vade Mecum. Volte à lista para escolher uma das leis disponíveis."
          action={{ label: '← Voltar ao Vade Mecum', onClick: () => router.push('/vademecum') }}
        />
      </div>
    );
  }
  if (!lei) {
    return <div style={{ ...s.wrap, padding: 40 }}><p style={{ color: theme.inkFaint }}>Carregando {slug}…</p></div>;
  }

  const totalGrifos = [...interacoes.values()].reduce((sum, i) => sum + i.grifos.length, 0);
  const emRevisao = [...interacoes.values()].filter((i) => i.is_review_active).length;

  // % da lei grifada — só sobre artigos vigentes (revogados não contam).
  const artigosVigentes = lei.artigos.filter((a) => !a.revogado);
  const artigosComGrifo = artigosVigentes.filter((a) => (interacoes.get(a.key)?.grifos.length ?? 0) > 0).length;
  const pctGrifado = artigosVigentes.length > 0 ? Math.round((artigosComGrifo / artigosVigentes.length) * 100) : 0;

  return (
    <div style={{ ...s.wrap, padding: isMobile ? '20px 16px' : '34px 40px' }}>
      {/* Cabeçalho */}
      <button onClick={() => router.push('/vademecum')} style={s.voltar}>← Vade Mecum</button>
      <div style={s.head}>
        <div style={{ minWidth: 0 }}>
          <h1 style={s.h1}>{lei.nomeCurto}</h1>
          <p style={s.sub}>{lei.nome} · atualizada em {lei.geradoEm}</p>
        </div>
        <div style={s.statsRow}>
          <span style={s.stat}><b>{pctGrifado}%</b> grifado</span>
          <span style={s.stat}><b>{totalGrifos}</b> marcações</span>
          <span style={s.stat}><b>{emRevisao}</b> em revisão</span>
        </div>
      </div>

      {/* Abas */}
      <div style={s.abas}>
        <button onClick={() => setAba('texto')} style={{ ...s.abaBtn, ...(aba === 'texto' ? s.abaOn : {}) }}>Texto</button>
        <button onClick={() => setAba('mapa')} style={{ ...s.abaBtn, ...(aba === 'mapa' ? s.abaOn : {}) }}>Mapa de incidência</button>
        {totalQuestoes > 0 && (
          <button onClick={() => setAba('questoes')} style={{ ...s.abaBtn, ...(aba === 'questoes' ? s.abaOn : {}) }}>
            Questões ({totalQuestoes})
          </button>
        )}
        <div style={{ flex: 1 }} />
        <form
          onSubmit={(e) => { e.preventDefault(); jumpTo(busca); setBusca(''); }}
          style={s.jumpForm}
        >
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="ir para art…"
            style={s.jumpInput}
            aria-label="Ir para artigo"
          />
        </form>
      </div>

      {aba === 'mapa' ? (
        <MapaIncidencia lei={lei} onNavigate={jumpTo} />
      ) : aba === 'questoes' ? (
        <QuestoesBanco lei={lei} questoes={questoes} onNavigate={jumpTo} />
      ) : (
        <>
          {/* Legenda + filtro por cor — clicar numa cor mostra só o que você marcou daquele tipo */}
          <div style={s.legenda}>
            <span style={s.legHint}>{filtroAtivo ? 'Filtrando por:' : 'Selecione um trecho para grifar, ou filtre:'}</span>
            {GRIFO_CORES_ORDEM.map((c) => {
              const ativo = filtroCores.has(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCorFiltro(c)}
                  style={{ ...s.legChip, ...(ativo ? s.legChipOn : {}) }}
                  title={`Mostrar só artigos com grifo "${GRIFO_CORES[c].label}"`}
                >
                  <span style={{ ...s.legDot, background: GRIFO_CORES[c].chip }} />
                  {GRIFO_CORES[c].label}
                </button>
              );
            })}
            {filtroAtivo && (
              <button onClick={() => setFiltroCores(new Set())} style={s.limparFiltro}>limpar filtro</button>
            )}
          </div>

          {filtroAtivo ? (
            <>
              <p style={s.filtroResumo}>
                {artigosFiltrados.length} artigo{artigosFiltrados.length === 1 ? '' : 's'} com marcações desse tipo
              </p>
              {artigosFiltrados.length === 0 ? (
                <p style={s.filtroVazio}>Nenhum artigo grifado com essa cor ainda.</p>
              ) : (
                artigosFiltrados.map((a) => (
                  <ArtigoCard
                    key={a.key}
                    artigo={a}
                    interacao={interacoes.get(a.key) ?? null}
                    onUpdate={handleUpdate}
                    questoes={questoesPorArtigo.get(a.key)}
                  />
                ))
              )}
            </>
          ) : (
            grupos.map((g, i) => {
              const aberto = abertos.has(i);
              const grifados = g.artigos.filter((a) => (interacoes.get(a.key)?.grifos.length ?? 0) > 0).length;
              return (
                <div key={i} style={s.grupo}>
                  <button onClick={() => toggleGrupo(i)} style={s.grupoHead}>
                    <span style={{ ...s.seta, transform: aberto ? 'rotate(90deg)' : 'none' }}>▸</span>
                    <span style={s.grupoNome}>{g.caminho}</span>
                    <span style={s.grupoMeta}>
                      {g.artigos[0].rotulo}–{g.artigos[g.artigos.length - 1].numero}
                      {grifados > 0 && ` · ${grifados} grifado${grifados === 1 ? '' : 's'}`}
                    </span>
                  </button>
                  {aberto && (
                    <div style={{ marginTop: 10 }}>
                      {g.artigos.map((a) => (
                        <ArtigoCard
                          key={a.key}
                          artigo={a}
                          interacao={interacoes.get(a.key) ?? null}
                          onUpdate={handleUpdate}
                          questoes={questoesPorArtigo.get(a.key)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrap: { maxWidth: 960, margin: '0 auto', fontFamily: theme.font },
  voltar: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 10 },
  head: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 },
  h1: { fontSize: 24, fontWeight: 700, color: theme.ink, margin: 0 },
  sub: { fontSize: 13, color: theme.inkSoft, margin: '4px 0 0' },
  statsRow: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  stat: { fontSize: 13, color: theme.inkSoft, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusPill, padding: '5px 12px' },
  abas: { display: 'flex', alignItems: 'center', gap: 6, borderBottom: `0.5px solid ${theme.line}`, marginBottom: 16, paddingBottom: 0, flexWrap: 'wrap' },
  abaBtn: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '10px 14px', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: 'transparent', marginBottom: -0.5 },
  abaOn: { color: theme.teal, borderBottomColor: theme.teal },
  jumpForm: { marginLeft: 'auto' },
  jumpInput: { width: 110, boxSizing: 'border-box', padding: '7px 10px', borderRadius: theme.radiusPill, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 13, color: theme.ink, fontFamily: 'inherit', outline: 'none', marginBottom: 6 },
  legenda: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 },
  legHint: { fontSize: 13, color: theme.inkFaint },
  legChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: theme.inkSoft, background: 'transparent', border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusPill, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' },
  legChipOn: { borderColor: theme.teal, background: theme.tealBg, color: theme.tealDeep, fontWeight: 600 },
  legDot: { width: 12, height: 12, borderRadius: 4, display: 'inline-block' },
  limparFiltro: { fontSize: 12, color: theme.inkFaint, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  filtroResumo: { fontSize: 13, color: theme.inkSoft, margin: '0 0 10px' },
  filtroVazio: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '30px 0' },
  grupo: { marginBottom: 8 },
  grupoHead: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  seta: { fontSize: 12, color: theme.inkFaint, transition: 'transform .15s', flexShrink: 0 },
  grupoNome: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  grupoMeta: { fontSize: 12, color: theme.inkFaint, marginLeft: 'auto', flexShrink: 0 },
};
