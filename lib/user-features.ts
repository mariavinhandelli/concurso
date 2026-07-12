// lib/user-features.ts
// Tipos e mapeamento puro do feature store da IA invisível (tabela user_features,
// recalculada de madrugada por pg_cron — ver migração 20260712130000).
// Separado do service para poder ser importado tanto no client quanto em
// queries server-side sem arrastar o supabase browser client.

export interface UserFeatures {
  daysSinceStudy: number | null;
  activeDays14d: number;
  medianSessionMin: number | null;
  peakHour: number | null;
  churnScore: number;
  planScale: number;      // 1 = plano normal; <1 = dia leve (risco de abandono)
  floorMinutes: number;   // piso pessoal de bloco (P25 das sessões, 10–30)
  srsAdjust: Record<string, number>; // subject_id → multiplicador de intervalo SRS
}

// Ausência de linha (usuário novo, refresh ainda não rodou, leitura falhou)
// degrada para o comportamento pré-IA: plano cheio, piso 30, SM-2 puro.
export const DEFAULT_FEATURES: UserFeatures = {
  daysSinceStudy: null,
  activeDays14d: 0,
  medianSessionMin: null,
  peakHour: null,
  churnScore: 0,
  planScale: 1,
  floorMinutes: 30,
  srsAdjust: {},
};

export interface UserFeaturesRow {
  days_since_study: number | null;
  active_days_14d: number | null;
  median_session_min: number | null;
  peak_hour: number | null;
  churn_score: number | string | null;
  plan_scale: number | string | null;
  floor_minutes: number | null;
  srs_adjust: Record<string, number> | null;
}

export function mapUserFeaturesRow(row: UserFeaturesRow | null): UserFeatures {
  if (!row) return DEFAULT_FEATURES;
  return {
    daysSinceStudy: row.days_since_study,
    activeDays14d: row.active_days_14d ?? 0,
    medianSessionMin: row.median_session_min,
    peakHour: row.peak_hour,
    churnScore: Number(row.churn_score ?? 0),
    planScale: Number(row.plan_scale ?? 1),
    floorMinutes: row.floor_minutes ?? 30,
    srsAdjust: row.srs_adjust ?? {},
  };
}

// Multiplicador de intervalo SRS de uma matéria (1 = sem ajuste).
export function srsModifierFor(features: UserFeatures, subjectId: string | null | undefined): number {
  if (!subjectId) return 1;
  return features.srsAdjust[subjectId] ?? 1;
}
