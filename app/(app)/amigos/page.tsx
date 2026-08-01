// app/(app)/amigos/page.tsx
// N11 — Amigos & Turmas. Seletor no topo: Amigos (convite+aceite+ranking, opt-in)
// e Turmas (grupos com código). Amigos só veem agregados — nunca conteúdo.
//
// Backlog da auditoria de 27/07 aplicado aqui: bloquear/denunciar (P1-5),
// confirmação nas ações destrutivas (P2-9), rotação do código de convite (P2-10)
// e exclusão de fato dos dados sociais (P2-12).
'use client';

import { Suspense, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, X, MoreHorizontal, ShieldOff } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateAfter } from '@/lib/cache-invalidation';
import { useToast } from '@/components/ui/ToastProvider';
import {
  getSocialOverview, enableSocial, disableSocial, findProfileByCode, sendFriendRequest,
  respondFriendRequest, removeFriendship, blockUser, unblockUser, listMyBlocks, reportUser,
  rotateInviteCode, deleteMySocialData, getPeerComparison,
  type SocialOverview, type PendingRequest, type BlockedUser, type PeerComparison,
} from '@/services/social.service';
import { Avatar, RankRow, QuietRow } from '@/components/features/social/SocialUI';
import { ReportDialog } from '@/components/features/social/ReportDialog';
import { TurmasTab } from '@/components/features/social/TurmasTab';
import { theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageContainer, PageHeader } from '@/components/ui/Page';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

// A mediana pode vir fracionária (grupo par), então "4,5 dias" é resultado
// legítimo — arredondar aqui esconderia a diferença entre 4 e 5.
function fmtDias(n: number): string {
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  return `${txt} ${n === 1 ? 'dia' : 'dias'}`;
}

function inviteUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/amigos/adicionar/${code}`;
}

type Tab = 'amigos' | 'turmas';

// Ação destrutiva pendente de confirmação. Antes, o "X" na linha do ranking
// desfazia a amizade num clique só, sem aviso e sem desfazer (P2-9).
type Confirmacao = {
  titulo: string;
  descricao: string;
  rotulo: string;
  acao: () => Promise<void>;
};

function AmigosContent() {
  const params = useSearchParams();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'turmas' ? 'turmas' : 'amigos');
  const [busy, setBusy] = useState(false);
  // Guard síncrono: `disabled={busy}` só vale após o re-render — dois cliques
  // no mesmo tick disparavam aceitar/recusar amizade duas vezes.
  const busyRef = useRef(false);
  const [code, setCode] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [denunciando, setDenunciando] = useState<{ userId: string; nome: string } | null>(null);

  const { data, isLoading } = useQuery<SocialOverview>({ queryKey: ['social-overview'], queryFn: getSocialOverview });
  const { data: bloqueados } = useQuery<BlockedUser[]>({
    queryKey: ['social-blocks'],
    queryFn: listMyBlocks,
    enabled: !!data?.profile.enabled,
  });
  const { data: pares } = useQuery<PeerComparison | null>({
    queryKey: ['peer-comparison'],
    queryFn: getPeerComparison,
    enabled: !!data?.profile.enabled,
  });

  function invalidate() {
    // Inclui a comparação com os pares: ela é calculada sobre o conjunto de
    // amigos, então aceitar/recusar/bloquear muda o resultado. A lista completa
    // do domínio 'social' vive em lib/cache-invalidation.ts.
    invalidateAfter(qc, 'social');
  }

  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await fn(); invalidate(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Algo deu errado.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function ativar() { await run(async () => { await enableSocial(); toast.success('Perfil social ativado! 🎉'); }); }
  async function aceitar(r: PendingRequest) { await run(async () => { await respondFriendRequest(r.friendshipId, 'accept'); toast.success('Agora vocês são amigos!'); }); }
  async function recusar(r: PendingRequest) { await run(() => respondFriendRequest(r.friendshipId, 'decline')); }
  async function cancelar(r: PendingRequest) { await run(() => removeFriendship(r.friendshipId, 'canceled')); }

  function pedirConfirmacao(c: Confirmacao) { setConfirmacao(c); }

  function confirmarDesfazer(nome: string, friendshipId: string) {
    pedirConfirmacao({
      titulo: `Desfazer amizade com ${nome}?`,
      descricao: 'Vocês somem do ranking um do outro. Dá para se adicionar de novo depois.',
      rotulo: 'Desfazer amizade',
      acao: () => removeFriendship(friendshipId),
    });
  }

  function confirmarBloqueio(nome: string, userId: string) {
    pedirConfirmacao({
      titulo: `Bloquear ${nome}?`,
      descricao: `A amizade é desfeita e ${nome} não consegue mais te enviar pedidos. Essa pessoa não é avisada do bloqueio. Você pode desbloquear quando quiser.`,
      rotulo: 'Bloquear',
      // Sem concordância de gênero sobre o nome de uma pessoa real.
      acao: async () => { await blockUser(userId); toast.success(`Pronto — ${nome} entrou na sua lista de bloqueios.`); },
    });
  }

  function confirmarDesativar() {
    pedirConfirmacao({
      titulo: 'Desativar seu perfil social?',
      descricao: 'Seus amigos param de ver seus números na hora. Suas amizades e turmas continuam salvas — é só reativar para voltar ao ranking.',
      rotulo: 'Desativar',
      acao: async () => { await disableSocial(); toast.success('Perfil social desativado.'); },
    });
  }

  function confirmarExclusao() {
    pedirConfirmacao({
      titulo: 'Apagar seus dados sociais?',
      descricao: 'Apaga seu perfil social, suas amizades, seus bloqueios e sua participação nas turmas. As turmas que VOCÊ criou são apagadas para todos os membros. Isso não dá para desfazer — seu histórico de estudo não é afetado.',
      rotulo: 'Apagar tudo',
      acao: async () => { await deleteMySocialData(); toast.success('Seus dados sociais foram apagados.'); },
    });
  }

  async function gerarNovoCodigo() {
    await run(async () => {
      await rotateInviteCode();
      toast.success('Código novo gerado. O link antigo parou de funcionar.');
    });
  }

  async function enviarDenuncia(reason: string, details: string) {
    if (!denunciando) return;
    await run(async () => {
      await reportUser(denunciando.userId, reason, details);
      setDenunciando(null);
      toast.success('Denúncia enviada. Obrigado por avisar.');
    });
  }

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

  // Menu de ações sobre outra pessoa. `friendshipId` ausente = ainda não é
  // amizade (pedido pendente), então não há o que desfazer.
  function menuPessoa(nome: string, userId: string, friendshipId?: string) {
    return (
      <Menu
        trigger={({ onClick }) => (
          <IconButton size="sm" aria-label={`Ações para ${nome}`} onClick={onClick} disabled={busy}>
            <MoreHorizontal size={16} strokeWidth={2} />
          </IconButton>
        )}
      >
        {friendshipId && (
          <MenuItem onClick={() => confirmarDesfazer(nome, friendshipId)}>Desfazer amizade</MenuItem>
        )}
        <MenuItem onClick={() => confirmarBloqueio(nome, userId)}>Bloquear</MenuItem>
        <MenuItem onClick={() => setDenunciando({ userId, nome })}>Denunciar</MenuItem>
      </Menu>
    );
  }

  const p = data?.profile;
  // `?? []` protege o render caso um cache do React Query anterior à introdução
  // do campo sobreviva a uma troca de código (HMR em dev) — sem isso o .length
  // derruba a página inteira no error boundary.
  const inativos = data?.inactive ?? [];
  const listaBloqueados = bloqueados ?? [];

  return (
    <PageContainer width="narrow">
      <PageHeader title="Amigos" subtitle="Constância é mais fácil em companhia. Estude com quem te cobra (no bom sentido)." />

      <div style={{ marginBottom: 18 }}>
        <SegmentedControl
          options={[{ value: 'amigos', label: 'Amigos' }, { value: 'turmas', label: 'Turmas' }]}
          value={tab}
          onChange={setTab}
          equalWidth={false}
        />
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
            <Badge variant="brand"><Check size={12} strokeWidth={2.5} />sequência</Badge>
            <Badge variant="brand"><Check size={12} strokeWidth={2.5} />minutos da semana</Badge>
            <Badge variant="brand"><Check size={12} strokeWidth={2.5} />% do edital</Badge>
            <Badge variant="neutral"><X size={12} strokeWidth={2.5} />conteúdo · erros · anotações</Badge>
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
            {/* P2-10: um link vazado valia para sempre — não havia como trocar. */}
            <button onClick={gerarNovoCodigo} disabled={busy} style={s.linkBtn}>
              Gerar um código novo (invalida o link antigo)
            </button>
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
                  {menuPessoa(r.name, r.userId)}
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

          {/* O3 — comparação com um grupo parecido em vez de um pódio de
              indivíduos. Só aparece com 5+ pessoas no mesmo edital que ativaram
              o perfil social; abaixo disso a RPC não devolve nada, porque
              "mediana de 2 pessoas" é identificação disfarçada de agregado. */}
          {pares && (
            <section style={s.card}>
              <div style={s.cardTitle}>Quem estuda para o mesmo concurso</div>
              <p style={s.body}>
                Entre as <b style={s.strong}>{pares.peersTotal} pessoas</b> que estudam para{' '}
                <b style={s.strong}>{pares.editalLabel}</b> por aqui, a mediana é de{' '}
                <b style={s.strong}>{fmtDias(pares.medianDaysOnTarget)}</b> na meta por semana.
                Você está em <b style={s.strong}>{fmtDias(pares.myDaysOnTarget)}</b>.
              </p>
              <p style={s.finePrint}>Só números do grupo — ninguém é identificado.</p>
            </section>
          )}

          <section style={s.card}>
            <div style={s.cardTitle}>Constância da semana</div>
            <p style={{ ...s.body, marginBottom: 14 }}>
              Dias em que cada um bateu a <b style={s.strong}>própria</b> meta diária — não é uma
              corrida de horas.
            </p>
            {data.ranking.length <= 1 && inativos.length === 0 ? (
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
                    daysOnTarget={f.daysOnTarget}
                    actions={!f.isMe ? menuPessoa(f.name, f.userId, f.friendshipId) : undefined}
                  />
                ))}
              </div>
            )}

            {/* Amigos que desativaram o perfil social. Ficam fora do ranking (não
                temos os números deles) mas seguem listados para poderem ser
                gerenciados — somem do ranking, não da sua lista de amizades. */}
            {inativos.length > 0 && (
              <div style={s.quietBlock}>
                {inativos.map((f) => (
                  <QuietRow
                    key={f.userId}
                    name={f.name}
                    avatarUrl={f.avatarUrl}
                    nota="perfil social desativado"
                    actions={menuPessoa(f.name, f.userId, f.friendshipId)}
                  />
                ))}
              </div>
            )}
          </section>

          {listaBloqueados.length > 0 && (
            <section style={s.card}>
              <div style={s.cardTitle}>Bloqueados</div>
              <p style={{ ...s.body, marginBottom: 12 }}>
                Estas pessoas não conseguem te enviar pedidos. Elas não sabem que foram bloqueadas.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {listaBloqueados.map((b) => (
                  <QuietRow
                    key={b.userId}
                    name={b.name}
                    avatarUrl={b.avatarUrl}
                    nota="bloqueado"
                    actions={(
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ padding: '6px 10px', fontSize: 13, flexShrink: 0 }}
                        disabled={busy}
                        onClick={() => run(async () => { await unblockUser(b.userId); toast.success(`${b.name} saiu da sua lista de bloqueios.`); })}
                      >
                        <ShieldOff size={13} strokeWidth={2} /> Desbloquear
                      </Button>
                    )}
                  />
                ))}
              </div>
            </section>
          )}

          <div style={s.rodape}>
            <button onClick={confirmarDesativar} disabled={busy} style={s.disableBtn}>Desativar perfil social</button>
            {/* P2-12: "desativar" só esconde os números; faltava a exclusão. */}
            <button onClick={confirmarExclusao} disabled={busy} style={s.deleteBtn}>Apagar meus dados sociais</button>
          </div>
        </>
      )}

      {confirmacao && (
        <ConfirmDialog
          title={confirmacao.titulo}
          description={confirmacao.descricao}
          confirmLabel={confirmacao.rotulo}
          danger
          onCancel={() => setConfirmacao(null)}
          onConfirm={() => {
            const { acao } = confirmacao;
            setConfirmacao(null);
            void run(acao);
          }}
        />
      )}

      {denunciando && (
        <ReportDialog
          nome={denunciando.nome}
          busy={busy}
          onCancel={() => setDenunciando(null)}
          onSubmit={enviarDenuncia}
        />
      )}
    </PageContainer>
  );
}

export default function AmigosPage() {
  return <Suspense fallback={null}><AmigosContent /></Suspense>;
}

const s: Record<string, CSSProperties> = {
  muted: { fontSize: 14, color: theme.inkFaint, padding: '16px 4px' },

  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 22, marginBottom: 16, minWidth: 0 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  cardH: { fontSize: 18, fontWeight: 800, color: theme.ink, margin: '0 0 8px', letterSpacing: -0.3 },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: 0 },
  finePrint: { fontSize: 12, color: theme.inkFaint, margin: '10px 0 0' },
  strong: { color: theme.ink, fontWeight: 700 },

  privacyRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 },

  inviteRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  codeBox: { fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, letterSpacing: 2, color: theme.ink, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 14px', flex: 1, minWidth: 120, textAlign: 'center' },
  addRow: { display: 'flex', gap: 8, marginTop: 12 },
  input: { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '10px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },
  linkBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '10px 2px 0', textDecoration: 'underline', display: 'block' },

  reqRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `0.5px solid ${theme.line}` },
  // minWidth:0: min-width:auto de um item flex com white-space:nowrap é o
  // próprio texto inteiro (não há quebra possível), então sem isto o nome
  // nunca encolhia — empurrava os botões Aceitar/Recusar para fora da linha
  // em vez de truncar com "…". reqTag (marginRight:auto) segue empurrando os
  // botões para a direita normalmente.
  reqName: { fontSize: 14, fontWeight: 600, color: theme.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 },
  reqTag: { fontSize: 12, color: theme.inkFaint, marginRight: 'auto' },

  rankList: { display: 'flex', flexDirection: 'column', gap: 6 },
  quietBlock: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 14, paddingTop: 12, borderTop: `0.5px solid ${theme.line}` },

  rodape: { display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' },

  primary: { padding: '11px 20px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  secondary: { padding: '11px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  disableBtn: { border: 'none', background: 'transparent', color: theme.inkFaint, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', textDecoration: 'underline' },
  deleteBtn: { border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', textDecoration: 'underline' },
};
