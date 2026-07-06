// Funções de domínio puras do módulo targets.
// Sem React, sem Supabase — testáveis com node:test diretamente.

import type { Subject } from '@/services/subjects.service';
import type { Topic } from '@/services/topics.service';

export interface SubjectTree {
  subject: Subject;
  topics: Topic[];
}

// Subconjunto mínimo necessário — evita importar TargetExam e criar dependência circular
// (targetExams.service importa buildTargetSlug deste arquivo).
interface TargetLabelable {
  boardName: string | null;
  orgao: string | null;
  cargo: string | null;
  ano_alvo: number | null;
}

export function buildTargetSlug(
  banca: string | null,
  orgao?: string | null,
  cargo?: string | null,
  ano?: number | null,
): string {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
     .replace(/[^a-z0-9]+/g, '').slice(0, 20);
  return [banca, orgao, cargo, ano]
    .filter(Boolean)
    .map((p) => (typeof p === 'number' ? String(p) : norm(p as string)))
    .join('-') || 'concurso';
}

export function formatTargetLabel(t: TargetLabelable): string {
  return [t.boardName ?? 'Banca a definir', t.orgao, t.cargo, t.ano_alvo]
    .filter(Boolean)
    .join(' · ');
}

// Dias até a prova (negativo = já passou). Puro: recebe "hoje" para ser testável.
export function daysUntilExam(examDate: string, today: Date = new Date()): number {
  const target = new Date(examDate + 'T00:00:00');
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export interface CountdownInfo {
  label: string;
  tone: 'danger' | 'warn' | 'ok' | 'past';
}

export function countdownInfo(days: number): CountdownInfo {
  if (days < 0) return { label: 'Prova realizada', tone: 'past' };
  if (days === 0) return { label: 'Prova é hoje!', tone: 'danger' };
  if (days === 1) return { label: 'Falta 1 dia', tone: 'danger' };
  const label = `Faltam ${days} dias`;
  if (days <= 30) return { label, tone: 'danger' };
  if (days <= 90) return { label, tone: 'warn' };
  return { label, tone: 'ok' };
}

export function pesoEfetivo(
  topicWeights: Record<string, number | null>,
  subjectWeights: Record<string, number>,
  topicId: string,
  subjectId: string,
): number {
  const tw = topicWeights[topicId];
  if (tw != null) return tw;
  return subjectWeights[subjectId] ?? 1;
}
