// services/retention.service.ts
// M3 — curva de retenção: lê os snapshots diários (progress_snapshots, gravados
// pelo cron take_progress_snapshots) e devolve a série pronta para o gráfico.
// A curva NUNCA inventa passado: começa no primeiro snapshot real do usuário.

import { createClient } from '@/lib/supabase/client';
import { getCachedUser } from '@/lib/supabase/authCache';

export interface RetentionPoint {
  date: string;              // 'YYYY-MM-DD'
  label: string;             // 'dd/mm' para o eixo X
  saudeMedia: number | null; // média da saúde dos tópicos no dia (null = sem métricas)
  dominadosPct: number | null; // % de tópicos com saúde >= 70
  coveragePct: number | null;  // cobertura do edital no dia (null = sem alvo)
}

export async function getRetentionCurve(days = 90): Promise<RetentionPoint[]> {
  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('progress_snapshots')
    .select('snapshot_date, saude_media, topicos_com_metrica, topicos_dominados, coverage_pct')
    .eq('user_id', user.id)
    .gte('snapshot_date', sinceStr)
    .order('snapshot_date', { ascending: true });
  if (error) throw new Error('Erro ao carregar a curva de retenção: ' + error.message);

  return (data ?? []).map((r) => {
    const [, m, d] = (r.snapshot_date as string).split('-');
    return {
      date: r.snapshot_date as string,
      label: `${d}/${m}`,
      saudeMedia: r.saude_media,
      dominadosPct: (r.topicos_com_metrica ?? 0) > 0
        ? Math.round(((r.topicos_dominados ?? 0) / r.topicos_com_metrica) * 100)
        : null,
      coveragePct: r.coverage_pct,
    };
  });
}
