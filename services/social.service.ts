// services/social.service.ts
// N11 Fase 1 — Camada social (Amigos). Opt-in: nada acontece até enableSocial().
// Amigos só veem AGREGADOS (sequência, minutos da semana, % edital), nunca
// conteúdo. Leituras da tela vêm da RPC get_social_connections (resolve nomes de
// pedidos pendentes, que a RLS ainda não deixaria ler). Stats são denormalizados
// em social_profiles e empurrados pelo próprio cliente (pushMyStats).
//
// Regra de exposição (migration 20260727120000, auditoria de 27/07): a RPC
// resolve nome/avatar sempre, mas só devolve os agregados quando a amizade está
// 'accepted' E o outro lado continua com o perfil ativo. Antes ela ignorava as
// duas condições, então um pedido pendente já entregava os números do alvo e
// "Desativar perfil social" não escondia nada de quem já era amigo.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { track, EV } from '@/lib/analytics';

export interface SocialProfile {
  userId: string;
  enabled: boolean;
  inviteCode: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendRank {
  userId: string;
  friendshipId?: string;
  name: string;
  avatarUrl: string | null;
  streak: number;
  weekMinutes: number;
  coveragePct: number;
  daysOnTarget: number;
  isMe?: boolean;
}

// Amigo que desativou o perfil social. Continua sendo amigo (a linha existe e
// pode ser desfeita), mas os agregados dele não vêm mais — a RPC devolve zeros.
// Fica fora do ranking: exibir 0 min ali seria uma comparação falsa.
export interface InactiveFriend {
  friendshipId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface PendingRequest {
  friendshipId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  direction: 'incoming' | 'outgoing';
}

export interface SocialOverview {
  profile: SocialProfile;
  ranking: FriendRank[];
  inactive: InactiveFriend[];
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
}

interface ConnRow {
  friendship_id: string;
  other_id: string;
  status: string;
  direction: 'incoming' | 'outgoing' | 'friend';
  name: string | null;
  avatar_url: string | null;
  streak_current: number;
  week_minutes: number;
  coverage_pct: number;
  days_on_target: number;
  enabled: boolean;
}

const NOME_PADRAO = 'Concurseiro(a)';

// Código de convite: 8 chars, sem caracteres ambíguos (0/O/1/I/L).
function genInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[arr[i] % alphabet.length];
  return out;
}

const MAX_NOME = 40;

// P1-6 — o nome de exibição é texto livre e aparece para todos os amigos e
// colegas de turma. Sem limite dava para gravar 5 mil caracteres (quebrando o
// layout de todo mundo); caracteres de controle passavam batido. O React já
// escapa o texto, então não há XSS — o risco aqui é abuso visual.
// Filtra por code point em vez de regex: caractere de controle dentro de uma
// classe de regex vira byte literal no arquivo, ilegivel e facil de quebrar
// num editor. Aqui a intencao fica explicita.
function ehInvisivel(cp: number): boolean {
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) return true;  // controles C0/C1 e DEL
  if (cp >= 0x200b && cp <= 0x200f) return true;             // largura zero + marcas LTR/RTL
  if (cp >= 0x202a && cp <= 0x202e) return true;             // overrides de direcao
  if (cp >= 0x2066 && cp <= 0x2069) return true;             // isolates de direcao
  return cp === 0xfeff;                                      // BOM
}

function sanitizeDisplayName(raw: string | null | undefined): string {
  const limpo = Array.from(raw ?? '')
    .filter((ch) => !ehInvisivel(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim()
    .slice(0, MAX_NOME);
  return limpo || NOME_PADRAO;
}

// P1-6 — o avatar de outra pessoa é renderizado como <img src> no ranking e o
// projeto não tem CSP, então uma URL arbitrária virava um beacon: cada amigo que
// abrisse a tela entregava IP e User-Agent ao servidor de quem escolheu a URL.
// Só aceitamos imagens do próprio Storage do projeto.
function sanitizeAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    return new URL(raw).origin === new URL(base).origin ? raw : null;
  } catch {
    return null; // não é URL absoluta válida
  }
}

