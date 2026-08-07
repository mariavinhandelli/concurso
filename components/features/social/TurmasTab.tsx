// components/features/social/TurmasTab.tsx
// N11 Fase 2 — aba Turmas dentro de /amigos. Lista minhas turmas; criar/entrar por
// código; selecionar abre o ranking do grupo inline (convite + sair/apagar).
'use client';

import { useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import {
  listMyTurmas, createTurma, joinTurmaByCode, getTurmaRanking, leaveTurma, removeMember, deleteTurma,
  type Turma, type TurmaMemberRank,
} from '@/services/turmas.service';
import { reportUser } from '@/services/social.service';
import { RankRow, QuietRow, disambiguateNames } from './SocialUI';
import { ReportDialog } from './ReportDialog';
import { theme } from '@/lib/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
  const [confirmacao, setConfirmacao] = useState<{ titulo: string; descricao: string; rotulo: string; acao: () => Promise<void> } | null>(null);
  const [denunciando, setDenunciando] = useState<{ userId: string; nome: string } | null>(null);

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

  const ativos = (ranking ?? []).filter((m) => m.enabled);
  const inativos = (ranking ?? []).filter((m) => !m.enabled);
  const nomeExibicao = disambiguateNames(ranking ?? []);

  // Ações sobre um membro. Denunciar vale para qualquer um (P1-5) — numa turma
  // você convive com gente que não é sua amiga e que você não escolheu.
  // Remover é só do dono, e agora pede confirmação em vez do "X" de um clique.
  // `nome` já vem desambiguado por disambiguateNames (colisão é mais provável
  // aqui que em Amigos: turma é gente que você não escolheu, não só quem você
  // adicionou de propósito).
  function menuMembro(m: TurmaMemberRank, nome: string) {
    if (m.isMe) return undefined;
    const podeRemover = !!selected?.isOwner;
    return (
      <Menu
        trigger={({ onClick }) => (
          <IconButton size="sm" aria-label={`Ações para ${nome}`} onClick={onClick} disabled={busy}>
            <MoreHorizontal size={16} strokeWidth={2} />
          </IconButton>
        )}
      >
        {podeRemover && (
          <MenuItem onClick={() => setConfirmacao({
            titulo: `Remover ${nome} da turma?`,
            descricao: 'A pessoa perde acesso ao ranking do grupo. Ela pode entrar de novo se ainda tiver o código — gere um código novo se não for isso que você quer.',
            rotulo: 'Remover',
            acao: () => removeMember(selected!.id, m.userId),
          })}>Remover da turma</MenuItem>
        )}
        <MenuItem onClick={() => setDenunciando({ userId: m.userId, nome })}>Denunciar</MenuItem>
      </Menu>
    );
  }

  // Os diálogos vivem nos dois ramos do return (lista e ranking), então ficam
  // num fragmento único em vez de duplicados.
  const dialogs = (
    <>
      {confirmacao && (
        <ConfirmDialog
          title={confirmacao.titulo}
          description={confirmacao.descricao}
          confirmLabel={confirmacao.rotulo}
          danger
          onCancel={() => setConfirmacao(null)}
          onConfirm={() => { const { acao } = confirmacao; setConfirmacao(null); void run(acao); }}
        />
      )}
      {denunciando && (
        <ReportDialog
          nome={denunciando.nome}
          busy={busy}
          onCancel={() => setDenunciando(null)}
          onSubmit={(reason, details) => run(async () => {
            await reportUser(denunciando.userId, reason, details);
            setDenunciando(null);
            toast.success('Denúncia enviada. Obrigado por avisar.');
          })}
        />
      )}
    </>
  );

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
          <div style={s.cardTitle}>Constância da semana</div>
          <p style={{ ...s.body, marginBottom: 14 }}>
            Dias em que cada um bateu a <b style={{ color: theme.ink, fontWeight: 700 }}>própria</b> meta
            diária — não é uma corrida de horas.
          </p>
          <div style={s.rankList}>
            {ativos.map((m, i) => {
              const nome = nomeExibicao.get(m.userId) ?? m.name;
              return (
                <RankRow
                  key={m.userId}
                  position={i}
                  name={nome}
                  avatarUrl={m.avatarUrl}
                  isMe={m.isMe}
                  streak={m.streak}
                  weekMinutes={m.weekMinutes}
                  daysOnTarget={m.daysOnTarget}
                  badge={m.role === 'owner' ? 'dono' : undefined}
                  actions={menuMembro(m, nome)}
                />
              );
            })}
          </div>

          {/* Membros com o perfil social desativado: seguem na turma, mas sem
              números. Fora do pódio — 0 min aqui seria uma comparação falsa. */}
          {inativos.length > 0 && (
            <div style={s.quietBlock}>
              {inativos.map((m) => {
                const nome = nomeExibicao.get(m.userId) ?? m.name;
                return (
                  <QuietRow
                    key={m.userId}
                    name={nome}
                    avatarUrl={m.avatarUrl}
                    isMe={m.isMe}
                    nota="perfil social desativado"
                    actions={menuMembro(m, nome)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {selected.isOwner ? (
          <button
            onClick={() => setConfirmacao({
              titulo: `Apagar a turma "${selected.name}"?`,
              descricao: 'A turma some para TODOS os membros, junto com o ranking do grupo. Não dá para desfazer.',
              rotulo: 'Apagar turma',
              acao: async () => { await deleteTurma(selected.id); setSelected(null); toast.success('Turma apagada.'); },
            })}
            style={s.dangerBtn}
            disabled={busy}
          >Apagar turma</button>
        ) : (
          <button
            onClick={() => setConfirmacao({
              titulo: `Sair da turma "${selected.name}"?`,
              descricao: 'Você some do ranking do grupo. Dá para entrar de novo se ainda tiver o código.',
              rotulo: 'Sair da turma',
              acao: async () => { await leaveTurma(selected.id); setSelected(null); toast.success('Você saiu da turma.'); },
            })}
            style={s.dangerBtn}
            disabled={busy}
          >Sair da turma</button>
        )}
        {dialogs}
      </>
    );
  }

  // ── Lista + criar/entrar ──
  return (
    <>
      <section style={s.card}>
        <div style={s.cardTitle}>Criar ou entrar numa turma</div>
        <div style={s.formRow}>
          <Input style={{ flex: 1 }} value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} placeholder="Nome da nova turma" aria-label="Nome da turma" />
          <Button onClick={criar} disabled={busy}>Criar</Button>
        </div>
        <div style={s.formRow}>
          <Input style={{ flex: 1 }} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && entrar()} placeholder="Entrar com um código" aria-label="Código da turma" />
          <Button variant="outline" onClick={entrar} disabled={busy}>Entrar</Button>
        </div>
      </section>

      <section style={s.card}>
        <div style={s.cardTitle}>Minhas turmas</div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={56} borderRadius={theme.radiusSm} />
            <Skeleton height={56} borderRadius={theme.radiusSm} />
          </div>
        ) : (turmas ?? []).length === 0 ? (
          <p style={s.body}>Você ainda não está em nenhuma turma. Crie uma e chame a galera, ou entre com um código.</p>
        ) : (
          <div style={s.turmaList}>
            {(turmas ?? []).map((t) => (
              <button key={t.id} onClick={() => setSelected(t)} style={s.turmaCard}>
                <span style={s.turmaCardName}>{t.name}</span>
                <span style={s.turmaCardMeta}>{t.memberCount} {t.memberCount === 1 ? 'membro' : 'membros'}{t.isOwner ? ' · você é dono' : ''}</span>
                <ChevronRight size={16} color={theme.inkFaint} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </section>
      {dialogs}
    </>
  );
}

const s: Record<string, CSSProperties> = {
  back: { border: 'none', background: 'transparent', color: theme.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '0 2px 12px' },
  card: { background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: theme.radius, boxShadow: theme.shadow, padding: 22, marginBottom: 16, minWidth: 0 },
  cardTitle: { fontSize: 12, fontWeight: 600, color: theme.inkFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  body: { fontSize: 14, color: theme.inkSoft, lineHeight: 1.6, margin: 0 },
  muted: { fontSize: 14, color: theme.inkFaint, margin: 0 },

  formRow: { display: 'flex', gap: 8, marginBottom: 10 },
  input: { flex: 1, boxSizing: 'border-box', padding: '10px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, fontSize: 14, color: theme.ink, fontFamily: 'inherit', outline: 'none' },

  turmaList: { display: 'flex', flexDirection: 'column', gap: 8 },
  turmaCard: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.bg, cursor: 'pointer', fontFamily: 'inherit' },
  // minWidth:0: sem isto, um nome de turma comprido não encolhia e empurrava
  // o contador de membros e a seta para fora do botão.
  turmaCardName: { fontSize: 15, fontWeight: 700, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 },
  turmaCardMeta: { fontSize: 13, color: theme.inkFaint, marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 },

  turmaHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, minWidth: 0 },
  // minWidth:0: mesmo problema de turmaCardName — nome comprido empurrava o
  // contador de membros para fora do cabeçalho em vez de truncar.
  turmaName: { fontSize: 18, fontWeight: 800, color: theme.ink, margin: 0, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 },
  turmaMeta: { fontSize: 13, color: theme.inkFaint, flexShrink: 0 },
  inviteRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  codeBox: { fontFamily: 'ui-monospace, monospace', fontSize: 16, fontWeight: 700, letterSpacing: 2, color: theme.ink, background: theme.bg, border: `0.5px solid ${theme.line}`, borderRadius: theme.radiusSm, padding: '10px 14px', flex: 1, minWidth: 110, textAlign: 'center' },

  rankList: { display: 'flex', flexDirection: 'column', gap: 6 },

  quietBlock: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 14, paddingTop: 12, borderTop: `0.5px solid ${theme.line}` },

  primary: { padding: '10px 18px', borderRadius: theme.radiusSm, border: 'none', background: theme.primary, color: theme.onTeal, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  secondary: { padding: '10px 16px', borderRadius: theme.radiusSm, border: `0.5px solid ${theme.line}`, background: theme.card, color: theme.ink, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  dangerBtn: { border: 'none', background: 'transparent', color: theme.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px', textDecoration: 'underline' },
};
