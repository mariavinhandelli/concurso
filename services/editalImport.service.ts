// services/editalImport.service.ts
// Fallback manual do Banco de Editais: a partir de disciplinas+tópicos parseados
// de um texto colado, cria um concurso-alvo com matérias, tópicos e vínculos.
'use client';

import { createTargetExam } from '@/services/targetExams.service';
import { createSubject } from '@/services/subjects.service';
import { createTopicsBulk, listTopics } from '@/services/topics.service';
import { linkTopicsBulk } from '@/services/targetTopics.service';
import { SUBJECT_COLORS } from '@/lib/subject-colors';
import type { EditalGroup } from '@/lib/parse-edital';

export async function importEditalAsTarget(input: {
  orgao?: string | null;
  cargo?: string | null;
  groups: EditalGroup[];
  ano_alvo?: number | null;
  exam_date?: string | null;
  board_id?: string | null;
}): Promise<string> {
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
  });

  let i = 0;
  for (const g of input.groups) {
    const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    const subject = await createSubject(g.subject, color);
    await createTopicsBulk(subject.id, g.topics);
    // matéria recém-criada → todos os tópicos são os importados; vincula todos ao alvo
    const topics = await listTopics(subject.id);
    if (topics.length > 0) await linkTopicsBulk(topics.map((t) => t.id), target.id);
    i++;
  }

  return target.id;
}