// P3-15 — os services concatenavam error.message do PostgREST direto na tela
// ("column reference \"turma_id\" is ambiguous" apareceu num toast). O usuário
// recebe uma frase útil; o detalhe técnico vai para o console.
function mensagemAmigavel(error: { message: string; code?: string; details?: string | null; hint?: string | null }, fallback: string): string {
  // Objeto de erro do Postgrest/Error tem `message` não-enumerável — dar
  // console.error(error) direto vira "{}" no console (message some do
  // JSON.stringify/serialização), o mesmo defeito que lib/rpc-error.ts já
  // resolve para as RPCs migradas. Loga os campos separados.
  console.error('[social]', error.code, error.message, error.details ?? '', error.hint ?? '');
  if (/friendship_blocked/i.test(error.message)) return 'Não foi possível enviar o pedido.';
  if (/idx_friendships_unique_pair|duplicate key/i.test(error.message)) return 'Vocês já têm um pedido ou amizade em aberto.';
  if (/permission denied|row-level security/i.test(error.message)) return 'Você não tem permissão para isso.';
  if (/Failed to fetch|NetworkError/i.test(error.message)) return 'Sem conexão. Tente de novo.';
  return fallback;
}

// De onde saem nome e foto do perfil social.
//
// A foto do usuário mora em `auth.users.user_metadata.avatar_url` — é lá que a
// tela de perfil grava depois do upload para o bucket `avatar`. A coluna
// `profiles.avatar_url` existe mas está vazia para TODOS os usuários, e era só
// dela que o enableSocial lia: por isso nenhum avatar jamais apareceu no ranking
// de amigos ou de turmas, só a inicial do nome.
type PerfilRow = { full_name: string | null; avatar_url: string | null } | null;
type AuthUser = { email?: string; user_metadata?: Record<string, unknown> };

function identidadeDe(user: AuthUser, prof: PerfilRow) {
  const meta = user.user_metadata ?? {};
  // display_name PRIMEIRO: é o campo que a tela Perfil edita e o que a saudação
  // da Home usa (UserContext). Sem ele aqui, trocar o nome no Perfil mudava o
  // "Olá, X" mas o ranking dos amigos ficava com o nome de cadastro para
  // sempre — e o syncMySocialIdentity ainda revertia qualquer acerto manual.
  const nome = (typeof meta.display_name === 'string' && meta.display_name.trim() ? meta.display_name : '')
    || prof?.full_name
    || (typeof meta.full_name === 'string' ? meta.full_name : '')
    || user.email?.split('@')[0];
  const foto = (typeof meta.avatar_url === 'string' ? meta.avatar_url : null) ?? prof?.avatar_url;
  return {
    display_name: sanitizeDisplayName(nome),
    avatar_url: sanitizeAvatarUrl(foto),
  };
}

