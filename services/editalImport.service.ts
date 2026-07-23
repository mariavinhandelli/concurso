// services/editalImport.service.ts
// Fallback manual do Banco de Editais: a partir de disciplinas+tópicos parseados
// de um texto colado, cria um concurso-alvo com matérias, tópicos e vínculos.
// Matérias e tópicos que o usuário já tem são REAPROVEITADOS (match por nome,
// ignorando caixa e acentos) — importar não deve duplicar a biblioteca.
// Em falha no meio do caminho, desfaz o que criou (compensação): sem RPC
// transacional, é o que impede um concurso pela metade.
'use client';

import { createTargetExam, deleteTargetExam } from '@/services/targetExams.service';
import { createSubject, listSubjects, deleteSubject } from '@/services/subjects.service';
import { createTopicsBulk, listTopics, deleteTopic } from '@/services/topics.service';
import { linkTopicsBulk } from '@/services/targetTopics.service';
import { SUBJECT_COLORS } from '@/lib/subject-colors';
import type { EditalGroup } from '@/lib/parse-edital';

const MAX_GROUPS = 60; // nenhum edital real passa disso; protege contra colagem de lixo

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// "DIREITO CONSTITUCIONAL" → "Direito Constitucional" (conectivos minúsculos).
// Só é aplicado a matérias NOVAS; nomes já existentes ficam como estão.
const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'à', 'ao']);
function toTitleCase(s: string): string {
  const trimmed = s.trim();
  // Só normaliza se veio TODO em caixa alta — respeita capitalização intencional.
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export async function importEditalAsTarget(input: {
  orgao?: string | null;
  cargo?: string | null;
  groups: EditalGroup[];
  ano_alvo?: number | null;
  exam_date?: string | null;
  board_id?: string | null;
  // Match com o Banco de Editais (Fase 3): a importação carrega o vínculo
  // com o catálogo — o concurso nasce com ficha, linha do tempo e push.
  catalog_edital_id?: string | null;
}): Promise<string> {
  if (input.groups.length > MAX_GROUPS) {
    throw new Error(`Limite de ${MAX_GROUPS} disciplinas por importação. Confira se o texto colado é mesmo um conteúdo programático.`);
  }

  const orgao = input.orgao?.trim() || null;
  let cargo = input.cargo?.trim() || null;
  if (!orgao && !cargo) cargo = 'Edital importado'; // garante um slug não-vazio

  const target = await createTargetExam({
    orgao,
    cargo,
    phase: 'pre',
    ano_alvo: input.ano_alvo ?? null,
    exam_date: input.exam_date ?? null,
    board_id: input.board_id ?? null,
    catalog_edital_id: input.catalog_edital_id ?? null,
  });

  // Compensação em caso de falha: o alvo cascateia vínculos/pesos; matérias
  // novas cascateiam seus tópicos; em matéria reaproveitada, só os tópicos
  // que ESTE import criou são removidos.
  const createdSubjectIds: string[] = [];
  const createdTopicIds: string[] = [];

  try {
    const existing = await listSubjects();
    const byName = new Map(existing.map((s) => [norm(s.name), s]));

    let i = 0;
    for (const g of input.groups) {
      const reused = byName.get(norm(g.subject));
      let subject = reused;
      if (!subject) {
        subject = await createSubject(toTitleCase(g.subject), SUBJECT_COLORS[i % SUBJECT_COLORS.length]);
        createdSubjectIds.push(subject.id);
      }

      // Em matéria reaproveitada, cria apenas os tópicos que ainda não existem
      // e vincula ao alvo os importados (existentes + recém-criados).
      const current = reused ? await listTopics(subject.id) : [];
      const topicByName = new Map(current.map((t) => [norm(t.name), t.id]));
      const missing = g.topics.filter((name) => !topicByName.has(norm(name)));
      if (missing.length > 0) await createTopicsBulk(subject.id, missing);

      const after = missing.length > 0 || !reused ? await listTopics(subject.id) : current;
      const afterByName = new Map(after.map((t) => [norm(t.name), t.id]));
      if (reused) {
        for (const name of missing) {
          const id = afterByName.get(norm(name));
          if (id) createdTopicIds.push(id);
        }
      }
      const toLink = [...new Set(g.topics.map((name) => afterByName.get(norm(name))).filter((id): id is string => !!id))];
      if (toLink.length > 0) await linkTopicsBulk(toLink, target.id);
      i++;
    }

    return target.id;
  } catch (e) {
    // Best-effort: se a própria limpeza falhar, ainda propagamos o erro original.
    await Promise.allSettled([
      ...createdTopicIds.map((id) => deleteTopic(id)),
      ...createdSubjectIds.map((id) => deleteSubject(id)),
    ]);
    await deleteTargetExam(target.id).catch(() => {});
    throw e instanceof Error
      ? new Error(`A importação falhou e foi desfeita — nada ficou pela metade. Detalhe: ${e.message}`)
      : e;
  }
}
