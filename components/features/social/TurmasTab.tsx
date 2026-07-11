// components/features/social/TurmasTab.tsx
// N11 Fase 2 — aba Turmas dentro de /amigos. Lista minhas turmas; criar/entrar por
// código; selecionar abre o ranking do grupo inline (convite + sair/apagar).
'use client';

import { useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/ToastProvider';
import {
  listMyTurmas, createTurma, joinTurmaByCode, getTurmaRanking, leaveTurma, removeMember, deleteTurma,
  type Turma, type TurmaMemberRank,
} from '@/services/turmas.service';
import { RankRow } from './SocialUI';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';

function turmaInviteUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/turmas/entrar/${code}`;
}

export function TurmasTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [nome, setNome] = useState('');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<Turma | null>(null);
  const [copiado, setCopiado] = useState(false);

  const { data: turmas, isLoading } = useQuery<Turma[]>({ queryKey: ['my-turmas'], queryFn: listMyTurmas });
  const { data: ranking } = useQuery<TurmaMemberRank[]>({
    queryKey: ['turma-ranking', selected?.id],
    queryFn: () => getTurmaRanking(selected!.id),
    enabled: !!selected,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['my-turmas'] });
    if (selected) qc.invalidateQueries({ queryKey: ['turma-ranking', selected.id] });
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); invalidate(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Algo deu errado.'); }
    finally { setBusy(false); }
  }

  async function criar() {
    if (!nome.trim()) { toast.error('Dê um nome à turma.'); return; }
    await run(async () => {
      const t = await createTurma(nome);
      setNome('');
      toast.success(`Turma "${t.name}" criada! Compartilhe o código ${t.joinCode}.`);
    });
  }
  async function entrar() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { toast.error('Código inválido.'); return; }
    await run(async () => {
      const res = await joinTurmaByCode(c);
      if (!res) throw new Error('Nenhuma turma encontrada para esse código.');
      setCode('');
      toast.success(`Você entrou na turma "${res.name}"!`);
    });
  }

  function copiarLink(link: string) {
    navigator.clipboard?.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  }
  async function compartilhar(nomeT: string, link: string) {
    if (navigator.share) { try { await navigator.share({ title: `Entra na turma ${nomeT} no Focali`, text: 'Bora estudar em grupo:', url: link }); } catch { /* cancelado */ } }
    else copiarLink(link);
  }

  // ── Ranking de uma turma ──
  if (selected) {
    return (
      <>
        <button onClick={() => setSelected(null)} style={s.back}>← Todas as turmas</button>
        <section style={s.card}>
          <div style={s.turmaHead}>
            <h2 style={s.turmaName}>{selected.name}</h2>
            <span style={s.turmaMeta}>{selected.memberCount} {selected.memberCount === 1 ? 'membro' : 'membros'}</span>
          </div>
          <div style={s.inviteRow}>
            <code style={s.codeBox}>{selected.joinCode}</code>
            <Button variant="outline" onClick={() => copiarLink(turmaInviteUrl(selected.joinCode))}>{copiado ? 'Copiado!' : 'Copiar link'}</Button>
            <Button onClick={() => compartilhar(selected.name, turmaInviteUrl(selected.joinCode))}>Convidar</Button>
          </div>
        </section>

        <section style={s.card}>
          <div style={s.cardTitle}>Ranking da semana · minutos estudados</div>
          <div style={s.rankList}>
            {(ranking ?? []).map((m, i) => (
              <RankRow
                key={m.userId}
                position={i}
                name={m.name}
                avatarUrl={m.avatarUrl}
                isMe={m.isMe}
                streak={m.streak}
                weekMinutes={m.weekMinutes}
                coveragePct={m.coveragePct}
                badge={m.role === 'owner' ? 'dono' : undefined}
                onRemove={selected.isOwner && !m.isMe ? () => run(() => removeMember(selected.id, m.userId)) : undefined}
              />
            ))}
          </div>
        </section>

        {selected.isOwner ? (
          <button onClick={() => run(async () => { await deleteTurma(selected.id); setSelected(null); toast.success('Turma apagada.'); })} style={s.dangerBtn} disabled={busy}>Apagar turma</button>
        ) : (
          <button onClick={() => run(async () => { await leaveTurma(selected.id); setSelected(null); toast.success('Você saiu da turma.'); })} style={s.dangerBtn} disabled={busy}>Sair da turma</button>
        )}
      </>
    );
  }

  // ── Lista + criar/entrar ──
  return (
    <>
      <section style={s.card}>
        <div style={s.cardTitle}>Criar ou entrar numa turma</div>
        <div style={s.formRow}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} placeholder="Nome da nova turma" style={s.input} aria-label="Nome da turma" />
          <Button onClick={criar} disabled={busy}>Criar</Button>
        </div>
        <div style={s.formRow}>
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && entrar()} placeholder="Entrar com um código" style={s.input} aria-label="Código da turma" />
          <Button variant="outline" onClick={entrar} disabled={busy}>Entrar</Button>
        </div>
      </section>

      <section style={s.card}>
        <div style={s.cardTitle}>Minhas turmas</div>
        {isLoading ? (
          <p style={s.muted}>Carregando…</p>
        ) : (turmas ?? []).length === 0 ? (
          <p style={s.body}>Você ainda não está em nenhuma turma. Crie uma e chame a galera, ou entre com um código.</p>
        ) : (
          <div style={s.turmaList}>
            {(turmas ?? []).map((t) => (
              <button key={t.id} onClick={() => setSelected(t)} style={s.turmaCard}>
                <span style={s.turmaCardName}>{t.name}</span>
                <span style={s.turmaCardMeta}>{t.memberCount} {t.memberCount === 1 ? 'membro' : 'membros'}{t.isOwner ? ' · você é dono' : ''}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  back: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '0 2px 12px' },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 22, marginBottom: 16, minWidth: 0 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: 0 },
  muted: { fontSize: 14, color: theme.inkFaint, margin: 0 },

  formRow: { display: 'flex', gap: 8, marginBottom: 10 },
  input: { flex: 1, boxSizing: 'border-box', padding: '10px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },

  turmaList: { display: 'flex', flexDirection: 'column', gap: 8 },
  turmaCard: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, cursor: 'pointer', fontFamily: 'inherit' },
  turmaCardName: { fontSize: 14.5, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  turmaCardMeta: { fontSize: 12.5, color: theme.inkFaint, marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 },

  turmaHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  turmaName: { fontSize: 18, fontWeight: 800, color: theme.ink, margin: 0, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  turmaMeta: { fontSize: 12.5, color: theme.inkFaint, flexShrink: 0 },
  inviteRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  codeBox: { fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, letterSpacing: 2, color: theme.ink, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 14px', flex: 1, minWidth: 110, textAlign: 'center' },

  rankList: { display: 'flex', flexDirection: 'column', gap: 6 },

  primary: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  secondary: { padding: '10px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  dangerBtn: { border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', textDecoration: 'underline' },
};
