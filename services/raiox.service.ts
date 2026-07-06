// services/raiox.service.ts
// Raio-X da Prontidão: "se a prova fosse hoje, como eu estaria?" — combina
// cobertura, saúde dos tópicos e acerto recente em questões, ponderados pelo
// peso de cada matéria no edital-alvo primário. Não é uma métrica nova do
// zero: é a AGREGAÇÃO das métricas que já existem (coverage/metrics/blueprints)
// numa única resposta acionável, por matéria.
//
// Deliberadamente SEM ETA ("pronto em N dias"): não há histórico de snapshots
// do score ao longo do tempo, então qualquer estimativa de prazo seria
// inventada. Melhor mostrar o que falta de forma honesta do que uma previsão
// fabricada.

import { tryGetUser } from '@/lib/supabase/requireUser';
import { getSaudeMap, mediaPonderadaRenormalizada } from '@/services/metrics.service';

export type NivelProntidao = 'construcao' | 'progresso' | 'quase_la' | 'pronto';

const PESO_COBERTURA = 0.30;
const PESO_SAUDE = 0.45;
const PESO_ACERTO = 0.25;

export interface RaioXMateria {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  weight: number;
  score: number;              // 0-100
  coveragePct: number;        // 0-100
  saudeMedia: number;         // 0-100 (média sobre TODOS os tópicos vinculados, não só os estudados)
  acertoPct: number | null;   // null = ainda sem questões respondidas nessa matéria
  topicosTotal: number;
  topicosNaoIniciados: number;
  semTopicosVinculados: boolean; // matéria tem peso no edital mas nenhum tópico ligado a ele
}

export interface RaioX {
  hasTarget: boolean;
  targetName: string | null;
  hasBlueprint: boolean; // tem pesos definidos no edital?
  score: number;
  nivel: NivelProntidao;
  materias: RaioXMateria[]; // ordenado por urgência (peso alto × distância de "pronto")
  focoPrincipal: RaioXMateria | null;
}

const EMPTY: RaioX = {
  hasTarget: false, targetName: null, hasBlueprint: false,
  score: 0, nivel: 'construcao', materias: [], focoPrincipal: null,
};

function nivelDe(score: number): NivelProntidao {
  if (score >= 85) return 'pronto';
  if (score >= 70) return 'quase_la';
  if (score >= 40) return 'progresso';
  return 'construcao';
}

export const NIVEL_LABEL: Record<NivelProntidao, string> = {
  construcao: 'Em construção',
  progresso: 'Em progresso',
  quase_la: 'Quase lá',
  pronto: 'Pronto',
};

export async function getRaioX(): Promise<RaioX> {
  const auth = await tryGetUser();
  if (!auth) return EMPTY;
  const { supabase, userId } = auth;

  const { data: targets } = await supabase
    .from('target_exams')
    .select('id, orgao, cargo, slug')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  const target = targets?.[0];
  if (!target) return EMPTY;
  const targetName = [target.orgao, target.cargo].filter(Boolean).join(' · ') || target.slug || 'Meu edital';

  const { data: blueprintRows } = await supabase
    .from('exam_blueprints')
    .select('subject_id, weight, subjects(name, color)')
    .eq('target_exam_id', target.id)
    .eq('user_id', userId);

  const blueprints = (blueprintRows ?? [])
    .map((b) => {
      const rel = b.subjects as unknown as { name: string; color: string } | { name: string; color: string }[] | null;
      const subj = Array.isArray(rel) ? rel[0] : rel;
      return { subjectId: b.subject_id as string, weight: Number(b.weight) || 0, name: subj?.name ?? 'Matéria', color: subj?.color ?? '#C9B8DD' };
    })
    .filter((b) => b.weight > 0);

  if (blueprints.length === 0) return { ...EMPTY, hasTarget: true, targetName };

  const { data: links } = await supabase
    .from('topic_target_exams')
    .select('topic_id')
    .eq('target_exam_id', target.id);
  const linkedIds = (links ?? []).map((l) => l.topic_id as string);

  if (linkedIds.length === 0) {
    return { ...EMPTY, hasTarget: true, targetName, hasBlueprint: true };
  }

  const subjectIds = blueprints.map((b) => b.subjectId);

  const [{ data: topicRows }, { data: studiedRows }, { data: accRows }, saudeMap] = await Promise.all([
    supabase.from('topics').select('id, subject_id').in('id', linkedIds),
    supabase.from('study_logs').select('topic_id').eq('user_id', userId).in('topic_id', linkedIds),
    supabase.from('study_logs').select('subject_id, questions_total, questions_correct')
      .eq('user_id', userId).eq('mode', 'questoes').in('subject_id', subjectIds),
    getSaudeMap(linkedIds),
  ]);

  const coveredSet = new Set((studiedRows ?? []).map((r) => r.topic_id as string));

  const accBySubject = new Map<string, { total: number; correct: number }>();
  for (const r of accRows ?? []) {
    const acc = accBySubject.get(r.subject_id as string) ?? { total: 0, correct: 0 };
    acc.total += r.questions_total ?? 0;
    acc.correct += r.questions_correct ?? 0;
    accBySubject.set(r.subject_id as string, acc);
  }

  const materias: RaioXMateria[] = blueprints.map((b) => {
    const topicIds = (topicRows ?? []).filter((t) => t.subject_id === b.subjectId).map((t) => t.id as string);
    const topicosTotal = topicIds.length;
    const semTopicosVinculados = topicosTotal === 0;

    const studied = topicIds.filter((id) => coveredSet.has(id)).length;
    const coveragePct = topicosTotal > 0 ? Math.round((studied / topicosTotal) * 100) : 0;
    const saudeMedia = topicosTotal > 0
      ? Math.round(topicIds.reduce((s, id) => s + (saudeMap[id] ?? 0), 0) / topicosTotal)
      : 0;

    const acc = accBySubject.get(b.subjectId);
    const acertoPct = acc && acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : null;

    const score = Math.round(mediaPonderadaRenormalizada([
      { valor: coveragePct, peso: PESO_COBERTURA },
      { valor: saudeMedia, peso: PESO_SAUDE },
      { valor: acertoPct, peso: PESO_ACERTO },
    ]) ?? 0);

    return {
      subjectId: b.subjectId, subjectName: b.name, subjectColor: b.color, weight: b.weight,
      score, coveragePct, saudeMedia, acertoPct,
      topicosTotal, topicosNaoIniciados: topicosTotal - studied, semTopicosVinculados,
    };
  });

  const somaPesos = materias.reduce((s, m) => s + m.weight, 0);
  const scoreGlobal = somaPesos > 0
    ? Math.round(materias.reduce((s, m) => s + m.score * m.weight, 0) / somaPesos)
    : 0;

  const ordenadas = [...materias].sort((a, b) => (b.weight * (100 - b.score)) - (a.weight * (100 - a.score)));
  const focoPrincipal = ordenadas.length > 0 && ordenadas[0].score < 85 ? ordenadas[0] : null;

  return {
    hasTarget: true, targetName, hasBlueprint: true,
    score: scoreGlobal, nivel: nivelDe(scoreGlobal),
    materias: ordenadas, focoPrincipal,
  };
}