// Mantém nome e foto do perfil social em dia com o perfil de verdade. Sem isto,
// os dois eram um retrato tirado no dia da ativação: trocar a foto no perfil não
// mudava nada do que os amigos viam. Roda junto com o pushMyStats, no load.
export async function syncMySocialIdentity(): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return;

  const { data: sp } = await supabase.from('social_profiles')
    .select('enabled, display_name, avatar_url').eq('user_id', user.id).maybeSingle();
  if (!sp?.enabled) return;

  const { data: prof } = await supabase.from('profiles')
    .select('full_name, avatar_url').eq('id', user.id).maybeSingle();
  const novo = identidadeDe(user, prof);

  // Só escreve se mudou — este sync roda em todo carregamento do app.
  if (novo.display_name === sp.display_name && novo.avatar_url === sp.avatar_url) return;
  await supabase.from('social_profiles')
    .update({ ...novo, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
}

export async function getMySocialProfile(): Promise<SocialProfile | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;
  const { data } = await supabase.from('social_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (!data) return { userId: user.id, enabled: false, inviteCode: null, displayName: null, avatarUrl: null };
  return { userId: data.user_id, enabled: data.enabled, inviteCode: data.invite_code, displayName: data.display_name, avatarUrl: data.avatar_url };
}

export async function enableSocial(): Promise<SocialProfile> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');

  const [{ data: prof }, { data: existing }] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('social_profiles').select('invite_code').eq('user_id', user.id).maybeSingle(),
  ]);

  const invite_code = existing?.invite_code ?? genInviteCode();
  const { data, error } = await supabase.from('social_profiles').upsert({
    user_id: user.id,
    enabled: true,
    invite_code,
    ...identidadeDe(user, prof),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single();
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível ativar seu perfil social.'));

  await pushMyStats().catch(() => {});
  track(EV.socialEnabled);
  return { userId: data.user_id, enabled: data.enabled, inviteCode: data.invite_code, displayName: data.display_name, avatarUrl: data.avatar_url };
}

export async function disableSocial(): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return;
  const { error } = await supabase.from('social_profiles')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível desativar seu perfil social.'));
  track(EV.socialDisabled);
}

// Recalcula meus agregados NO SERVIDOR. Antes streak/minutos/cobertura eram
// calculados no browser e gravados pelo browser — qualquer um com o DevTools
// aberto liderava o ranking (auditoria de 27/07, P1-4). Agora o cliente não tem
// mais permissão de escrita nessas colunas; só pede o recálculo. O fuso vai
// junto porque o corte do dia local é feito no servidor.
export async function pushMyStats(): Promise<void> {
  const supabase = createClient();
  const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'America/Sao_Paulo';
  const { error } = await supabase.rpc('refresh_my_social_stats', { p_tz: tz });
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível atualizar seus números.'));
}

// Gera um código de convite novo. O antigo deixa de resolver na hora — é o
// remédio para um link vazado, que antes valia para sempre (P2-10).
export async function rotateInviteCode(): Promise<string> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');

  // Colisão é astronômicamente rara, mas a coluna é unique — tenta de novo.
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const code = genInviteCode();
    const { error } = await supabase.from('social_profiles')
      .update({ invite_code: code, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (!error) { track(EV.inviteCodeRotated); return code; }
    if (!/duplicate|unique/i.test(error.message)) {
      throw new Error(mensagemAmigavel(error, 'Não foi possível gerar um código novo.'));
    }
  }
  throw new Error('Não foi possível gerar um código novo. Tente de novo.');
}

// Apaga de fato os dados sociais (perfil, amizades, turmas, bloqueios).
// "Desativar" só esconde os números; isto é a exclusão (direito do titular).
export async function deleteMySocialData(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_my_social_data');
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível apagar seus dados sociais.'));
  track(EV.socialDataDeleted);
}

export async function findProfileByCode(code: string): Promise<{ userId: string; name: string; avatarUrl: string | null } | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('find_social_profile_by_code', { p_code: code.trim().toUpperCase() });
  const rows = (data ?? []) as { user_id: string; display_name: string | null; avatar_url: string | null }[];
  if (error || rows.length === 0) return null;
  return { userId: rows[0].user_id, name: rows[0].display_name ?? NOME_PADRAO, avatarUrl: rows[0].avatar_url ?? null };
}

export async function sendFriendRequest(targetUserId: string): Promise<'sent' | 'accepted'> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');
  if (user.id === targetUserId) throw new Error('Você não pode adicionar a si mesmo.');

  // Já existe conexão em qualquer direção? (RLS só retorna linhas onde sou parte.)
  const { data: existing } = await supabase.from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') throw new Error('Vocês já são amigos.');
    // O outro já havia me enviado → aceitar fecha a amizade.
    if (existing.addressee_id === user.id) {
      await respondFriendRequest(existing.id, 'accept');
      return 'accepted';
    }
    throw new Error('Pedido já enviado — aguardando resposta.');
  }

  const { error } = await supabase.from('friendships')
    .insert({ requester_id: user.id, addressee_id: targetUserId, status: 'pending' });
  // Duas barreiras novas caem aqui: o trigger de bloqueio (mensagem neutra de
  // propósito — dizer "você foi bloqueado" seria um oráculo) e o índice único
  // sobre o par ordenado, que agora vence a corrida de dois convites cruzados.
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível enviar o pedido.'));
  track(EV.friendRequested);
  return 'sent';
}

