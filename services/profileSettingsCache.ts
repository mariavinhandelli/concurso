'use client';
// services/profileSettingsCache.ts
// H12 — getDailyTarget, getDailyTargetQuestions e getStudyAnchor liam
// `profiles.settings` cada um com sua própria query — a MESMA coluna, 3x (e
// mais 2x via getSuggestedDailyTarget/getStreak, que chamam getDailyTarget)
// por carga da Home. Mesmo padrão de primaryTargetCache.ts/archivedCache.ts:
// promise coalescing com TTL curto. 'use client' é OBRIGATÓRIO — nunca
// importar de Server Component (vazaria settings entre usuários no processo
// do servidor).
//
// Invalidar (invalidateProfileSettingsCache) após qualquer merge_profile_settings.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface ProfileSettings {
  dailyTargetMinutes?: number;
  dailyTargetQuestions?: number;
  studyAnchor?: string;
  [key: string]: unknown;
}

let _cache: Promise<ProfileSettings> | null = null;
let _expiry = 0;
let _cachedUserId: string | null = null;

export async function getProfileSettings(): Promise<ProfileSettings> {
  const now = Date.now();
  if (_cache && now < _expiry) return _cache;
  _expiry = now + 30_000; // 30s — invalidação manual cobre as escritas (merge_profile_settings)
  const fetchPromise = (async () => {
    const user = await getCachedUser();
    if (!user) { _cachedUserId = null; return {}; }
    if (_cachedUserId !== null && _cachedUserId !== user.id) {
      _cache = null;
      _expiry = 0;
    }
    _cachedUserId = user.id;
    const supabase = createClient();
    const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle();
    return (data?.settings ?? {}) as ProfileSettings;
  })();
  _cache = fetchPromise;
  fetchPromise.catch(() => {
    if (_cache === fetchPromise) _cache = null;
  });
  return fetchPromise;
}

export function invalidateProfileSettingsCache(): void {
  _cache = null;
  _cachedUserId = null;
}
