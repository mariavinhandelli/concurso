// app/(app)/vademecum/[slug]/page.tsx
// Leitor de lei: aba "Texto" (artigos com grifo/anotações/revisão/questão C/E,
// agrupados por capítulo, colapsáveis, com filtro por cor de grifo) e aba
// "Mapa de incidência" (heatmap de relevância).
'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Book, Star } from 'lucide-react';
import { getLei, type Lei, type LeiArtigo } from '@/services/leis.service';
import { listInteracoesByLei, type LeiInteracao, type GrifoCor } from '@/services/leiInteracoes.service';
import { getQuestoesLei, agruparPorArtigo, type LeiQuestao } from '@/services/leiQuestoes.service';
import { GRIFO_CORES, GRIFO_CORES_ORDEM } from '@/lib/lei-grifos';
import { ArtigoCard } from '@/components/features/vademecum/ArtigoCard';
import { MapaIncidencia } from '@/components/features/vademecum/MapaIncidencia';
import { QuestoesBanco } from '@/components/features/vademecum/QuestoesBanco';
import { useToast } from '@/components/ui/ToastProvider';
import { useUI } from '@/components/layout/UIContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { BackLink } from '@/components/ui/BackLink';
import { Skeleton } from '@/components/ui/Skeleton';
import { pushRecent } from '@/lib/recents';
import { theme } from '@/lib/theme';

type Aba = 'texto' | 'mapa' | 'questoes';

// Auditoria de performance (02/08) — mesmo teto já usado na busca por termo,
// agora também aplicado ao filtro por cor/favoritos (artigosFiltrados):
// ativar "Favoritos" ou um filtro de cor numa lei muito grifada (CF, CC, CP)
// montava TODOS os artigos batidos de uma vez, sem limite — cada ArtigoCard
// tem vários hooks/refs próprios, então isso podia travar o clique por um
// instante em leis muito grifadas.
const LIMITE_RESULTADOS = 80;

interface Grupo {
  caminho: string;
  artigos: LeiArtigo[];
}

