// services/narrative.service.ts
// M6 — leitura do mês: busca a narrativa mais recente gravada pela Edge
// Function monthly-narrative (mês COMPLETO anterior, IA redige + juiz confere).

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface MonthlyNarrative {
  month: string;      // 'YYYY-MM'
  monthLabel: string; // 'junho'
  frases: string[];
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export async function getLatestNarrative(): Promise<MonthlyNarrative | null> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('monthly_narratives')
    .select('month, frases')
    .eq('user_id', user.id)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Erro ao carregar a leitura do mês: ' + error.message);
  if (!data) return null;

  const frases = Array.isArray(data.frases) ? (data.frases as string[]) : [];
  if (frases.length === 0) return null;

  const mesIdx = Number((data.month as string).split('-')[1]) - 1;
  return {
    month: data.month as string,
    monthLabel: MESES[mesIdx] ?? data.month as string,
    frases,
  };
}
