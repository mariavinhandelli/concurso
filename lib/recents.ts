// lib/recents.ts
// M12 — Rastro client-side dos últimos itens abertos (matérias, leis, julgados),
// para o Command Palette oferecer "voltar rápido" sem depender da hierarquia.
// 100% localStorage — não toca no banco. SSR-safe (guarda typeof window).
//
// Chave escopada por userId (mesmo cuidado de lib/timer-storage.ts). Achado da
// auditoria de isolamento (02/08): a chave era global (`focali:recents`) — o
// Command Palette da conta B mostrava os últimos itens abertos pela conta A no
// mesmo navegador até acumular 8 acessos próprios. clearLegacyRecents() some
// com o resíduo da chave antiga.

import { getCachedUser } from '@/lib/supabase/authCache';

export type RecentKind = 'subject' | 'lei' | 'juris' | 'edital';

export interface RecentItem {
  kind: RecentKind;
  id: string;          // subject id, lei slug, ou juris id
  label: string;
  sublabel?: string;
  href: string;
  ts: number;
}

const LEGACY_KEY = 'focali:recents';
const MAX = 8;
export const RECENTS_CHANGED_EVENT = 'focali:recents-changed';

function keyFor(userId: string): string {
  return `focali:recents:${userId}`;
}

/** Remove o resíduo da chave global pré-auditoria. Chamado em clearAllClientCaches(). */
export function clearLegacyRecents(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* best-effort */
  }
}

export async function getRecents(): Promise<RecentItem[]> {
  if (typeof window === 'undefined') return [];
  const user = await getCachedUser();
  if (!user) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(user.id));
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function pushRecent(item: Omit<RecentItem, 'ts'>): Promise<void> {
  if (typeof window === 'undefined' || !item.id || !item.label) return;
  const user = await getCachedUser();
  if (!user) return;
  try {
    const list = await getRecents();
    const next = [{ ...item, ts: Date.now() }, ...list.filter((r) => !(r.kind === item.kind && r.id === item.id))].slice(0, MAX);
    window.localStorage.setItem(keyFor(user.id), JSON.stringify(next));
    window.dispatchEvent(new Event(RECENTS_CHANGED_EVENT));
  } catch {
    /* modo privado / cota — recentes são best-effort */
  }
}