export async function respondFriendRequest(friendshipId: string, action: 'accept' | 'decline'): Promise<void> {
  const supabase = createClient();
  if (action === 'accept') {
    const { error } = await supabase.from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', friendshipId);
    if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível aceitar o pedido.'));
    track(EV.friendAccepted);
  } else {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível recusar o pedido.'));
    track(EV.friendDeclined);
  }
}

// Desfazer amizade ou cancelar um pedido enviado (ambos deletam a linha).
export async function removeFriendship(friendshipId: string, motivo: 'removed' | 'canceled' = 'removed'): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível remover.'));
  track(motivo === 'canceled' ? EV.friendRequestCanceled : EV.friendRemoved);
}

// ── Bloqueio e denúncia (P1-5) ─────────────────────────────────────────────
// Antes, recusar ou remover apenas apagava a linha: a mesma pessoa reenviava
// pedido indefinidamente e a vítima só podia recusar de novo, para sempre.

export interface BlockedUser {
  userId: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

// Bloquear desfaz a amizade/pedido existente e barra novos pedidos nos dois
// sentidos (trigger no banco). O bloqueado não consegue saber que foi bloqueado.
export async function blockUser(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível bloquear.'));
  track(EV.userBlocked);
}

export async function unblockUser(userId: string): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');
  const { error } = await supabase.from('social_blocks').delete()
    .eq('blocker_id', user.id).eq('blocked_id', userId);
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível desbloquear.'));
  track(EV.userUnblocked);
}

export async function listMyBlocks(): Promise<BlockedUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_my_blocks');
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível carregar sua lista de bloqueios.'));
  return ((data ?? []) as { blocked_id: string; name: string | null; avatar_url: string | null; created_at: string }[])
    .map((r) => ({ userId: r.blocked_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url, createdAt: r.created_at }));
}

export const MOTIVOS_DENUNCIA = [
  { value: 'nome_ofensivo', label: 'Nome ou foto ofensiva' },
  { value: 'assedio', label: 'Assédio ou intimidação' },
  { value: 'spam', label: 'Spam ou propaganda' },
  { value: 'perfil_falso', label: 'Perfil falso' },
  { value: 'outro', label: 'Outro' },
] as const;

export async function reportUser(userId: string, reason: string, details?: string): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) throw new Error('Você precisa estar logado.');
  const { error } = await supabase.from('social_reports').insert({
    reporter_id: user.id,
    reported_id: userId,
    reason: reason.slice(0, 40),
    details: details?.trim().slice(0, 1000) || null,
  });
  if (error) throw new Error(mensagemAmigavel(error, 'Não foi possível enviar a denúncia.'));
  track(EV.userReported, { reason });
}

// O3 — comparação com pares do MESMO edital, em vez de ranquear indivíduos.
// Só aparece com grupo de 5+ pessoas que ATIVARAM o perfil social, e devolve
// apenas contagem e mediana: nada individual. Enquanto o grupo for menor,
// simplesmente não há o que mostrar (é o caso hoje).
export interface PeerComparison {
  editalLabel: string;
  peersTotal: number;
  myDaysOnTarget: number;
  medianDaysOnTarget: number;
}

export async function getPeerComparison(): Promise<PeerComparison | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_peer_comparison');
  if (error) { console.error('[social]', error.code, error.message, error.details ?? '', error.hint ?? ''); return null; }
  const rows = (data ?? []) as {
    edital_label: string; peers_total: number; my_days_on_target: number; median_days_on_target: number | string;
  }[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    editalLabel: r.edital_label,
    peersTotal: r.peers_total,
    myDaysOnTarget: r.my_days_on_target,
    medianDaysOnTarget: Number(r.median_days_on_target),
  };
}

