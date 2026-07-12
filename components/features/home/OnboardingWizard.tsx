// components/features/home/OnboardingWizard.tsx
// Onboarding "primeiro dia mágico": 3 passos para o usuário novo sair com
// edital ativado + cronograma (ciclo) gerado + Plano de Hoje pronto, em <5 min.
// Passo 1: escolher concurso do Banco de Editais. Passo 2: ritmo (horas/dia).
// Passo 3: plano gerado — distribuição por peso e CTA para começar.
// OnboardingGate decide sozinho se aparece: só para usuário sem alvo e sem
// nenhuma sessão registrada, e respeita o "pular" (localStorage por usuário).
'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/components/layout/UserContext';
import { getOnboardingStatus } from '@/services/onboarding.service';
import { listCatalogEditais, activateCatalogEdital, type CatalogEdital } from '@/services/editaisCatalog.service';
import { buildPreview, type GeneratorPreview } from '@/services/scheduleGenerator.service';
import { createRule, type RecurrenceItemInput } from '@/services/recurrence.service';
import { getDailyTarget, setDailyTarget, setStudyAnchor } from '@/services/goals.service';
import { ANCORAS_SUGERIDAS } from '@/components/features/home/PactoEstudo';
import { refreshHomeAfterSession } from '@/lib/home-refresh';
import { theme, zIndex } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

function skipKey(userId: string) { return `focali_onboarding_skipped_${userId}`; }

// ─── Gate: decide se o wizard aparece ───────────────────────────────────────

