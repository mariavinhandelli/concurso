// lib/supabase/requireUser.ts
// Elimina o bloco de boilerplate de auth repetido em todo service.
// requireUser → lança erro se não autenticado (mutations).
// tryGetUser  → retorna null se não autenticado (queries que retornam vazio).

import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function requireUser(): Promise<AuthContext> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Você precisa estar logado.');
  return { supabase, userId: user.id };
}

export async function tryGetUser(): Promise<AuthContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}