// P2-8 — quantos pedidos estão esperando resposta. Não havia aviso nenhum de
// pedido recebido (nem sino, nem badge, nem push): o convite só era descoberto
// se a pessoa entrasse em /amigos por conta própria. Contagem barata: a RLS já
// restringe friendships às linhas em que sou parte.
export async function getPendingRequestCount(): Promise<number> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return 0;
  const { count, error } = await supabase.from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('addressee_id', user.id)
    .eq('status', 'pending');
  if (error) return 0; // badge é enfeite: nunca deve quebrar a topbar
  return count ?? 0;
}

export async function getSocialOverview(): Promise<SocialOverview> {
  const supabase = createClient();
  const user = await getCachedUser();
  const empty: SocialProfile = { userId: '', enabled: false, inviteCode: null, displayName: null, avatarUrl: null };
  if (!user) return { profile: empty, ranking: [], inactive: [], incoming: [], outgoing: [] };

  const { data: mine } = await supabase.from('social_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const profile: SocialProfile = mine
    ? { userId: user.id, enabled: mine.enabled, inviteCode: mine.invite_code, displayName: mine.display_name, avatarUrl: mine.avatar_url }
    : { userId: user.id, enabled: false, inviteCode: null, displayName: null, avatarUrl: null };

  if (!profile.enabled) return { profile, ranking: [], inactive: [], incoming: [], outgoing: [] };

  // Atualiza meus stats e relê a própria linha para o "eu" do ranking.
  await pushMyStats().catch(() => {});
  const { data: me } = await supabase.from('social_profiles')
    .select('display_name, avatar_url, streak_current, week_minutes, coverage_pct, days_on_target')
    .eq('user_id', user.id).maybeSingle();

  const { data: conns } = await supabase.rpc('get_social_connections');
  const rows = (conns ?? []) as ConnRow[];

  const toPending = (r: ConnRow, dir: 'incoming' | 'outgoing'): PendingRequest => ({
    friendshipId: r.friendship_id, userId: r.other_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url, direction: dir,
  });

  const incoming = rows.filter((r) => r.direction === 'incoming').map((r) => toPending(r, 'incoming'));
  const outgoing = rows.filter((r) => r.direction === 'outgoing').map((r) => toPending(r, 'outgoing'));

  const accepted = rows.filter((r) => r.direction === 'friend');

  // Quem desativou o perfil não entra no ranking: a RPC zera os agregados dele,
  // e um amigo real aparecendo com 0 min seria pior que não aparecer.
  const friends: FriendRank[] = accepted
    .filter((r) => r.enabled)
    .map((r) => ({
      userId: r.other_id, friendshipId: r.friendship_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url,
      streak: r.streak_current, weekMinutes: r.week_minutes, coveragePct: r.coverage_pct,
      daysOnTarget: r.days_on_target,
    }));

  const inactive: InactiveFriend[] = accepted
    .filter((r) => !r.enabled)
    .map((r) => ({
      friendshipId: r.friendship_id, userId: r.other_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url,
    }));

  const self: FriendRank = {
    userId: user.id, name: me?.display_name ?? 'Você', avatarUrl: me?.avatar_url ?? null,
    streak: me?.streak_current ?? 0, weekMinutes: me?.week_minutes ?? 0, coveragePct: me?.coverage_pct ?? 0,
    daysOnTarget: me?.days_on_target ?? 0, isMe: true,
  };

  // Ordena por CONSTANCIA, nao por volume: podío de horas absoluto e o formato
  // que desengaja quem esta embaixo. Minutos viram apenas desempate final.
  const ranking = [...friends, self].sort(
    (a, b) => b.daysOnTarget - a.daysOnTarget || b.streak - a.streak || b.weekMinutes - a.weekMinutes,
  );
  return { profile, ranking, inactive, incoming, outgoing };
}
