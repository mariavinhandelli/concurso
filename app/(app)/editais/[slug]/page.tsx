// app/(app)/editais/[slug]/page.tsx
// Dashboard do Edital — a página que transforma cada edital do catálogo em
// entidade navegável: ficha, conteúdo programático com pesos, linha do tempo
// (com diff de retificações), comparador de edições, histórico do concurso,
// provas anteriores e o progresso da usuária quando o edital já foi ativado.
// Substitui o antigo EditalDetailModal (mesmo conteúdo, agora linkável).
'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, Check, Download, FileDown } from 'lucide-react';
import {
  activateCatalogEdital, followEdital, getCatalogEditalBySlug, getCatalogEditalSubjects,
  isFollowingEdital, listCatalogEditais, listConcursoStats, listEdicoes, listEditalUpdates,
  listPastPapers, unfollowEdital,
  type CatalogEdital, type CatalogEditalDetail, type CatalogEditalSubject,
  type ConcursoStat, type EditalEdicao, type EditalUpdate, type PastPaper,
} from '@/services/editaisCatalog.service';
import { getTargetTopicProgress } from '@/services/targetTopics.service';
import { tryGetUser } from '@/lib/supabase/requireUser';
import { daysUntilExam, countdownInfo, formatDateBR } from '@/lib/targets';
import { pushRecent } from '@/lib/recents';
import { track, EV } from '@/lib/analytics';
import { theme } from '@/lib/theme';
import { useUI } from '@/components/layout/UIContext';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';
import { EditalTimeline } from '@/components/features/editais/EditalTimeline';
import { SITUACAO_LABEL, SituacaoTag } from '@/components/features/editais/EditalCard';
import { EditalComparador, type ComparadorOption } from '@/components/features/editais/EditalComparador';
import { ConcursoStatsTable, PastPapersList } from '@/components/features/editais/EditalHistorico';