export function OnboardingGate() {
  const [closed, setClosed] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: getOnboardingStatus,
    staleTime: Infinity,
  });

  const skipped = useMemo(() => {
    if (!status?.userId || typeof window === 'undefined') return false;
    return window.localStorage.getItem(skipKey(status.userId)) === '1';
  }, [status?.userId]);

  // ?onboarding=1 força o wizard (preview/demo) mesmo para usuário existente.
  const forced = typeof window !== 'undefined' && window.location.search.includes('onboarding=1');

  if (closed || !status?.userId) return null;
  if (!forced && (skipped || !status.isNew)) return null;

  return (
    <OnboardingWizard
      userId={status.userId}
      onClose={(rememberSkip) => {
        if (rememberSkip && typeof window !== 'undefined') {
          window.localStorage.setItem(skipKey(status.userId!), '1');
        }
        setClosed(true);
      }}
    />
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

const HORAS_CHIPS = [2, 3, 4, 6];

function fmtH(min: number) {
  const h = Math.floor(min / 60); const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function OnboardingWizard({ userId, onClose }: { userId: string; onClose: (rememberSkip: boolean) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { name } = useUser();

  const [step, setStep] = useState(0);
  const [editalId, setEditalId] = useState('');
  const [horas, setHoras] = useState('3');
  const [ancora, setAncora] = useState(''); // pacto de estudo (opcional)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<GeneratorPreview | null>(null);

  const { data: editais, isLoading } = useQuery<CatalogEdital[]>({
    queryKey: ['catalog-editais'],
    queryFn: listCatalogEditais,
  });

  const porArea = useMemo(() => {
    const map = new Map<string, CatalogEdital[]>();
    for (const e of editais ?? []) {
      // Edital sem conteúdo programático não tem o que ativar — oferecê-lo aqui
      // faria o usuário "ativar" e receber zero matérias no primeiro contato.
      if (e.subjectCount === 0) continue;
      const k = e.areaName ?? 'Outros';
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    return [...map.entries()];
  }, [editais]);

  const horasNum = Number(horas) || 0;

  // Ativa o edital escolhido, calcula a distribuição por peso e cria a regra
  // de ciclo — o Plano de Hoje passa a existir no fim deste passo.
  async function gerarPlano() {
    if (!editalId) { setError('Escolha um concurso.'); return; }
    if (horasNum <= 0) { setError('Informe quantas horas por dia você consegue estudar.'); return; }
    setBusy(true);
    setError('');
    try {
      const targetId = await activateCatalogEdital(editalId);
      const prev = await buildPreview(targetId, horasNum * 60);
      if (prev.subjects.length > 0) {
        const items: RecurrenceItemInput[] = prev.subjects.map((s, i) => ({
          subjectId: s.subjectId, plannedMinutes: s.minutesPerCycle, cycleOrder: i, position: i,
        }));
        await createRule({ mode: 'ciclo', endDate: null, cycleDailyMinutes: horasNum * 60, items });
      }
      // As horas declaradas viram também a meta diária (se ainda não houver uma).
      // Sem isso, o usuário dizia "3h/dia" e a Home seguia com meta 0 — e a Meta
      // Adaptativa sugeria "25min/dia" na mesma tela, contradizendo o wizard.
      try {
        const metaAtual = await getDailyTarget();
        if (metaAtual <= 0) await setDailyTarget(horasNum * 60);
      } catch (e) {
        console.error('Meta diária não definida (plano criado mesmo assim):', e);
      }
      // Pacto de estudo (opcional): intenção de implementação — vira o cue
      // diário do Plano de Hoje. Falha aqui não bloqueia o plano.
      if (ancora) {
        try { await setStudyAnchor(ancora); } catch (e) {
          console.error('Pacto não salvo (plano criado mesmo assim):', e);
        }
      }
      setPreview(prev);
      refreshHomeAfterSession(queryClient);
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      // O concurso recém-ativado alimenta a "Próxima prova" e o ciclo da Agenda —
      // sem invalidar aqui, os cards só apareciam depois de um F5.
      queryClient.invalidateQueries({ queryKey: ['target-exams'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-rules'] });
      queryClient.invalidateQueries({ queryKey: ['active-cycle'] });
      router.refresh();
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao montar seu plano. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  function irParaTargets() {
    // Caminho manual (montar edital / importar por colagem) — não insistir depois.
    if (typeof window !== 'undefined') window.localStorage.setItem(skipKey(userId), '1');
    router.push('/targets');
  }

  const editalSel = (editais ?? []).find((e) => e.id === editalId);

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Cabeçalho */}
        <div style={s.head}>
          <div style={s.brand}>Focali</div>
          <div style={s.dots}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ ...s.dot, ...(i === step ? s.dotOn : i < step ? s.dotDone : {}) }} />
            ))}
          </div>
        </div>

        {step === 0 && (
          <>
            <h2 style={s.h2}>{name ? `Olá, ${name}!` : 'Bem-vindo(a)!'} Qual é o seu concurso?</h2>
            <p style={s.sub}>Escolha um edital pronto — matérias, tópicos e pesos entram de uma vez.</p>

            <div style={s.listBox}>
              {isLoading && <p style={s.muted}>Carregando editais…</p>}
              {!isLoading && (editais?.length ?? 0) === 0 && (
                <p style={s.muted}>O banco de editais está em construção. Você pode montar o seu manualmente.</p>
              )}
              {porArea.map(([area, lista]) => (
                <div key={area}>
                  <div style={s.areaTitle}>{area}</div>
                  {lista.map((e) => {
                    const sel = editalId === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => { setEditalId(e.id); setError(''); }}
                        style={{ ...s.editalRow, ...(sel ? s.editalRowOn : {}) }}
                      >
                        <span style={{ ...s.radio, ...(sel ? s.radioOn : {}) }} />
                        <span style={s.editalInfo}>
                          <span style={s.editalTitle}>{[e.orgao, e.cargo].filter(Boolean).join(' · ')}</span>
                          <span style={s.editalMeta}>
                            {[e.banca, e.ano].filter(Boolean).join(' · ')}
                            {(e.banca || e.ano) && ' · '}
                            {e.subjectCount} matérias · {e.topicCount} tópicos
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <button onClick={irParaTargets} style={s.linkBtn}>
              Não achei meu concurso — montar ou colar meu edital
            </button>

            {error && <p style={s.error}>{error}</p>}

            <div style={s.actions}>
              <Button variant="ghost" onClick={() => onClose(true)}>Pular por enquanto</Button>
              <div style={{ flex: 1 }} />
              <Button
                onClick={() => { if (!editalId) { setError('Escolha um concurso para continuar.'); return; } setError(''); setStep(1); }}
              >
                Continuar
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={s.h2}>Quanto tempo você tem por dia?</h2>
            <p style={s.sub}>
              Vamos distribuir esse tempo entre as matérias de{' '}
              <b>{editalSel ? [editalSel.orgao, editalSel.cargo].filter(Boolean).join(' · ') : 'seu concurso'}</b>{' '}
              conforme o peso de cada uma na prova. Dá pra ajustar tudo depois.
            </p>

            <div style={s.chipsRow}>
              {HORAS_CHIPS.map((h) => {
                const on = horasNum === h && horas === String(h);
                return (
                  <button key={h} onClick={() => { setHoras(String(h)); setError(''); }} style={{ ...s.chip, ...(on ? s.chipOn : {}) }}>
                    {h}h
                  </button>
                );
              })}
              <div style={s.customWrap}>
                <input
                  type="number" min="1" max="16" inputMode="numeric"
                  value={horas} onChange={(e) => setHoras(e.target.value)}
                  style={s.customInput}
                  aria-label="Horas por dia"
                />
                <span style={s.customUnit}>h/dia</span>
              </div>
            </div>

            {/* Intenção de implementação (Atomic Habits) — opcional, sem fricção */}
            <div style={s.pactoBlock}>
              <span style={s.pactoLabel}>E quando você costuma conseguir estudar? <span style={s.pactoOpt}>(opcional)</span></span>
              <div style={s.pactoChips}>
                {ANCORAS_SUGERIDAS.map((a) => {
                  const on = ancora === a;
                  return (
                    <button key={a} onClick={() => setAncora(on ? '' : a)} style={{ ...s.chip, ...s.chipSm, ...(on ? s.chipOn : {}) }}>
                      depois {a}
                    </button>
                  );
                })}
              </div>
            </div>

            <p style={s.hint}>
              💡 Melhor prometer pouco e cumprir: constância vale mais que um dia heroico.
            </p>

            {error && <p style={s.error}>{error}</p>}

            <div style={s.actions}>
              <Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button>
              <div style={{ flex: 1 }} />
              <Button onClick={gerarPlano} disabled={busy}>
                {busy ? 'Montando seu plano…' : 'Gerar meu plano'}
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={s.h2}>🎉 Tudo pronto!</h2>
            <p style={s.sub}>
              {preview && preview.subjects.length > 0
                ? `Seu ciclo de ${fmtH(preview.totalMinutes)} por dia foi criado. É assim que seu tempo será dividido:`
                : 'Seu edital foi ativado! Monte seu cronograma quando quiser na aba Cronograma.'}
            </p>

            {preview && preview.subjects.length > 0 && (
              <div style={s.previewList}>
                {preview.subjects.map((p) => (
                  <div key={p.subjectId} style={s.previewRow}>
                    <span style={{ ...s.pDot, background: p.subjectColor }} />
                    <span style={s.previewName}>{p.subjectName}</span>
                    <span style={s.previewBar}>
                      <span style={{ ...s.previewFill, width: `${p.sharePct}%`, background: p.subjectColor }} />
                    </span>
                    <span style={s.previewTime}>{fmtH(p.minutesPerCycle)}</span>
                  </div>
                ))}
                {(() => {
                  // Piso de 30min × muitas matérias: a volta excede a carga diária.
                  // Sem o aviso, o usuário declara 3h e recebe uma volta de 4h30 sem entender.
                  const volta = preview.subjects.reduce((acc, p) => acc + p.minutesPerCycle, 0);
                  return volta > preview.totalMinutes ? (
                    <p style={s.cargaAviso}>
                      Uma volta completa soma <b>{fmtH(volta)}</b> (mínimo de 30min por matéria) — mais que
                      suas <b>{fmtH(preview.totalMinutes)}</b> diárias. Tudo bem: a volta atravessa mais de um
                      dia, girando na ordem acima.
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            <p style={s.hint}>
              O <b>Plano de Hoje</b>, logo aqui na Home, vai te dizer exatamente o que fazer a cada dia — revisar, treinar e estudar. Sem decisão, só execução.
            </p>

            <div style={s.actions}>
              <div style={{ flex: 1 }} />
              <Button onClick={() => onClose(false)}>
                Começar a estudar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: zIndex.modal, padding: 16 },
  modal: { background: theme.card, borderRadius: theme.radius, width: 'min(540px, 96vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: theme.shadowModal, fontFamily: theme.font, padding: 24 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  brand: { fontSize: 15, fontWeight: 800, color: theme.teal, letterSpacing: 0.2 },
  dots: { display: 'flex', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: theme.radiusPill, background: theme.muted },
  dotOn: { background: theme.teal, width: 22, transition: 'width .2s' },
  dotDone: { background: theme.tealSoft },

  h2: { fontSize: 19, fontWeight: 700, color: theme.ink, margin: 0, lineHeight: 1.35 },
  sub: { fontSize: 14, color: theme.inkSoft, margin: '6px 0 14px', lineHeight: 1.55 },

  listBox: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto', paddingRight: 4 },
  muted: { fontSize: 14, color: theme.inkSoft, padding: '8px 0' },
  areaTitle: { fontSize: 11, fontWeight: 700, color: theme.teal, letterSpacing: 0.6, textTransform: 'uppercase', margin: '10px 0 6px' },
  editalRow: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: theme.radiusSm, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.bg, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6, minWidth: 0 },
  editalRowOn: { borderColor: theme.teal, background: theme.tealBg },
  radio: { width: 16, height: 16, borderRadius: theme.radiusPill, border: `1.5px solid ${theme.line}`, flexShrink: 0, boxSizing: 'border-box' },
  radioOn: { borderWidth: 5, borderColor: theme.teal },
  editalInfo: { minWidth: 0, display: 'flex', flexDirection: 'column' },
  editalTitle: { fontSize: 14, fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  editalMeta: { fontSize: 12, color: theme.inkSoft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  linkBtn: { display: 'block', marginTop: 12, padding: 0, border: 'none', background: 'transparent', color: theme.teal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  chipsRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  chip: { padding: '10px 18px', borderRadius: 10, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.bg, color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  chipOn: { borderColor: theme.teal, background: theme.teal, color: theme.onTeal },
  customWrap: { position: 'relative', marginLeft: 4 },
  customInput: { width: 92, boxSizing: 'border-box', padding: '10px 44px 10px 12px', borderRadius: 10, borderWidth: 0.5, borderStyle: 'solid', borderColor: theme.line, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
  customUnit: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: theme.inkFaint, pointerEvents: 'none' },

  pactoBlock: { marginTop: 16 },
  pactoLabel: { display: 'block', fontSize: 13, fontWeight: 600, color: theme.inkSoft, marginBottom: 8 },
  pactoOpt: { fontWeight: 400, color: theme.inkFaint },
  pactoChips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chipSm: { padding: '7px 13px', fontSize: 13, borderRadius: theme.radiusPill },

  hint: { fontSize: 13, color: theme.tealDeep, background: theme.tealBg, padding: '10px 12px', borderRadius: theme.radiusSm, margin: '14px 0 0', lineHeight: 1.5 },

  previewList: { display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 0' },
  cargaAviso: { fontSize: 13, color: theme.inkSoft, background: theme.warnBg, padding: '9px 12px', borderRadius: theme.radiusSm, margin: '6px 0 0', lineHeight: 1.5 },
  previewRow: { display: 'flex', alignItems: 'center', gap: 10 },
  pDot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  previewName: { fontSize: 13, color: theme.ink, width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  previewBar: { flex: 1, height: 7, background: theme.muted, borderRadius: theme.radiusPill, overflow: 'hidden' },
  previewFill: { display: 'block', height: '100%', borderRadius: theme.radiusPill },
  previewTime: { fontSize: 13, fontWeight: 600, color: theme.inkSoft, width: 56, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },

  error: { color: theme.danger, fontSize: 13, margin: '12px 0 0' },
  actions: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 },
  skip: { padding: '10px 14px', borderRadius: theme.radiusSm, border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '11px 22px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
