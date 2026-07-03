// lib/schedule-utils.ts
// Utilitários puros do módulo de cronograma — sem I/O, sem React.
// Movidos de page.tsx para permitir reuso e teste unitário isolado.

import { toLocalDateString as localDateStr } from '@/lib/local-date';

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function mondayOf(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

const PREFIXOS = ['direito', 'lingua', 'língua', 'nocoes', 'noções', 'legislacao', 'legislação', 'raciocinio', 'raciocínio'];
export function abreviaMateria(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length < 2) return nome;
  if (PREFIXOS.includes(partes[0].toLowerCase())) {
    return `${partes[0][0].toUpperCase()}. ${partes.slice(1).join(' ')}`;
  }
  return nome;
}

const _tonsCache = new Map<string, { bg: string; text: string; border: string }>();
export function tons(hex: string): { bg: string; text: string; border: string } {
  const cached = _tonsCache.get(hex);
  if (cached) return cached;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.78);
  const dark = (c: number) => Math.round(c * 0.4);
  const result = {
    bg: `rgb(${mix(r)},${mix(g)},${mix(b)})`,
    border: hex,
    text: `rgb(${dark(r)},${dark(g)},${dark(b)})`,
  };
  _tonsCache.set(hex, result);
  return result;
}

export function fmtH(min: number): string {
  return `${Math.round((min / 60) * 10) / 10}h`;
}

export function dateLabelOf(d: Date): string {
  return `${DIAS_SEMANA[(d.getDay() + 6) % 7]}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}

export function isToday(d: Date): boolean {
  return localDateStr(d) === localDateStr(new Date());
}

export function weekDias(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function weekLabel(weekStart: Date): string {
  const dias = weekDias(weekStart);
  return `${dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
}