// Peso 1–5 da disciplina em pontos preenchidos (mesma leitura do antigo modal).
function WeightDots({ weight }: { weight: number }) {
  return (
    <span style={s.weightDots} title={`Peso ${weight} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ ...s.weightDot, background: n <= weight ? theme.teal : theme.line }} />
      ))}
    </span>
  );
}

export default function EditalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useUI();
  const queryClient = useQueryClient();
  const slug = params.slug as string;

  const [activating, setActivating] = useState(false);

  const { data: edital, isLoading, isError } = useQuery<CatalogEditalDetail | null>({
    queryKey: ['edital', slug],
    queryFn: () => getCatalogEditalBySlug(slug),
  });

  const editalId = edital?.id;
  const concursoKey = edital?.concursoKey ?? null;

  const { data: subjects, isError: subjectsError } = useQuery<CatalogEditalSubject[]>({
    queryKey: ['catalog-edital-subjects', editalId],
    queryFn: () => getCatalogEditalSubjects(editalId!),
    enabled: Boolean(editalId),
  });
  const { data: updates } = useQuery<EditalUpdate[]>({
    queryKey: ['catalog-edital-updates', editalId],
    queryFn: () => listEditalUpdates(editalId!),
    enabled: Boolean(editalId),
  });
  const { data: edicoes } = useQuery<EditalEdicao[]>({
    queryKey: ['edital-edicoes', concursoKey],
    queryFn: () => listEdicoes(concursoKey!),
    enabled: Boolean(concursoKey),
  });
  const { data: stats } = useQuery<ConcursoStat[]>({
    queryKey: ['edital-stats', concursoKey],
    queryFn: () => listConcursoStats(concursoKey!),
    enabled: Boolean(concursoKey),
  });
  const { data: papers } = useQuery<PastPaper[]>({
    queryKey: ['edital-papers', concursoKey],
    queryFn: () => listPastPapers(concursoKey!),
    enabled: Boolean(concursoKey),
  });
  // Catálogo inteiro só para popular o comparador — lista pequena e cacheada.
  const { data: todosEditais } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
    enabled: Boolean(editalId),
  });
  const { data: progresso } = useQuery<{ done: number; total: number }>({
    queryKey: ['edital-target-progress', edital?.targetId],
    queryFn: () => getTargetTopicProgress(edital!.targetId!),
    enabled: Boolean(edital?.targetId),
  });
  // Seguir novidades — quem ativou o concurso já é seguidor implícito.
  const { data: following } = useQuery<boolean>({
    queryKey: ['edital-follow', editalId],
    queryFn: () => isFollowingEdital(editalId!),
    enabled: Boolean(editalId) && !edital?.targetId,
  });
  const [togglingFollow, setTogglingFollow] = useState(false);

  async function handleToggleFollow() {
    if (!edital || togglingFollow) return;
    // Página pública: seguir exige conta — visitante vai para o login e volta.
    if (!(await tryGetUser())) {
      router.push(`/login?returnTo=/editais/${slug}`);
      return;
    }
    setTogglingFollow(true);
    const next = !following;
    queryClient.setQueryData(['edital-follow', edital.id], next);
    try {
      if (next) {
        await followEdital(edital.id);
        track(EV.editalFollowed, { slug: edital.slug });
        toast.success('Você será avisada quando sair novidade deste concurso.');
      } else {
        await unfollowEdital(edital.id);
        track(EV.editalUnfollowed, { slug: edital.slug });
      }
    } catch (err) {
      queryClient.setQueryData(['edital-follow', edital.id], !next);
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar acompanhamento.');
    } finally {
      setTogglingFollow(false);
    }
  }

  // Rastro para o Command Palette (Recentes) + instrumentação.
  // O ref evita evento duplicado quando o React Query refaz o fetch.
  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!edital || trackedSlug.current === edital.slug) return;
    trackedSlug.current = edital.slug;
    pushRecent({
      kind: 'edital',
      id: edital.slug,
      label: [edital.orgao, edital.cargo].filter(Boolean).join(' · '),
      sublabel: edital.banca ?? undefined,
      href: `/editais/${edital.slug}`,
    });
    track(EV.editalViewed, { slug: edital.slug });
  }, [edital]);

  // Outros cargos do mesmo órgão — derivado uma única vez do catálogo cacheado.
  const outrosCargos = useMemo(
    () => (todosEditais ?? []).filter((e) => edital != null && e.orgaoSlug === edital.orgaoSlug && e.id !== edital.id),
    [todosEditais, edital],
  );

  const comparadorOptions = useMemo<ComparadorOption[]>(() => {
    if (!edital) return [];
    const edicaoOpts: ComparadorOption[] = (edicoes ?? [])
      .filter((e) => e.id !== edital.id)
      .map((e) => ({
        id: e.id,
        label: `Edição ${e.ano ?? e.ultimaEdicao ?? '—'}${e.banca ? ` · ${e.banca}` : ''}`,
        mesmoConcurso: true,
      }));
    const outroOpts: ComparadorOption[] = (todosEditais ?? [])
      // Sem conteúdo programático curado não há o que comparar — o diff sairia
      // "tudo adicionado", que é enganoso.
      .filter((e) => e.id !== edital.id && e.subjectCount > 0 && (e.concursoKey == null || e.concursoKey !== edital.concursoKey))
      .map((e) => ({
        id: e.id,
        label: [e.orgao, e.cargo].filter(Boolean).join(' · '),
        mesmoConcurso: false,
      }));
    return [...edicaoOpts, ...outroOpts];
  }, [edital, edicoes, todosEditais]);

  async function handleActivate() {
    if (!edital || activating) return;
    if (edital.targetId) {
      router.push(`/targets/${edital.targetId}`);
      return;
    }
    // Página pública: ativar exige conta — visitante vai para o login e volta.
    if (!(await tryGetUser())) {
      router.push(`/login?returnTo=/editais/${slug}`);
      return;
    }
    setActivating(true);
    try {
      const targetId = await activateCatalogEdital(edital.id);
      track(EV.editalActivated, { slug: edital.slug });
      for (const key of [['catalog-editais'], ['target-exams'], ['edital', slug], ['edital-coverage'], ['raiox']]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(edital.subjectCount > 0
        ? 'Edital ativado — seu concurso está pronto.'
        : 'Concurso criado — monte a grade na aba "Montar edital" ou importe o PDF.');
      router.push(`/targets/${targetId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar edital.');
      setActivating(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer width="narrow">
        <Skeleton width={120} height={16} />
        <div style={{ height: 14 }} />
        <Skeleton width="60%" height={30} />
        <div style={{ height: 20 }} />
        {[1, 2, 3].map((i) => <div key={i} style={{ marginBottom: 10 }}><Skeleton height={90} borderRadius={theme.radiusSm} /></div>)}
      </PageContainer>
    );
  }

  if (isError || !edital) {
    return (
      <PageContainer width="narrow">
        <button onClick={() => router.push('/targets')} style={s.back}>← Banco de editais</button>
        <p style={{ color: theme.inkFaint, fontSize: 14 }}>
          {isError ? 'Não foi possível carregar o edital. Tente de novo.' : 'Edital não encontrado.'}
        </p>
      </PageContainer>
    );
  }

  const days = edital.examDate ? daysUntilExam(edital.examDate) : null;
  const cd = days !== null ? countdownInfo(days) : null;
  const cdColor = cd ? { danger: theme.danger, warn: theme.warn, ok: theme.teal, past: theme.inkFaint }[cd.tone] : theme.inkFaint;

  const totalQuestions = (subjects ?? []).reduce((acc, sub) => acc + (sub.numQuestions ?? 0), 0);
  const maxWeight = Math.max(1, ...(subjects ?? []).map((sub) => sub.weight));

  const facts: { label: string; value: string }[] = [
    { label: 'Status', value: SITUACAO_LABEL[edital.situacao] },
    ...(edital.banca ? [{ label: edital.situacao === 'vigente' ? 'Banca' : 'Última banca', value: edital.banca }] : []),
    ...(edital.ultimaEdicao ? [{ label: 'Última edição', value: String(edital.ultimaEdicao) }] : []),
    ...(edital.vagas != null ? [{ label: 'Vagas', value: edital.vagas.toLocaleString('pt-BR') }] : []),
    ...(edital.remuneracao != null ? [{ label: 'Remuneração', value: edital.remuneracao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }] : []),
    ...(edital.examDate ? [{ label: 'Prova', value: formatDateBR(edital.examDate) }] : []),
    ...(edital.inscricoesAte ? [{ label: 'Inscrições até', value: formatDateBR(edital.inscricoesAte) }] : []),
    ...(edital.uf ? [{ label: 'UF', value: edital.uf }] : []),
    ...(edital.nivel ? [{ label: 'Escolaridade', value: `Nível ${edital.nivel}` }] : []),
  ];

  const progressoPct = progresso && progresso.total > 0 ? Math.round((progresso.done / progresso.total) * 100) : 0;

  return (
    <PageContainer width="narrow">
      <button onClick={() => router.push('/targets')} style={s.back}>← Banco de editais</button>

      {/* ── Header ── */}
      <div style={s.headerRow}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h1 style={{ ...s.h1, fontSize: isMobile ? 24 : 28 }}>
            {[edital.orgao, edital.cargo].filter(Boolean).join(' · ')}
          </h1>
          <div style={s.tagRow}>
            <SituacaoTag situacao={edital.situacao} />
            {edital.isActivated && (
              <span style={{ ...s.activatedTag, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Ativado <Check size={12} strokeWidth={2.5} />
              </span>
            )}
            {edital.orgaoSlug && (
              <Link
                href={`/editais/orgao/${edital.orgaoSlug}`}
                style={s.orgaoChip}
                title="Ver todos os cargos deste órgão"
              >
                {edital.orgao} →
              </Link>
            )}
            {edital.areaName && <span style={s.metaChip}>{edital.areaName}</span>}
            {edital.uf && <span style={s.metaChip}>{edital.uf}</span>}
            {edital.nivel && <span style={s.metaChip}>Nível {edital.nivel}</span>}
            {edital.banca && <span style={s.metaChip}>{edital.banca}</span>}
          </div>
        </div>

        {cd && days !== null && (
          <div style={s.countdownBox}>
            <span style={{ ...s.countdownBig, color: cdColor }}>{days >= 0 ? days : '—'}</span>
            <span style={{ ...s.countdownLabel, color: cdColor }}>{cd.label}</span>
            <span style={s.countdownDate}>{formatDateBR(edital.examDate!)}</span>
          </div>
        )}
      </div>

      {/* ── Ações principais ── */}
      <div style={s.actionsRow}>
        <Button
          onClick={handleActivate}
          disabled={activating}
          loading={activating}
          title={edital.subjectCount === 0 && !edital.isActivated
            ? 'A grade desta edição ainda está em curadoria — você monta o edital depois de ativar'
            : undefined}
        >
          {edital.isActivated ? 'Abrir meu concurso →' : 'Ativar edital'}
        </Button>
        {edital.editalUrl && (
          <a
            href={edital.editalUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => track(EV.editalPdfDownloaded, { slug: edital.slug })}
            style={s.downloadBtn}
          >
            <Download size={15} strokeWidth={2} style={{ marginRight: 6 }} />
            Baixar edital (PDF)
          </a>
        )}
        {edital.targetId ? (
          <span style={s.followingHint} title="Você ativou este concurso — novidades chegam por notificação.">
            <BellRing size={14} strokeWidth={2} style={{ marginRight: 6, verticalAlign: -2 }} />
            Acompanhando
          </span>
        ) : (
          <Button
            variant="outline"
            onClick={handleToggleFollow}
            disabled={togglingFollow}
            style={following ? { borderColor: theme.teal, background: theme.tealBg, color: theme.teal } : undefined}
            title="Receba uma notificação quando sair retificação, notícia ou resultado deste concurso"
          >
            {following ? (
              <><BellRing size={15} strokeWidth={2} style={{ marginRight: 6 }} />Acompanhando<Check size={14} strokeWidth={2.5} style={{ marginLeft: 5 }} /></>
            ) : (
              <><Bell size={15} strokeWidth={2} style={{ marginRight: 6 }} />Acompanhar novidades</>
            )}
          </Button>
        )}
      </div>

      {/* Ativação parcial: sem grade curada, o concurso nasce com ficha,
          linha do tempo e notificações — a grade é montada pela usuária. */}
      {edital.subjectCount === 0 && !edital.isActivated && (
        <p style={s.semGradeHint}>
          A grade desta edição ainda está em curadoria. Ao ativar, seu concurso já nasce com ficha,
          linha do tempo e notificações — e você monta o edital na aba &quot;Montar edital&quot; ou importando o PDF.
        </p>
      )}

      <div style={s.sections}>
        {/* ── Seu progresso (só quando ativado) ── */}
        {edital.targetId && progresso && progresso.total > 0 && (
          <section style={s.card}>
            <div style={s.cardHead}>
              <div>
                <h2 style={s.cardTitle}>Seu progresso neste edital</h2>
                <p style={s.cardSub}>{progresso.done}/{progresso.total} tópicos concluídos</p>
              </div>
              <span style={{ ...s.bigPct, color: theme.teal }}>{progressoPct}%</span>
            </div>
            <div style={s.track}><div style={{ ...s.fill, width: `${progressoPct}%` }} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Button variant="outline" size="sm" style={{ borderColor: theme.teal, background: theme.tealBg, color: theme.teal }} onClick={() => router.push(`/targets/${edital.targetId}`)}>
                Abrir concurso →
              </Button>
            </div>
          </section>
        )}

        {/* ── Ficha ── */}
        <section style={s.card}>
          <h2 style={s.cardTitle}>Ficha do concurso</h2>
          <div style={{ ...s.factGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)' }}>
            {facts.map((f) => (
              <div key={f.label} style={s.fact}>
                <span style={s.factLabel}>{f.label}</span>
                <span style={s.factValue}>{f.value}</span>
              </div>
            ))}
          </div>
          {edital.aviso && <p style={s.avisoText}>{edital.aviso}</p>}
          {edital.verificadoEm && (
            <p style={s.verificadoText}>
              Informações verificadas em {formatDateBR(edital.verificadoEm)} — fontes oficiais e portais especializados.
            </p>
          )}
        </section>

        {/* ── Conteúdo programático + estatística de disciplinas ── */}
        <section id="disciplinas" style={s.card}>
          <div style={s.cardHead}>
            <h2 style={s.cardTitle}>Disciplinas e pesos</h2>
            <span style={s.sectionMeta}>
              {edital.subjectCount} matéria{edital.subjectCount === 1 ? '' : 's'} · {edital.topicCount} tópicos
              {totalQuestions > 0 && ` · ${totalQuestions} questões`}
            </span>
          </div>
          {subjectsError ? (
            // Erro ≠ vazio: sem isto o skeleton ficaria girando para sempre.
            <p style={s.mutedText}>Não foi possível carregar as disciplinas. Recarregue a página para tentar de novo.</p>
          ) : !subjects ? (
            <div style={{ marginTop: 12 }}><Skeleton height={120} borderRadius={theme.radiusSm} /></div>
          ) : subjects.length === 0 ? (
            <p style={s.mutedText}>
              Conteúdo programático em preparação — ative o edital para montar sua própria grade enquanto isso.
            </p>
          ) : (
            <div style={s.subjectList}>
              {subjects.map((sub) => {
                // Barra = participação da disciplina na prova: por questões
                // quando o edital fixa o nº, senão pelo peso curado (1–5).
                const share = totalQuestions > 0
                  ? (sub.numQuestions ?? 0) / totalQuestions
                  : sub.weight / maxWeight;
                return (
                  <div key={sub.name} style={s.subjectRow}>
                    <div style={s.subjectTop}>
                      <span style={s.subjectName}>{sub.name}</span>
                      <div style={s.subjectRight}>
                        <WeightDots weight={sub.weight} />
                        {sub.numQuestions != null ? (
                          <span style={s.questionBadge}>{sub.numQuestions} questões</span>
                        ) : (
                          <span style={s.questionBadgeMuted}>sem questões fixas</span>
                        )}
                      </div>
                    </div>
                    <div style={s.subjectMetaRow}>
                      <div style={s.shareTrack}>
                        <div style={{ ...s.shareFill, width: `${Math.round(share * 100)}%` }} />
                      </div>
                      <span style={s.subjectSub}>{sub.topicCount} tópico{sub.topicCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Linha do tempo ── */}
        {(updates?.length ?? 0) > 0 && (
          <section id="timeline" style={s.card}>
            <h2 style={{ ...s.cardTitle, marginBottom: 12 }}>Linha do tempo e notícias</h2>
            <EditalTimeline updates={updates!} />
          </section>
        )}

        {/* ── Comparador ── */}
        {comparadorOptions.length > 0 && edital.subjectCount > 0 && (
          <section id="comparar" style={s.card}>
            <h2 style={{ ...s.cardTitle, marginBottom: 12 }}>Comparar editais</h2>
            <EditalComparador
              editalAtualId={edital.id}
              editalAtualSlug={edital.slug}
              options={comparadorOptions}
            />
          </section>
        )}

        {/* ── Edições anteriores ── */}
        {(edicoes?.filter((e) => e.id !== edital.id).length ?? 0) > 0 && (
          <section style={s.card}>
            <h2 style={{ ...s.cardTitle, marginBottom: 12 }}>Edições deste concurso</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {edicoes!.filter((e) => e.id !== edital.id).map((e) => (
                <div key={e.id} style={s.edicaoRow}>
                  <span style={s.edicaoLabel}>
                    Edição {e.ano ?? e.ultimaEdicao ?? '—'}{e.banca ? ` · ${e.banca}` : ''}
                    {e.vagas != null ? ` · ${e.vagas.toLocaleString('pt-BR')} vagas` : ''}
                  </span>
                  {e.editalUrl && (
                    <a href={e.editalUrl} target="_blank" rel="noopener noreferrer" style={s.paperLink}>
                      <FileDown size={13} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -2 }} />Edital
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Outros cargos deste órgão ── */}
        {edital.orgaoSlug && outrosCargos.length > 0 && (
          <section style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Outros cargos de {edital.orgao}</h2>
              <Link href={`/editais/orgao/${edital.orgaoSlug}`} style={s.orgaoPageLink}>
                Ver órgão →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {outrosCargos.map((e) => (
                <Link key={e.id} href={`/editais/${e.slug}`} style={s.cargoRow}>
                  <span style={s.edicaoLabel}>{e.cargo || e.orgao}</span>
                  <SituacaoTag situacao={e.situacao} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Histórico do concurso (só com dado real curado) ── */}
        {(stats?.length ?? 0) > 0 && (
          <section id="historico" style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Histórico do concurso</h2>
              <span style={s.sectionMeta}>nota de corte, inscritos e nomeações por ano</span>
            </div>
            <ConcursoStatsTable stats={stats!} />
          </section>
        )}

        {/* ── Provas anteriores ── */}
        {(papers?.length ?? 0) > 0 && (
          <section id="provas" style={s.card}>
            <h2 style={s.cardTitle}>Provas anteriores</h2>
            <PastPapersList papers={papers!} situacao={edital.situacao} editalSlug={edital.slug} />
          </section>
        )}
      </div>
    </PageContainer>
  );
}

const s: Record<string, CSSProperties> = {
  back: { border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '10px 12px', marginBottom: 10, fontFamily: 'inherit', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: theme.radiusSm, marginLeft: -12, transition: 'background .12s' },

  headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  h1: { fontWeight: 800, color: theme.ink, letterSpacing: -0.6, margin: '0 0 10px', overflowWrap: 'break-word' },
  tagRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  activatedTag: { fontSize: 11, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '3px 9px', flexShrink: 0 },
  metaChip: { fontSize: 12, fontWeight: 500, color: theme.inkSoft, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, padding: '3px 8px' },
  orgaoChip: { fontSize: 12, fontWeight: 600, color: theme.teal, background: theme.tealBg, border: `0.5px solid ${theme.teal}`, borderRadius: theme.radiusXs, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' },
  orgaoPageLink: { display: 'inline-flex', alignItems: 'center', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', flexShrink: 0, textDecoration: 'none' },
  cargoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0, cursor: 'pointer', fontFamily: 'inherit', width: '100%', minHeight: 44, textDecoration: 'none' },

  countdownBox: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 },
  countdownBig: { fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  countdownLabel: { fontSize: 13, fontWeight: 600, marginTop: 4 },
  countdownDate: { fontSize: 12, color: theme.inkFaint, marginTop: 2 },

  actionsRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  semGradeHint: { fontSize: 12, color: theme.inkFaint, lineHeight: 1.55, margin: '-10px 0 20px', maxWidth: 560 },
  downloadBtn: { display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: theme.radiusSm, border: `1px solid ${theme.teal}`, background: theme.tealBg, color: theme.teal, fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' },
  followingHint: { display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: theme.teal, whiteSpace: 'nowrap' },

  sections: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, boxShadow: theme.shadow, padding: 18, minWidth: 0 },
  cardHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: theme.ink, margin: 0 },
  cardSub: { fontSize: 13, color: theme.inkFaint, margin: '3px 0 0', lineHeight: 1.5 },
  sectionMeta: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums' },
  bigPct: { fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  mutedText: { fontSize: 13, color: theme.inkFaint, margin: '10px 0 0' },

  track: { height: 6, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },

  factGrid: { display: 'grid', gap: 12, marginTop: 14 },
  fact: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  factLabel: { fontSize: 11, fontWeight: 600, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  factValue: { fontSize: 14, fontWeight: 600, color: theme.ink, overflowWrap: 'break-word' },
  avisoText: { fontSize: 12, color: theme.inkFaint, margin: '12px 0 0', lineHeight: 1.5, fontStyle: 'italic' },
  verificadoText: { fontSize: 11, color: theme.inkFaint, margin: '10px 0 0', paddingTop: 10, borderTop: `0.5px solid ${theme.line}` },

  subjectList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  subjectRow: { padding: '11px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  subjectTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', minWidth: 0 },
  subjectName: { fontSize: 14, color: theme.ink, fontWeight: 600, minWidth: 0 },
  subjectRight: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  subjectMetaRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  shareTrack: { flex: 1, height: 5, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  shareFill: { height: '100%', background: theme.teal, borderRadius: theme.radiusPill, transition: 'width 0.4s ease' },
  subjectSub: { fontSize: 12, color: theme.inkFaint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  weightDots: { display: 'inline-flex', gap: 3, alignItems: 'center' },
  weightDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  questionBadge: { fontSize: 12, fontWeight: 700, color: theme.teal, background: theme.tealBg, borderRadius: theme.radiusXs, padding: '4px 10px', whiteSpace: 'nowrap' },
  questionBadgeMuted: { fontSize: 12, fontWeight: 500, color: theme.inkFaint, whiteSpace: 'nowrap' },

  edicaoRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, minWidth: 0 },
  edicaoLabel: { fontSize: 13, fontWeight: 600, color: theme.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  paperLink: { fontSize: 13, fontWeight: 600, color: theme.teal, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
};
