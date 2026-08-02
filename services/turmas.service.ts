// services/turmas.service.ts
// N11 Fase 2 — Turmas (grupos com código). Reusa social_profiles/pushMyStats da
// Fase 1 para os agregados. Criar/entrar passam por RPC SECURITY DEFINER que
// valida o código (INSERT direto em turma_members é negado por RLS). Privacidade
// opt-in mantida: criar/entrar ativa o perfil social conscientemente.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';
import { enableSocial, getMySocialProfile } from '@/services/social.service';
import { track, EV } from '@/lib/analytics';

export interface Turma {
  id: string;
  name: string;
  joinCode: string;
  memberCount: number;
  isOwner: boolean;
}

export interface TurmaMemberRank {
  userId: string;
  name: string;
  avatarUrl: string | null;
  streak: number;
  weekMinutes: number;
  coveragePct: number;
  daysOnTarget: number;
  role: string;
  isMe?: boolean;
  // false = membro desativou o perfil social. A RPC zera os agregados dele
  // (migration 20260727120000); a tela o tira do pódio em vez de exibir 0 min.
  enabled: boolean;
}

const NOME_PADRAO = 'Concurseiro(a)';

// P3-15 — antes o error.message cru do PostgREST ia para o toast (foi assim que
// "column reference \"turma_id\" is ambiguous" apareceu para o usuário).
function erroAmigavel(error: { message: string }, fallback: string): string {
  console.error('[turmas]', error);
  if (/permission denied|row-level security/i.test(error.message)) return 'Você não tem permissão para isso.';
  if (/Failed to fetch|NetworkError/i.test(error.message)) return 'Sem conexão. Tente de novo.';
  return fallback;
}

// Código de 8 chars, sem caracteres ambíguos (mesmo alfabeto do convite de amigo).
function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[arr[i] % alphabet.length];
  return out;
}

// Garante que o perfil social esteja ativo (necessário para aparecer no ranking).
async function ensureSocial(): Promise<void> {
  const p = await getMySocialProfile();
  if (!p?.enabled) await enableSocial();
}

export async function createTurma(name: string): Promise<Turma> {
  const nome = name.trim();
  if (!nome) throw new Error('Dê um nome à turma.');
  const supabase = createClient();
  await ensureSocial();

  // Tenta até achar um código único (colisão é astronomicamente rara).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.rpc('create_turma', { p_name: nome, p_code: genCode() });
    if (!error) {
      const rows = (data ?? []) as { id: string; name: string; join_code: string }[];
      if (rows.length) {
        const r = rows[0];
        track(EV.turmaCreated);
        return { id: r.id, name: r.name, joinCode: r.join_code, memberCount: 1, isOwner: true };
      }
    } else if (!/duplicate|unique/i.test(error.message)) {
      throw new Error(erroAmigavel(error, 'Não foi possível criar a turma.'));
    }
  }
  throw new Error('Não foi possível gerar um código único. Tente novamente.');
}

export async function findTurmaByCode(code: string): Promise<{ turmaId: string; name: string; memberCount: number } | null> {
  const supabase = createClient();
  const { data } = await supabase.rpc('find_turma_by_code', { p_code: code.trim().toUpperCase() });
  const rows = (data ?? []) as { turma_id: string; name: string; member_count: number }[];
  if (rows.length === 0) return null;
  return { turmaId: rows[0].turma_id, name: rows[0].name, memberCount: Number(rows[0].member_count) };
}

export async function joinTurmaByCode(code: string): Promise<{ turmaId: string; name: string } | null> {
  const supabase = createClient();
  await ensureSocial();
  const { data, error } = await supabase.rpc('join_turma_by_code', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(erroAmigavel(error, 'Não foi possível entrar na turma.'));
  const rows = (data ?? []) as { turma_id: string; name: string }[];
  if (rows.length === 0) return null;
  track(EV.turmaJoined);
  return { turmaId: rows[0].turma_id, name: rows[0].name };
}

export async function listMyTurmas(): Promise<Turma[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_my_turmas');
  return ((data ?? []) as { id: string; name: string; join_code: string; member_count: number; is_owner: boolean }[])
    .map((r) => ({ id: r.id, name: r.name, joinCode: r.join_code, memberCount: Number(r.member_count), isOwner: r.is_owner }));
}

export async function getTurmaRanking(turmaId: string): Promise<TurmaMemberRank[]> {
  const supabase = createClient();
  const user = await getCachedUser();
  const { data } = await supabase.rpc('get_turma_ranking', { p_turma_id: turmaId });
  return ((data ?? []) as { user_id: string; name: string | null; avatar_url: string | null; streak_current: number; week_minutes: number; coverage_pct: number; days_on_target: number; role: string; enabled: boolean }[])
    .map((r) => ({
      userId: r.user_id, name: r.name ?? NOME_PADRAO, avatarUrl: r.avatar_url,
      streak: r.streak_current, weekMinutes: r.week_minutes, coveragePct: r.coverage_pct,
      daysOnTarget: r.days_on_target,
      role: r.role, isMe: r.user_id === user?.id, enabled: r.enabled,
    }));
}

export async function leaveTurma(turmaId: string): Promise<void> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return;
  const { error } = await supabase.from('turma_members').delete().eq('turma_id', turmaId).eq('user_id', user.id);
  if (error) throw new Error(erroAmigavel(error, 'Não foi possível sair da turma.'));
  track(EV.turmaLeft);
}

export async function removeMember(turmaId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('turma_members').delete().eq('turma_id', turmaId).eq('user_id', userId);
  if (error) throw new Error(erroAmigavel(error, 'Não foi possível remover o membro.'));
}

export async function deleteTurma(turmaId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('turmas').delete().eq('id', turmaId);
  if (error) throw new Error(erroAmigavel(error, 'Não foi possível apagar a turma.'));
}
