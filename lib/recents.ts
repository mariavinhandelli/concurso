// lib/recents.ts
// M12 — Rastro client-side dos últimos itens abertos (matérias, leis, julgados),
// para o Command Palette oferecer "voltar rápido" sem depender da hierarquia.
// 100% localStorage — não toca no banco. SSR-safe (guarda typeof window).

export type RecentKind = 'subject' | 'lei' | 'juris' | 'edital';

export interface RecentItem {
  kind: RecentKind;
  id: string;          // subject id, lei slug, ou juris id
  label: string;
  sublabel?: string;
  href: string;
  ts: number;
}

const KEY = 'focali:recents';
const MAX = 8;
export const RECENTS_CHANGED_EVENT = 'focali:recents-changed';

export function getRecents(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: Omit<RecentItem, 'ts'>): void {
  if (typeof window === 'undefined' || !item.id || !item.label) return;
  try {
    const list = getRecents().filter((r) => !(r.kind === item.kind && r.id === item.id));
    const next = [{ ...item, ts: Date.now() }, ...list].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENTS_CHANGED_EVENT));
  } catch {
    /* modo privado / cota — recentes são best-effort */
  }
}
