// app/(app)/amigos/page.tsx
// N11 — Amigos & Turmas. Seletor no topo: Amigos (convite+aceite+ranking, opt-in)
// e Turmas (grupos com código). Amigos só veem agregados — nunca conteúdo.
'use client';

import { Suspense, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getSocialOverview, enableSocial, disableSocial, findProfileByCode, sendFriendRequest,
  respondFriendRequest, removeFriendship, type SocialOverview, type FriendRank, type PendingRequest,
} from '@/services/social.service';
import { Avatar, RankRow } from '@/components/features/social/SocialUI';
import { TurmasTab } from '@/components/features/social/TurmasTab';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { PageContainer, PageHeader } from '@/components/ui/Page';

function inviteUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/amigos/adicionar/${code}`;
}

type Tab = 'amigos' | 'turmas';

function AmigosContent() {
  const params = useSearchParams();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'turmas' ? 'turmas' : 'amigos');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [copiado, setCopiado] = useState(false);

  const { data, isLoading } = useQuery<SocialOverview>({ queryKey: ['social-overview'], queryFn: getSocialOverview });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['social-overview'] });

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); await invalidate(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Algo deu errado.'); }
    finally { setBusy(false); }
  }

  async function ativar() { await run(async () => { await enableSocial(); toast.success('Perfil social ativado! 🎉'); }); }
  async function desativar() { await run(async () => { await disableSocial(); toast.success('Perfil social desativado.'); }); }
  async function aceitar(r: PendingRequest) { await run(async () => { await respondFriendRequest(r.friendshipId, 'accept'); toast.success('Agora vocês são amigos!'); }); }
  async function recusar(r: PendingRequest) { await run(() => respondFriendRequest(r.friendshipId, 'decline')); }
  async function cancelar(r: PendingRequest) { await run(() => removeFriendship(r.friendshipId)); }
  async function desfazer(f: FriendRank) { if (f.friendshipId) await run(() => removeFriendship(f.friendshipId!)); }

  async function adicionarPorCodigo() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { toast.error('Código inválido.'); return; }
    await run(async () => {
      const prof = await findProfileByCode(c);
      if (!prof) throw new Error('Nenhum perfil encontrado para esse código.');
      const res = await sendFriendRequest(prof.userId);
      setCode('');
      toast.success(res === 'accepted' ? 'Vocês já eram pra ser amigos — feito!' : `Pedido enviado para ${prof.name}.`);
    });
  }

  function copiarLink(link: string) {
    navigator.clipboard?.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  }
  async function compartilharLink(link: string) {
    if (navigator.share) { try { await navigator.share({ title: 'Bora estudar junto no Focali', text: 'Me adiciona no Focali e vamos manter a constância juntos:', url: link }); } catch { /* cancelado */ } }
    else copiarLink(link);
  }

  const p = data?.profile;

  return (
    <PageContainer width="narrow">
      <PageHeader title="Amigos" subtitle="Constância é mais fácil em companhia. Estude com quem te cobra (no bom sentido)." />

      <div style={s.segmented}>
        <button onClick={() => setTab('amigos')} style={{ ...s.segBtn, ...(tab === 'amigos' ? s.segOn : {}) }}>Amigos</button>
        <button onClick={() => setTab('turmas')} style={{ ...s.segBtn, ...(tab === 'turmas' ? s.segOn : {}) }}>Turmas</button>
      </div>

      {tab === 'turmas' ? (
        <TurmasTab />
      ) : isLoading || !data ? (
        <p style={s.muted}>Carregando…</p>
      ) : !p?.enabled ? (
        <section style={s.card}>
          <h2 style={s.cardH}>Ative seu perfil social</h2>
          <p style={s.body}>
            Ao ativar, seus amigos passam a ver apenas seus <b style={s.strong}>números</b>: sequência,
            minutos estudados na semana e % do edital coberto. <b style={s.strong}>Nunca</b> o que você
            estuda, seus erros ou anotações. Você pode desativar quando quiser.
          </p>
          <div style={s.privacyRow}>
            <span style={s.pillOk}><Check size={12} strokeWidth={2.5} style={{ marginRight: 4, verticalAlign: -1 }} />sequência</span>
            <span style={s.pillOk}><Check size={12} strokeWidth={2.5} style={{ marginRight: 4, verticalAlign: -1 }} />minutos da semana</span>
            <span style={s.pillOk}><Check size={12} strokeWidth={2.5} style={{ marginRight: 4, verticalAlign: -1 }} />% do edital</span>
            <span style={s.pillNo}><X size={12} strokeWidth={2.5} style={{ marginRight: 4, verticalAlign: -1 }} />conteúdo · erros · anotações</span>
          </div>
          <button onClick={ativar} disabled={busy} style={{ ...s.primary, marginTop: 18, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Ativando…' : 'Ativar perfil social'}
          </button>
        </section>
      ) : (
        <>
          <section style={s.card}>
            <div style={s.cardTitle}>Convidar amigos</div>
            <p style={s.body}>Compartilhe seu link ou código. Quem abrir vira seu amigo depois que você aceitar.</p>
            <div style={s.inviteRow}>
              <code style={s.codeBox}>{p.inviteCode}</code>
              <button onClick={() => copiarLink(inviteUrl(p.inviteCode ?? ''))} style={s.secondary}>{copiado ? 'Copiado!' : 'Copiar link'}</button>
              <Button onClick={() => compartilharLink(inviteUrl(p.inviteCode ?? ''))}>Compartilhar</Button>
            </div>
            <div style={s.addRow}>
              <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarPorCodigo()} placeholder="Tem um código? Cole aqui" style={s.input} aria-label="Código de amigo" />
              <button onClick={adicionarPorCodigo} disabled={busy} style={s.secondary}>Adicionar</button>
            </div>
          </section>

          {(data.incoming.length > 0 || data.outgoing.length > 0) && (
            <section style={s.card}>
              <div style={s.cardTitle}>Pedidos</div>
              {data.incoming.map((r) => (
                <div key={r.friendshipId} style={s.reqRow}>
                  <Avatar name={r.name} url={r.avatarUrl} />
                  <span style={s.reqName}>{r.name}</span>
                  <span style={s.reqTag}>quer te adicionar</span>
                  <Button size="sm" style={{ padding: '7px 13px', fontSize: 13, flexShrink: 0 }} onClick={() => aceitar(r)} disabled={busy}>Aceitar</Button>
                  <Button variant="outline" size="sm" style={{ padding: '7px 11px', fontSize: 13, flexShrink: 0 }} onClick={() => recusar(r)} disabled={busy}>Recusar</Button>
                </div>
              ))}
              {data.outgoing.map((r) => (
                <div key={r.friendshipId} style={s.reqRow}>
                  <Avatar name={r.name} url={r.avatarUrl} />
                  <span style={s.reqName}>{r.name}</span>
                  <span style={s.reqTag}>pedido enviado</span>
                  <Button variant="outline" size="sm" style={{ padding: '7px 11px', fontSize: 13, flexShrink: 0 }} onClick={() => cancelar(r)} disabled={busy}>Cancelar</Button>
                </div>
              ))}
            </section>
          )}

          <section style={s.card}>
            <div style={s.cardTitle}>Ranking da semana · minutos estudados</div>
            {data.ranking.length <= 1 ? (
              <p style={s.body}>Você ainda não tem amigos por aqui. Convide alguém com seu link acima — o ranking fica bem mais divertido a dois. 😉</p>
            ) : (
              <div style={s.rankList}>
                {data.ranking.map((f, i) => (
                  <RankRow
                    key={f.userId}
                    position={i}
                    name={f.name}
                    avatarUrl={f.avatarUrl}
                    isMe={f.isMe}
                    streak={f.streak}
                    weekMinutes={f.weekMinutes}
                    coveragePct={f.coveragePct}
                    onRemove={!f.isMe && f.friendshipId ? () => desfazer(f) : undefined}
                  />
                ))}
              </div>
            )}
          </section>

          <button onClick={desativar} disabled={busy} style={s.disableBtn}>Desativar perfil social</button>
        </>
      )}
    </PageContainer>
  );
}

export default function AmigosPage() {
  return <Suspense fallback={null}><AmigosContent /></Suspense>;
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 14, color: theme.inkFaint, padding: '16px 4px' },

  segmented: { display: 'inline-flex', gap: 2, padding: 3, borderRadius: theme.radiusPill, background: theme.muted, marginBottom: 18 },
  segBtn: { padding: '7px 20px', borderRadius: theme.radiusPill, border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  segOn: { background: theme.card, color: theme.ink, boxShadow: theme.shadow },

  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 22, marginBottom: 16, minWidth: 0 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  cardH: { fontSize: 18, fontWeight: 800, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.3 },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: 0 },
  strong: { color: theme.ink, fontWeight: 700 },

  privacyRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  pillOk: { fontSize: 12, fontWeight: 600, color: theme.tealDeep, background: theme.tealBg, padding: '5px 10px', borderRadius: theme.radiusPill },
  pillNo: { fontSize: 12, fontWeight: 600, color: theme.inkSoft, background: theme.muted, padding: '5px 10px', borderRadius: theme.radiusPill },

  inviteRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  codeBox: { fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, letterSpacing: 2, color: theme.ink, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 14px', flex: 1, minWidth: 120, textAlign: 'center' },
  addRow: { display: 'flex', gap: 8, marginTop: 12 },
  input: { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },

  reqRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `0.5px solid ${theme.line}` },
  reqName: { fontSize: 14, fontWeight: 600, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  reqTag: { fontSize: 12, color: theme.inkFaint, marginRight: 'auto' },

  rankList: { display: 'flex', flexDirection: 'column', gap: 6 },

  primary: { padding: '11px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  secondary: { padding: '11px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  miniPrimary: { padding: '7px 13px', borderRadius: theme.radiusXs, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  miniGhost: { padding: '7px 11px', borderRadius: theme.radiusXs, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  disableBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', textDecoration: 'underline' },
};