// "2026-07-04" → "04/07/2026" (a data ISO crua no header parecia código).
function formatarDataGeracao(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Faixa de artigos do grupo ("Art. 1º–7"). O fim usa o `numero` cru, que só
// funciona para artigo numerado: com os anexos (numero "Anexo-II") saía
// "ANEXO I–Anexo-II". Fora da numeração comum, usa o rótulo — e grupo de um
// artigo só mostra o rótulo, sem intervalo.
function faixaDoGrupo(g: { artigos: LeiArtigo[] }): string {
  const ini = g.artigos[0];
  const fim = g.artigos[g.artigos.length - 1];
  if (ini === fim) return ini.rotulo;
  return `${ini.rotulo}–${/^\d/.test(fim.numero) ? fim.numero : fim.rotulo}`;
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
  const [termo, setTermo] = useState(''); // busca textual ativa (quando o input não é nº de artigo)
  const [filtroCores, setFiltroCores] = useState<Set<GrifoCor>>(new Set());
  // Marcadores livres têm rótulo escolhido pela usuária, não uma das 4 cores
  // fixas — o filtro por eles é por texto do rótulo (normalizado), não por cor.
  const [filtroLabels, setFiltroLabels] = useState<Set<string>>(new Set());

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

  // Numa lei grande a lista plana de grupos era o principal obstáculo: o Código
  // Civil abria com 316 cabeçalhos e ~19.500px de rolagem, e 312 deles repetiam
  // o mesmo "LIVRO …" do anterior num breadcrumb de até 150 caracteres. Aqui os
  // grupos passam a viver dentro do seu LIVRO/PARTE (primeiro segmento do
  // caminho), e cada grupo exibe só o que muda em relação a ele.
  // Leis pequenas não ganham esse nível a mais — abaixo do limiar o layout
  // continua exatamente como era.
  const LIMIAR_SECOES = 12;
  const secoes = useMemo(() => {
    if (grupos.length <= LIMIAR_SECOES) return null;
    // O primeiro segmento sozinho não serve para todo código: no CC ele é
    // "PARTE ESPECIAL", que sozinha juntaria 1.857 artigos numa seção só. Quando
    // existe um LIVRO depois da PARTE, o título vai até ele.
    const tituloDe = (caminho: string) => {
      const partes = caminho.split('›').map((p) => p.trim()).filter(Boolean);
      if (!partes.length) return 'Disposições';
      const iLivro = partes.findIndex((p) => /^LIVRO\b/i.test(p));
      return iLivro > 0 ? partes.slice(0, iLivro + 1).join(' › ') : partes[0];
    };

    const out: { titulo: string; grupos: { grupo: Grupo; indice: number }[] }[] = [];
    grupos.forEach((grupo, indice) => {
      const titulo = tituloDe(grupo.caminho);
      const ultima = out[out.length - 1];
      if (ultima && ultima.titulo === titulo) ultima.grupos.push({ grupo, indice });
      else out.push({ titulo, grupos: [{ grupo, indice }] });
    });
    return out;
  }, [grupos]);

  // Uma seção só precisa estar aberta se o usuário pediu; a primeira abre por
  // padrão para a lei não parecer vazia.
  const [secoesAbertas, setSecoesAbertas] = useState<Set<number>>(new Set([0]));
  function toggleSecao(i: number) {
    setSecoesAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  // rótulo do grupo sem o prefixo do livro em que ele já está
  function caminhoRelativo(caminho: string, titulo: string): string {
    const partes = caminho.split('›').map((p) => p.trim()).filter(Boolean);
    const doTitulo = titulo.split('›').map((p) => p.trim()).filter(Boolean);
    while (partes.length && doTitulo.length && partes[0] === doTitulo[0]) { partes.shift(); doTitulo.shift(); }
    return partes.join(' › ') || titulo;
  }

  // Filtro por cor: quando ativo, mostra lista plana dos artigos que têm ao
  // menos um grifo de alguma das cores selecionadas — útil pra "revisar só
  // meus prazos" ou "só minhas exceções" antes da prova.
  // Favoritar já existia, mas o favorito só aparecia no Ctrl+K — dentro do
  // leitor não havia como reencontrá-lo. Este filtro fecha o ciclo: marcar aqui,
  // reler aqui. Combina com o filtro de cor (interseção): "meus prazos favoritos".
  const [soFavoritos, setSoFavoritos] = useState(false);
  const totalFavoritos = useMemo(() => {
    if (!lei) return 0;
    return lei.artigos.reduce((n, a) => n + (interacoes.get(a.key)?.favorito ? 1 : 0), 0);
  }, [lei, interacoes]);

  // Rótulos únicos de marcadores livres nesta lei (texto normalizado → dados
  // pra render do chip) — vira mais uma opção de filtro, ao lado das 4 cores
  // fixas, ordenada pelas mais usadas primeiro.
  const labelsLivres = useMemo(() => {
    if (!lei) return [] as { key: string; label: string; corHex: string; count: number }[];
    const map = new Map<string, { key: string; label: string; corHex: string; count: number }>();
    for (const inter of interacoes.values()) {
      for (const g of inter.grifos) {
        if (g.cor !== 'livre' || !g.label?.trim()) continue;
        const key = g.label.trim().toLowerCase();
        const existente = map.get(key);
        if (existente) existente.count += 1;
        else map.set(key, { key, label: g.label.trim(), corHex: g.corHex || '#64748B', count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [lei, interacoes]);

  const filtroAtivo = filtroCores.size > 0 || filtroLabels.size > 0 || soFavoritos;
  const artigosFiltrados = useMemo(() => {
    if (!lei || !filtroAtivo) return { artigos: [] as LeiArtigo[], total: 0 };
    const todos = lei.artigos.filter((a) => {
      const inter = interacoes.get(a.key);
      if (soFavoritos && !inter?.favorito) return false;
      if (filtroCores.size === 0 && filtroLabels.size === 0) return true;
      return (inter?.grifos ?? []).some((g) => {
        if (g.cor && g.cor !== 'livre' && filtroCores.has(g.cor)) return true;
        if (g.cor === 'livre' && g.label && filtroLabels.has(g.label.trim().toLowerCase())) return true;
        return false;
      });
    });
    return { artigos: todos.slice(0, LIMITE_RESULTADOS), total: todos.length };
  }, [lei, filtroAtivo, filtroCores, filtroLabels, soFavoritos, interacoes]);

  function toggleCorFiltro(cor: GrifoCor) {
    setFiltroCores((prev) => {
      const next = new Set(prev);
      if (next.has(cor)) next.delete(cor); else next.add(cor);
      return next;
    });
  }

  function toggleLabelFiltro(key: string) {
    setFiltroLabels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
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
    setFiltroLabels(new Set());
    setSoFavoritos(false);
    setTermo('');
    const gi = grupos.findIndex((g) => g.artigos.some((a) => a.key === artigo.key));
    if (gi >= 0) setAbertos((prev) => new Set(prev).add(gi));
    // com o nível de seção, abrir só o grupo não basta: ele fica dentro de um
    // livro/parte que também pode estar fechado, e o scroll não acharia o alvo
    if (secoes && gi >= 0) {
      const si = secoes.findIndex((sec) => sec.grupos.some((x) => x.indice === gi));
      if (si >= 0) setSecoesAbertas((prev) => new Set(prev).add(si));
    }
    // Grupos grandes (ex.: art. 5º da CF, capítulos do CC) levam mais que um
    // frame para renderizar — tenta de novo até o elemento existir, senão o
    // scroll falhava em silêncio. Scroll instantâneo de propósito: o smooth é
    // cancelado pelos commits de render que ainda estão acontecendo no grupo.
    const tentarScroll = (tentativa: number) => {
      const el = document.getElementById(`art-${artigo.numero}`);
      if (el) { el.scrollIntoView({ block: 'start' }); return; }
      if (tentativa < 8) setTimeout(() => tentarScroll(tentativa + 1), 120 * (tentativa + 1));
    };
    setTimeout(() => tentarScroll(0), 80);
  }, [lei, grupos, secoes, toast]);

  // Busca textual: nº de artigo pula direto; qualquer outro texto vira busca
  // por termo no texto integral da lei (acentos e caixa ignorados).
  const submeterBusca = useCallback((valor: string) => {
    const v = valor.trim();
    if (!v) { setTermo(''); return; }
    const pareceArtigo = /^(art\.?\s*)?\d+[\dA-Za-z.ºo°-]*$/i.test(v);
    if (pareceArtigo) { jumpTo(v); return; }
    setAba('texto');
    setFiltroCores(new Set());
    setFiltroLabels(new Set());
    setTermo(v);
  }, [jumpTo]);

  const normalizarTexto = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const resultadoTermo = useMemo(() => {
    if (!lei || !termo) return null;
    const alvo = normalizarTexto(termo);
    const encontrados: LeiArtigo[] = [];
    let total = 0;
    for (const a of lei.artigos) {
      const bate = a.blocos.some((b) => normalizarTexto(b.texto).includes(alvo))
        || normalizarTexto(a.rotulo).includes(alvo);
      if (bate) {
        total += 1;
        if (encontrados.length < LIMITE_RESULTADOS) encontrados.push(a);
      }
    }
    return { artigos: encontrados, total };
  }, [lei, termo]);

  function toggleGrupo(i: number) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  if (erro) {
    return (
      <PageContainer width="narrow" style={{ padding: 40 }}>
        <EmptyState
          icon={<Book size={26} color={theme.teal} strokeWidth={1.8} />}
          title="Não encontramos essa lei"
          body="O endereço pode ter mudado ou a lei ainda não está no Vade Mecum. Volte à lista para escolher uma das leis disponíveis."
          action={{ label: '← Voltar ao Vade Mecum', onClick: () => router.push('/vademecum') }}
        />
      </PageContainer>
    );
  }
  if (!lei) {
    return (
      <PageContainer width="narrow">
        <Skeleton width={220} height={28} borderRadius={8} style={{ marginBottom: 20 }} />
        <Skeleton height={16} borderRadius={6} style={{ marginBottom: 10 }} />
        <Skeleton height={16} borderRadius={6} style={{ marginBottom: 10 }} />
        <Skeleton width="70%" height={16} borderRadius={6} />
      </PageContainer>
    );
  }

  const totalGrifos = [...interacoes.values()].reduce((sum, i) => sum + i.grifos.length, 0);
  const emRevisao = [...interacoes.values()].filter((i) => i.is_review_active).length;

  // % da lei grifada — só sobre artigos vigentes (revogados não contam).
  const artigosVigentes = lei.artigos.filter((a) => !a.revogado);
  const artigosComGrifo = artigosVigentes.filter((a) => (interacoes.get(a.key)?.grifos.length ?? 0) > 0).length;
  const pctGrifado = artigosVigentes.length > 0 ? Math.round((artigosComGrifo / artigosVigentes.length) * 100) : 0;

  return (
    <PageContainer width="narrow">
      {/* Cabeçalho */}
      <BackLink href="/vademecum">Vade Mecum</BackLink>
      <PageHeader
        title={lei.nomeCurto}
        subtitle={(
          <>
            {lei.nome} · atualizada em {formatarDataGeracao(lei.geradoEm)}
            {lei.fonteUrl && (
              <> · <a href={lei.fonteUrl} target="_blank" rel="noopener noreferrer" style={s.fonteLink}>fonte oficial ↗</a></>
            )}
          </>
        )}
        actions={(
          <div style={s.statsRow}>
            <span style={s.stat}><b>{pctGrifado}%</b> grifado</span>
            <span style={s.stat}><b>{totalGrifos}</b> marca{totalGrifos === 1 ? 'ção' : 'ções'}</span>
            <span style={s.stat}><b>{emRevisao}</b> em revisão</span>
          </div>
        )}
      />

      {/* Abas */}
      <div style={s.abas} role="tablist" aria-label="Seções da lei">
        <button role="tab" aria-selected={aba === 'texto'} onClick={() => setAba('texto')} style={{ ...s.abaBtn, ...(aba === 'texto' ? s.abaOn : {}) }}>Texto</button>
        <button role="tab" aria-selected={aba === 'mapa'} onClick={() => setAba('mapa')} style={{ ...s.abaBtn, ...(aba === 'mapa' ? s.abaOn : {}) }}>Mapa de incidência</button>
        {totalQuestoes > 0 && (
          <button role="tab" aria-selected={aba === 'questoes'} onClick={() => setAba('questoes')} style={{ ...s.abaBtn, ...(aba === 'questoes' ? s.abaOn : {}) }}>
            Questões ({totalQuestoes})
          </button>
        )}
        <div style={{ flex: 1 }} />
        <form
          onSubmit={(e) => { e.preventDefault(); submeterBusca(busca); setBusca(''); }}
          style={s.jumpForm}
        >
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="art. nº ou termo…"
            style={s.jumpInput}
            aria-label="Ir para artigo ou buscar termo no texto"
          />
        </form>
      </div>

      {aba === 'mapa' ? (
        <MapaIncidencia lei={lei} onNavigate={jumpTo} />
      ) : aba === 'questoes' ? (
        <QuestoesBanco lei={lei} questoes={questoes} onNavigate={jumpTo} />
      ) : (
        <>
          {/* Legenda + filtro por cor — clicar numa cor mostra só o que você marcou daquele tipo.
              No mobile o hint some (a primeira tela já é densa; os chips têm rótulo próprio). */}
          <div style={s.legenda}>
            {(!isMobile || filtroAtivo) && (
              <span style={s.legHint}>{filtroAtivo ? 'Filtrando por:' : 'Selecione um trecho para grifar, ou filtre:'}</span>
            )}
            {GRIFO_CORES_ORDEM.map((c) => {
              const ativo = filtroCores.has(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCorFiltro(c)}
                  aria-pressed={ativo}
                  style={{ ...s.legChip, ...(isMobile ? s.legChipTouch : {}), ...(ativo ? s.legChipOn : {}) }}
                  title={`Mostrar só artigos com grifo "${GRIFO_CORES[c].label}"`}
                >
                  <span style={{ ...s.legDot, background: GRIFO_CORES[c].chip }} />
                  {GRIFO_CORES[c].label}
                </button>
              );
            })}
            {labelsLivres.map((l) => {
              const ativo = filtroLabels.has(l.key);
              return (
                <button
                  key={l.key}
                  onClick={() => toggleLabelFiltro(l.key)}
                  aria-pressed={ativo}
                  style={{ ...s.legChip, ...(isMobile ? s.legChipTouch : {}), ...(ativo ? s.legChipOn : {}) }}
                  title={`Mostrar só artigos com o marcador "${l.label}"`}
                >
                  <span style={{ ...s.legDot, background: l.corHex }} />
                  {l.label} ({l.count})
                </button>
              );
            })}
            {/* Só aparece quando há favorito nesta lei: chip morto em lei sem
                favorito seria mais um item competindo por espaço no mobile. */}
            {totalFavoritos > 0 && (
              <button
                onClick={() => setSoFavoritos((v) => !v)}
                aria-pressed={soFavoritos}
                style={{ ...s.legChip, ...(isMobile ? s.legChipTouch : {}), ...(soFavoritos ? s.legChipOn : {}) }}
                title={soFavoritos ? 'Mostrar todos os artigos' : `Mostrar só os ${totalFavoritos} artigos que você favoritou`}
              >
                <Star size={12} strokeWidth={2} fill={soFavoritos ? 'currentColor' : 'none'} />
                Favoritos ({totalFavoritos})
              </button>
            )}
            {filtroAtivo && (
              <button onClick={() => { setFiltroCores(new Set()); setFiltroLabels(new Set()); setSoFavoritos(false); }} style={s.limparFiltro}>limpar filtro</button>
            )}
          </div>

          {termo && resultadoTermo ? (
            <>
              <p style={s.filtroResumo}>
                {resultadoTermo.total === 0
                  ? <>Nenhum artigo contém “{termo}”.</>
                  : <>
                      {resultadoTermo.total} artigo{resultadoTermo.total === 1 ? ' contém' : 's contêm'} “{termo}”
                      {resultadoTermo.total > resultadoTermo.artigos.length && ` (mostrando os ${resultadoTermo.artigos.length} primeiros)`}
                    </>}
                {' '}<button onClick={() => setTermo('')} style={s.limparFiltro}>limpar busca</button>
              </p>
              {resultadoTermo.artigos.map((a) => (
                <ArtigoCard
                  key={a.key}
                  artigo={a}
                  interacao={interacoes.get(a.key) ?? null}
                  onUpdate={handleUpdate}
                  questoes={questoesPorArtigo.get(a.key)}
                />
              ))}
            </>
          ) : filtroAtivo ? (
            <>
              <p style={s.filtroResumo}>
                {artigosFiltrados.total} artigo{artigosFiltrados.total === 1 ? '' : 's'}
                {soFavoritos && filtroCores.size > 0
                  ? ' favorito(s) com marcações desse tipo'
                  : soFavoritos ? ' favoritado' + (artigosFiltrados.total === 1 ? '' : 's')
                  : ' com marcações desse tipo'}
                {artigosFiltrados.total > artigosFiltrados.artigos.length && ` (mostrando os ${artigosFiltrados.artigos.length} primeiros)`}
              </p>
              {artigosFiltrados.artigos.length === 0 ? (
                <p style={s.filtroVazio}>
                  {soFavoritos && filtroCores.size > 0
                    ? 'Nenhum favorito tem grifo dessa cor.'
                    : soFavoritos ? 'Você ainda não favoritou nenhum artigo desta lei.'
                    : 'Nenhum artigo grifado com essa cor ainda.'}
                </p>
              ) : (
                artigosFiltrados.artigos.map((a) => (
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
          ) : (() => {
            const renderGrupo = (g: Grupo, i: number, rotulo: string) => {
              const aberto = abertos.has(i);
              const grifados = g.artigos.filter((a) => (interacoes.get(a.key)?.grifos.length ?? 0) > 0).length;
              return (
                <div key={i} style={s.grupo}>
                  <button onClick={() => toggleGrupo(i)} aria-expanded={aberto} style={s.grupoHead}>
                    <span style={{ ...s.seta, transform: aberto ? 'rotate(90deg)' : 'none' }}>▸</span>
                    <span style={s.grupoNome}>{rotulo}</span>
                    <span style={s.grupoMeta}>
                      {faixaDoGrupo(g)}
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
            };

            // lei pequena: lista plana, como sempre foi
            if (!secoes) return grupos.map((g, i) => renderGrupo(g, i, g.caminho));

            return secoes.map((sec, si) => {
              const abertaSec = secoesAbertas.has(si);
              const artigos = sec.grupos.reduce((n, x) => n + x.grupo.artigos.length, 0);
              return (
                <div key={sec.titulo + si} style={s.secao}>
                  <button onClick={() => toggleSecao(si)} aria-expanded={abertaSec} style={s.secaoHead}>
                    <span style={{ ...s.seta, transform: abertaSec ? 'rotate(90deg)' : 'none' }}>▸</span>
                    <span style={s.secaoNome}>{sec.titulo}</span>
                    <span style={s.secaoMeta}>{artigos} {artigos === 1 ? 'artigo' : 'artigos'}</span>
                  </button>
                  {abertaSec && (
                    <div style={s.secaoCorpo}>
                      {sec.grupos.map(({ grupo, indice }) =>
                        renderGrupo(grupo, indice, caminhoRelativo(grupo.caminho, sec.titulo)))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </>
      )}
    </PageContainer>
  );
}

const s: Record<string, CSSProperties> = {
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
  // No celular estes chips ficavam com 28px de altura — abaixo do alvo de toque
  // de 44px que o resto do app já adota (Matérias, Concursos, Agenda).
  legChipTouch: { minHeight: 44, padding: '8px 14px', fontSize: 13 },
  legChipOn: { borderColor: theme.teal, background: theme.tealBg, color: theme.tealDeep, fontWeight: 600 },
  legDot: { width: 12, height: 12, borderRadius: 4, display: 'inline-block' },
  limparFiltro: { fontSize: 12, color: theme.inkFaint, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 },
  filtroResumo: { fontSize: 13, color: theme.inkSoft, margin: '0 0 10px' },
  filtroVazio: { fontSize: 14, color: theme.inkFaint, textAlign: 'center', padding: '30px 0' },
  grupo: { marginBottom: 8 },
  grupoHead: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit' },

  // Nível de LIVRO/PARTE — só existe em lei grande (acima de 12 grupos).
  secao: { marginBottom: 10 },
  secaoHead: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, textAlign: 'left', background: theme.muted, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  secaoNome: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: theme.ink, lineHeight: 1.35 },
  secaoMeta: { fontSize: 12, color: theme.inkFaint, flexShrink: 0 },
  secaoCorpo: { marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${theme.line}` },
  seta: { fontSize: 12, color: theme.inkFaint, transition: 'transform .15s', flexShrink: 0 },
  grupoNome: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  grupoMeta: { fontSize: 12, color: theme.inkFaint, marginLeft: 'auto', flexShrink: 0 },
  fonteLink: { color: theme.teal, textDecoration: 'underline', fontWeight: 600 },
};
