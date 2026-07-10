// services/social.service.ts
// N11 Fase 1 — Camada social (Amigos). Opt-in: nada acontece até enableSocial().
// Amigos só veem AGREGADOS (sequência, minutos da semana, % edital), nunca
// conteúdo. Leituras da tela vêm da RPC get_social_connections (resolve nomes de
// pedidos pendentes, que a RLS ainda não deixaria ler). Stats são denormalizados
// em social_profiles e empurrados pelo próprio cliente (pushMyStats).

import { createClient } from '@/lib/supabase/client';
import { getStreak } from '@/services/streak.service';
import { getGoalsSummary } from '@/services/goals.service';
import { getEditalCoverage } from '@/services/coverage.service';
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
  isMe?: boolean;
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

export async function getMySocialProfile(): Promise<SocialProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('social_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (!data) return { userId: user.id, enabled: false, inviteCode: null, displayName: null, avatarUrl: null };
  return { userId: data.user_id, enabled: data.enabled, inviteCode: data.invite_code, displayName: data.display_name, avatarUrl: data.avatar_url };
}

export async function enableSocial(): Promise<SocialProfile> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    display_name: prof?.full_name || user.email?.split('@')[0] || NOME_PADRAO,
    avatar_url: prof?.avatar_url ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single();
  if (error) throw new Error('Erro ao ativar perfil social: ' + error.message);

  await pushMyStats().catch(() => {});
  track(EV.socialEnabled);
  return { userId: data.user_id, enabled: data.enabled, inviteCode: data.invite_code, displayName: data.display_name, avatarUrl: data.avatar_url };
}

export async function disableSocial(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('social_profiles')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
}

// Empurra meus agregados para social_profiles (só se o perfil está ativo).
export async function pushMyStats(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: sp } = await supabase.from('social_profiles').select('enabled').eq('user_id', user.id).maybeSingle();
  if (!sp?.enabled) return;

  const [streak, goals, coverage] = await Promise.all([
    getStreak().catch(() => null),
    getGoalsSummary().catch(() => null),
    getEditalCoverage().catch(() => null),
  ]);

  await supabase.from('social_profiles').update({
    streak_current: streak?.current ?? 0,
    week_minutes: goals?.weekMinutes ?? 0,
    coverage_pct: coverage?.pct ?? 0,
    stats_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id);
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
  const { data: { user } } = await supabase.auth.getUser();
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
  if (error) throw new Error('Erro ao enviar pedido: ' + error.message);
  track(EV.friendRequested);
  return 'sent';
}

export async function respondFriendRequest(friendshipId: string, action: 'accept' | 'decline'): Promise<void> {
  const supabase = createClient();
  if (action === 'accept') {
    const { error } = await supabase.from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', friendshipId);
    if (error) throw new Error('Erro ao aceitar: ' + error.message);
    track(EV.friendAccepted);
  } else {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) throw new Error('Erro ao recusar: ' + error.message);
  }
}

// Desfazer amizade ou cancelar um pedido enviado (ambos deletam a linha).
export async function removeFriendship(friendshipId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error('Erro ao remover: ' + error.message);
}

export async function getSocialOverview(): Promise<SocialOverview> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empty: SocialProfile = { userId: '', enabled: false, inviteCode: null, displayName: null, avatarUrl: null };
  if (!user) return { profile: empty, ranking: [], incoming: [], outgoing: [] };

  const { data: mine } = await supabase.from('social_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const profile: SocialProfile = mine
    ? { userId: user.id, enabled: mine.enabled, inviteCode: mine.invite_code, displayName: mine.display_name, avatarUrl: mine.avatar_url }
    : { userId: user.id, enabled: false, inviteCode: null, displayName: null, avatarUrl: null };

  if (!profile.enabled) return { profile, ranking: [], incoming: [], outgoing: [] };

  // Atualiza meus stats e relê a própria linha para o "eu" do ranking.
  await pushMyStats().catch(() => {});
  const { data: me } = await supabase.from('social_profiles')
    .select('display_name, avatar_url, streak_current, week_minutes, coverage_pct')
    .eq('user_id', user.id).maybeSingle();

  const { data: conns } = await supabase.rpc('get_social_connections');
  const rows = (conns ?? []) as ConnRow[];

  const toPending = (r: ConnRow, dir: 'incoming' | 'outgoing'): PendingRequest => ({
    friendshipId: r.friendship_id, userId: r.other_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url, direction: dir,
  });

  const incoming = rows.filter((r) => r.direction === 'incoming').map((r) => toPending(r, 'incoming'));
  const outgoing = rows.filter((r) => r.direction === 'outgoing').map((r) => toPending(r, 'outgoing'));

  const friends: FriendRank[] = rows
    .filter((r) => r.direction === 'friend')
    .map((r) => ({
      userId: r.other_id, friendshipId: r.friendship_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url,
      streak: r.streak_current, weekMinutes: r.week_minutes, coveragePct: r.coverage_pct,
    }));

  const self: FriendRank = {
    userId: user.id, name: me?.display_name ?? 'Você', avatarUrl: me?.avatar_url ?? null,
    streak: me?.streak_current ?? 0, weekMinutes: me?.week_minutes ?? 0, coveragePct: me?.coverage_pct ?? 0, isMe: true,
  };

  const ranking = [...friends, self].sort((a, b) => b.weekMinutes - a.weekMinutes || b.streak - a.streak);
  return { profile, ranking, incoming, outgoing };
}
