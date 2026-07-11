// services/concursoArchive.service.ts
// M11 — Arquivamento transversal de concurso (orquestração, não-destrutiva).
// Camada acima de targetExams/userSubjects/cycleEngine que compõe o gesto de
// arquivar: o concurso + (opcional) suas matérias EXCLUSIVAS + (opcional) o
// ciclo ativo. Matérias compartilhadas com outros concursos ativos nunca são
// arquivadas. Tudo reversível (nada é apagado).
'use client';

import { requireUser } from '@/lib/supabase/requireUser';
import { archiveTargetExam, unarchiveTargetExam } from '@/services/targetExams.service';
import { archiveSubject, unarchiveSubject } from '@/services/userSubjects.service';
import { getActiveCycleRule, archiveCycle, reactivateCycle } from '@/services/cycleEngine.service';
import { invalidateArchivedCache } from '@/services/archivedCache';

export interface ConcursoArchivePreview {
  exclusiveSubjects: { id: string; name: string }[]; // matérias usadas SÓ neste concurso (ativas)
  sharedCount: number;                                 // matérias deste concurso que outros alvos também usam
  hasActiveCycle: boolean;
}

// Núcleo reusável: matérias exclusivas a um concurso (tocadas só por ele, entre
// os alvos NÃO-arquivados) + quantas são compartilhadas. Usado pelo preview de
// arquivar e pela restauração (que reativa as exclusivas que ficaram arquivadas).
async function computeExclusive(targetId: string): Promise<{ exclusiveIds: string[]; sharedCount: number }> {
  const { supabase, userId } = await requireUser();

  const { data: activeTargets } = await supabase
    .from('target_exams').select('id').eq('user_id', userId).is('archived_at', null);
  const activeIds = (activeTargets ?? []).map((t) => t.id as string);
  if (activeIds.length === 0) return { exclusiveIds: [], sharedCount: 0 };

  const { data: links } = await supabase
    .from('topic_target_exams').select('topic_id, target_exam_id').in('target_exam_id', activeIds);
  const linkRows = (links ?? []) as { topic_id: string; target_exam_id: string }[];

  const topicIds = [...new Set(linkRows.map((l) => l.topic_id))];
  const subjOfTopic = new Map<string, string>();
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics').select('id, subject_id').in('id', topicIds).eq('user_id', userId);
    for (const t of topics ?? []) subjOfTopic.set(t.id as string, t.subject_id as string);
  }

  const subjTargets = new Map<string, Set<string>>();
  for (const l of linkRows) {
    const sid = subjOfTopic.get(l.topic_id);
    if (!sid) continue;
    (subjTargets.get(sid) ?? subjTargets.set(sid, new Set()).get(sid)!).add(l.target_exam_id);
  }

  const exclusiveIds: string[] = [];
  let sharedCount = 0;
  for (const [sid, targets] of subjTargets) {
    if (!targets.has(targetId)) continue;
    if (targets.size === 1) exclusiveIds.push(sid);
    else sharedCount++;
  }
  return { exclusiveIds, sharedCount };
}

// Calcula o que o gesto de arquivar pode incluir, respeitando exclusividade.
export async function getConcursoArchivePreview(targetId: string): Promise<ConcursoArchivePreview> {
  const { supabase, userId } = await requireUser();
  const hasActiveCycle = !!(await getActiveCycleRule());
  const { exclusiveIds, sharedCount } = await computeExclusive(targetId);

  // Nomes das exclusivas — só as que ainda estão ativas (sem sentido oferecer as já arquivadas).
  let exclusiveSubjects: { id: string; name: string }[] = [];
  if (exclusiveIds.length > 0) {
    const { data: subs } = await supabase
      .from('subjects').select('id, name, status').in('id', exclusiveIds).eq('user_id', userId);
    exclusiveSubjects = (subs ?? [])
      .filter((s) => s.status === 'ativo')
      .map((s) => ({ id: s.id as string, name: s.name as string }));
  }

  return { exclusiveSubjects, sharedCount, hasActiveCycle };
}

// Executa o gesto: arquiva o concurso + as matérias escolhidas + (opcional) o ciclo ativo.
// O ciclo arquivado fica registrado no alvo (archived_cycle_rule_id) para a
// restauração poder reativá-lo junto.
export async function archiveConcurso(
  targetId: string,
  opts: { subjectIds: string[]; includeCycle: boolean },
): Promise<void> {
  await archiveTargetExam(targetId);
  for (const sid of opts.subjectIds) {
    await archiveSubject(sid); // já invalida o archivedCache
  }
  if (opts.includeCycle) {
    const cycleId = await getActiveCycleRule();
    if (cycleId) {
      await archiveCycle(cycleId);
      const { supabase, userId } = await requireUser();
      await supabase
        .from('target_exams')
        .update({ archived_cycle_rule_id: cycleId })
        .eq('id', targetId)
        .eq('user_id', userId);
    }
  }
  invalidateArchivedCache();
}

// Restaura o concurso, reativa as matérias que são exclusivas dele e ficaram
// arquivadas (fase 2 do M11) e reativa o ciclo arquivado junto no gesto —
// desde que o usuário não tenha criado outro ciclo ativo nesse meio-tempo.
export async function unarchiveConcurso(targetId: string): Promise<void> {
  await unarchiveTargetExam(targetId); // volta a ativo antes de recomputar exclusividade
  const { exclusiveIds } = await computeExclusive(targetId);
  const { supabase, userId } = await requireUser();
  if (exclusiveIds.length > 0) {
    const { data: subs } = await supabase
      .from('subjects').select('id, status').in('id', exclusiveIds).eq('user_id', userId);
    const archived = (subs ?? []).filter((s) => s.status === 'arquivado').map((s) => s.id as string);
    for (const id of archived) await unarchiveSubject(id);
  }

  const { data: target } = await supabase
    .from('target_exams')
    .select('archived_cycle_rule_id')
    .eq('id', targetId)
    .eq('user_id', userId)
    .maybeSingle();
  const ruleId = target?.archived_cycle_rule_id as string | null;
  if (ruleId) {
    const activeNow = await getActiveCycleRule();
    if (!activeNow) {
      // Só reativa se não houver ciclo ativo — um ciclo criado depois tem prioridade.
      try { await reactivateCycle(ruleId); } catch { /* ciclo pode ter sido excluído */ }
    }
    await supabase
      .from('target_exams')
      .update({ archived_cycle_rule_id: null })
      .eq('id', targetId)
      .eq('user_id', userId);
  }
  invalidateArchivedCache();
}
