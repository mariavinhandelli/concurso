// services/editalImport.service.ts
// Fallback manual do Banco de Editais: a partir de disciplinas+tópicos parseados
// de um texto colado, cria um concurso-alvo com matérias, tópicos e vínculos.
// Matérias e tópicos que o usuário já tem são REAPROVEITADOS (match por nome,
// ignorando caixa e acentos) — importar não deve duplicar a biblioteca.
'use client';

import { createTargetExam } from '@/services/targetExams.service';
import { createSubject, listSubjects } from '@/services/subjects.service';
import { createTopicsBulk, listTopics } from '@/services/topics.service';
import { linkTopicsBulk } from '@/services/targetTopics.service';
import { SUBJECT_COLORS } from '@/lib/subject-colors';
import type { EditalGroup } from '@/lib/parse-edital';

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

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

  const existing = await listSubjects();
  const byName = new Map(existing.map((s) => [norm(s.name), s]));

  let i = 0;
  for (const g of input.groups) {
    const reused = byName.get(norm(g.subject));
    const subject = reused ?? await createSubject(g.subject, SUBJECT_COLORS[i % SUBJECT_COLORS.length]);

    // Em matéria reaproveitada, cria apenas os tópicos que ainda não existem
    // e vincula ao alvo os importados (existentes + recém-criados).
    const current = reused ? await listTopics(subject.id) : [];
    const topicByName = new Map(current.map((t) => [norm(t.name), t.id]));
    const missing = g.topics.filter((name) => !topicByName.has(norm(name)));
    if (missing.length > 0) await createTopicsBulk(subject.id, missing);

    const after = missing.length > 0 || !reused ? await listTopics(subject.id) : current;
    const afterByName = new Map(after.map((t) => [norm(t.name), t.id]));
    const toLink = [...new Set(g.topics.map((name) => afterByName.get(norm(name))).filter((id): id is string => !!id))];
    if (toLink.length > 0) await linkTopicsBulk(toLink, target.id);
    i++;
  }

  return target.id;
}
