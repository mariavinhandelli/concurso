'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listSimuladoSessions, type SimuladoSession } from '@/services/jurisInteracoes.service';
import { useUI } from '@/components/layout/UIContext';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function ScoreBar({ certas, total }: { certas: number; total: number }) {
  const pct = total > 0 ? Math.round((certas / total) * 100) : 0;
  const color = pct >= 70 ? theme.okDeep : pct >= 50 ? theme.warnDeep : theme.danger;
  const bg = pct >= 70 ? theme.okTint : pct >= 50 ? theme.warnTint : theme.dangerTint;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: theme.line, borderRadius: theme.radiusPill, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: theme.radiusPill, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, background: bg, borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>
        {certas}/{total} · {pct}%
      </span>
    </div>
  );
}

function SimuladoAnalytics({ sessions }: { sessions: SimuladoSession[] }) {
  // Evolução de score ao longo do tempo (últimas 10 sessões)
  const evolucao = sessions
    .slice()
    .reverse()
    .slice(-10)
    .map((s, i) => ({
      label: `#${i + 1}`,
      pct: s.total > 0 ? Math.round((s.certas / s.total) * 100) : 0,
    }));

  // Acerto por disciplina (todas as sessões)
  const discMap = new Map<string, { total: number; certas: number }>();
  for (const s of sessions) {
    for (const r of s.respostas) {
      const stat = discMap.get(r.disciplina) ?? { total: 0, certas: 0 };
      stat.total++;
      if (r.acertou) stat.certas++;
      discMap.set(r.disciplina, stat);
    }
  }
  const disciplinas = [...discMap.entries()]
    .map(([name, s]) => ({ name, pct: Math.round((s.certas / s.total) * 100), total: s.total }))
    .sort((a, b) => a.pct - b.pct);

  // Stats globais
  const totalQuestoes = sessions.reduce((s, x) => s + x.total, 0);
  const totalCertas = sessions.reduce((s, x) => s + x.certas, 0);
  const mediaGeral = totalQuestoes > 0 ? Math.round((totalCertas / totalQuestoes) * 100) : 0;
  const melhorScore = Math.max(...sessions.map((s) => s.total > 0 ? Math.round((s.certas / s.total) * 100) : 0));
  const piorDisc = disciplinas[0];

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Stats resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Média geral', value: `${mediaGeral}%`, color: mediaGeral >= 70 ? theme.okDeep : mediaGeral >= 50 ? theme.warnDeep : theme.danger },
          { label: 'Melhor score', value: `${melhorScore}%`, color: theme.tealDeep },
          { label: 'Total questões', value: String(totalQuestoes), color: theme.ink },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color, margin: '0 0 2px' }}>{value}</p>
            <p style={{ fontSize: 12, color: theme.inkFaint, margin: 0, fontWeight: 500 }}>{label}</p>
          </div>
        ))}
      </div>

      {piorDisc && piorDisc.pct < 70 && (
        <div style={{ background: theme.dangerTint, border: `0.5px solid rgba(239,68,68,.25)`, borderRadius: theme.radiusSm, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <strong style={{ color: theme.danger }}>Ponto crítico:</strong>
          <span style={{ color: theme.ink }}> {piorDisc.name} — {piorDisc.pct}% de acerto em {piorDisc.total} questões. Foque revisão aqui.</span>
        </div>
      )}

      {/* Evolução de score */}
      <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '16px 18px', marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 14px' }}>
          Evolução de score (últimas {evolucao.length} sessões)
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={evolucao} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.line} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.inkFaint }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => [`${v}%`, 'Acerto']} contentStyle={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, fontSize: 12 }} />
            <Line type="monotone" dataKey="pct" stroke={theme.teal} strokeWidth={2} dot={{ r: 3, fill: theme.teal }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Acerto por disciplina */}
      {disciplinas.length > 0 && (
        <div style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, padding: '16px 18px' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 14px' }}>
            Acerto por disciplina (todas as sessões)
          </p>
          <ResponsiveContainer width="100%" height={Math.max(120, disciplinas.length * 30)}>
            <BarChart layout="vertical" data={disciplinas} margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: theme.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: theme.ink }} axisLine={false} tickLine={false} width={110} />
              <Tooltip formatter={(v) => [`${v}%`, 'Acerto']} contentStyle={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusXs, fontSize: 12 }} />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}
                fill={theme.teal}
                label={{ position: 'right', formatter: (v: unknown) => `${v}%`, style: { fontSize: 11, fill: theme.inkSoft } }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function SimuladosPage() {
  const router = useRouter();
  const { isMobile } = useUI();
  const [sessions, setSessions] = useState<SimuladoSession[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listSimuladoSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  return (
    <PageContainer>
      <button
        onClick={() => router.push('/jurisprudencias')}
        style={{ border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 8 }}
      >
        ← Jurisprudências
      </button>

      <PageHeader
        title="Histórico de Simulados"
        actions={<Button size="sm" onClick={() => router.push('/jurisprudencias/lista')}>Novo simulado</Button>}
      />

      {sessions && sessions.length >= 2 && <SimuladoAnalytics sessions={sessions} />}

      {sessions === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 80, background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}`, animation: 'skeleton-pulse 1.4s ease-in-out infinite', animationDelay: `${(i - 1) * 0.1}s` }} />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: theme.card, borderRadius: theme.radius, border: `0.5px solid ${theme.line}` }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: theme.ink, margin: '0 0 8px' }}>Nenhum simulado ainda</p>
          <p style={{ fontSize: 13, color: theme.inkFaint, margin: '0 0 20px' }}>
            Complete um simulado na lista de jurisprudências para ver o histórico aqui.
          </p>
          <Button onClick={() => router.push('/jurisprudencias/lista')}>
            Ir para a lista
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map((s) => {
            const isOpen = expanded === s.id;
            const pct = s.total > 0 ? Math.round((s.certas / s.total) * 100) : 0;
            return (
              <div key={s.id} style={{ background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden' }}>
                {/* Header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  style={{ width: '100%', padding: '16px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: theme.inkFaint, flexShrink: 0 }}>{fmtDate(s.created_at)}</span>
                    <span style={{ fontSize: 12, color: theme.inkFaint }}>·</span>
                    <span style={{ fontSize: 12, color: theme.inkFaint }}>{s.total} questões</span>
                    <span style={{ fontSize: 12, color: theme.inkFaint }}>·</span>
                    <span style={{ fontSize: 12, color: theme.inkFaint }}>{fmtDuration(s.elapsed_secs)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: theme.inkFaint }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  <ScoreBar certas={s.certas} total={s.total} />
                </button>

                {/* Detalhes expandidos */}
                {isOpen && (
                  <div style={{ borderTop: `0.5px solid ${theme.line}`, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: theme.inkFaint, textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 6px' }}>
                      Questões ({s.respostas.length})
                    </p>
                    {s.respostas.map((r, idx) => (
                      <div
                        key={r.jurisId}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 12px', borderRadius: theme.radiusSm,
                          background: r.acertou ? theme.okTint : theme.dangerTint,
                          border: `0.5px solid ${r.acertou ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.acertou ? theme.okDeep : theme.danger, flexShrink: 0, marginTop: 1 }}>
                          {idx + 1}. {r.acertou ? '✓' : '✗'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: theme.ink, margin: '0 0 4px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {r.enunciado}
                          </p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: theme.inkFaint }}>{r.tribunal}</span>
                            <span style={{ fontSize: 11, color: theme.inkFaint }}>·</span>
                            <span style={{ fontSize: 11, color: theme.inkFaint }}>{r.disciplina}</span>
                            {!r.acertou && (
                              <>
                                <span style={{ fontSize: 11, color: theme.inkFaint }}>·</span>
                                <span style={{ fontSize: 11, color: theme.danger }}>
                                  Sua resposta: {r.resposta ? 'Certo' : 'Errado'} · Gabarito: {r.gabarito ? 'Certo' : 'Errado'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 70 ? theme.okDeep : pct >= 50 ? theme.warnDeep : theme.danger }}>
                        {pct >= 70 ? 'Ótimo resultado!' : pct >= 50 ? 'Pode melhorar.' : 'Continue praticando.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
