// supabase/functions/generate-error-flashcards/index.ts
// IA invisível · Fase 3 — flashcards automáticos a partir do caderno de erros.
// Roda de madrugada via pg_cron, processa um lote pequeno por noite, nunca no
// caminho de uma requisição de usuária.
//
// Diferente da Fase 2 (cache global — uma lei é igual pra todo mundo), aqui o
// conteúdo-fonte é PRIVADO: a nota que cada usuária escreveu sobre o próprio
// erro (error_notebooks.content_text). Por isso o card nasce direto em
// `flashcards` (já protegida por RLS owner-only) — nunca passa por ai_artifacts,
// que é legível por qualquer usuária autenticada.
//
// Validação: como não há uma "lei" externa pra checar, a validação aqui é
// FIDELIDADE — um segundo modelo (juiz, que só vê a nota original + o card
// gerado) confirma que o verso do card não inventou nenhum fato que não esteja
// na nota da usuária. Notas curtas demais (< MIN_CONTENT_CHARS, ex. "teste",
// "asdasd") nem chegam a gerar chamada de LLM — são puladas na hora, tanto por
// economia quanto porque não há conteúdo real pra fundamentar um card.
//
// Idempotência: flashcard_generation_log tem 1 linha por (usuária, nota)
// processada, resultado 'created' ou 'skipped' — nunca reprocessa a mesma nota.
//
// Segredo necessário: ANTHROPIC_API_KEY (mesmo secret do generate-lei-questoes).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const BATCH_SIZE = 6;
const MIN_CONTENT_CHARS = 30;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface ErrorNote {
  id: string;
  user_id: string;
  content_text: string | null;
  error_type: string | null;
  subject_id: string | null;
  topic_id: string | null;
  subject_name: string | null;
  topic_name: string | null;
}

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    front: { type: 'string' },
    back: { type: 'string' },
  },
  required: ['front', 'back'],
  additionalProperties: false,
};

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    fiel: { type: 'boolean' },
    justificativa: { type: 'string' },
  },
  required: ['fiel', 'justificativa'],
  additionalProperties: false,
};

let lastError: string | null = null;

async function callClaude(
  model: string,
  system: string,
  userText: string,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userText }],
      output_config: { format: { type: 'json_schema', schema } },
      thinking: { type: 'disabled' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Claude API ${res.status}: ${text}`);
    if (!lastError) lastError = `HTTP ${res.status}: ${text.slice(0, 500)}`;
    return null;
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    if (!lastError) lastError = 'refusal';
    return null;
  }
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock) {
    if (!lastError) lastError = `sem bloco de texto: ${JSON.stringify(data).slice(0, 500)}`;
    return null;
  }
  try {
    return JSON.parse(textBlock.text);
  } catch {
    if (!lastError) lastError = `JSON inválido: ${textBlock.text.slice(0, 500)}`;
    return null;
  }
}

async function generateCard(note: ErrorNote) {
  return callClaude(
    'claude-sonnet-5',
    'Você cria flashcards de estudo (frente/verso) para concursos públicos brasileiros, a partir de uma nota ' +
      'que a própria usuária escreveu sobre um erro que cometeu. Use SOMENTE o conteúdo da nota — nunca invente ' +
      'fatos, artigos de lei, números, prazos ou definições que não estejam nela.',
    `Matéria: ${note.subject_name ?? 'não informada'}` +
      (note.topic_name ? ` · Tópico: ${note.topic_name}` : '') +
      `\nTipo de erro: ${note.error_type ?? 'não informado'}\n\n` +
      `Nota da usuária:\n"${note.content_text}"\n\n` +
      'Crie um flashcard que ajude a fixar exatamente o que essa nota registra. A frente deve ser uma pergunta ' +
      'objetiva; o verso deve responder usando apenas o que está na nota.',
    CARD_SCHEMA,
  );
}

async function judgeCard(note: ErrorNote, front: string, back: string) {
  return callClaude(
    'claude-haiku-4-5',
    'Você verifica se um flashcard reflete fielmente uma nota de estudo, sem conteúdo inventado.',
    `Nota original:\n"${note.content_text}"\n\nFlashcard gerado:\nFrente: "${front}"\nVerso: "${back}"\n\n` +
      'O verso do flashcard contém APENAS informação presente ou razoavelmente implícita na nota original, sem ' +
      'fatos, números, artigos de lei ou definições inventadas? fiel=true se sim, fiel=false se o verso adicionar ' +
      'qualquer informação que não vem da nota.',
    JUDGE_SCHEMA,
  );
}

function tomorrowISODate(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

Deno.serve(async () => {
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), { status: 500 });
  }

  const { data: notes, error: fetchError } = await supabase
    .from('error_notebooks')
    .select('id, user_id, content_text, error_type, subject_id, topic_id, subjects(name), topics(name)')
    .order('created_at', { ascending: true });
  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const { data: logged } = await supabase.from('flashcard_generation_log').select('error_note_id');
  const loggedSet = new Set((logged ?? []).map((r) => r.error_note_id as string));

  const candidates: ErrorNote[] = (notes ?? [])
    .filter((n) => !loggedSet.has(n.id))
    .map((n) => {
      const subj = Array.isArray(n.subjects) ? n.subjects[0] : n.subjects;
      const top = Array.isArray(n.topics) ? n.topics[0] : n.topics;
      return {
        id: n.id, user_id: n.user_id, content_text: n.content_text, error_type: n.error_type,
        subject_id: n.subject_id, topic_id: n.topic_id,
        subject_name: (subj as { name?: string } | null)?.name ?? null,
        topic_name: (top as { name?: string } | null)?.name ?? null,
      };
    });

  let created = 0, skipped = 0, errored = 0, processed = 0;

  for (const note of candidates) {
    if (processed >= BATCH_SIZE) break;

    const text = (note.content_text ?? '').trim();
    if (text.length < MIN_CONTENT_CHARS) {
      await supabase.from('flashcard_generation_log').insert({
        user_id: note.user_id, error_note_id: note.id, status: 'skipped', reason: 'conteúdo insuficiente',
      });
      skipped++;
      continue; // não conta no processed — não custou LLM, não precisa contra o lote
    }

    processed++;
    try {
      const gerado = await generateCard(note);
      if (!gerado || typeof gerado.front !== 'string' || typeof gerado.back !== 'string') {
        await supabase.from('flashcard_generation_log').insert({
          user_id: note.user_id, error_note_id: note.id, status: 'skipped', reason: 'geração falhou',
        });
        errored++;
        continue;
      }

      const julgamento = await judgeCard(note, gerado.front as string, gerado.back as string);
      const fiel = !!julgamento && julgamento.fiel === true;

      if (fiel) {
        const { error: insertError } = await supabase.from('flashcards').insert({
          user_id: note.user_id,
          front: gerado.front,
          back: gerado.back,
          topic_id: note.topic_id,
          subject_id: note.subject_id,
          source_error_id: note.id,
          ai_generated: true,
          is_review_active: true,
          next_review_date: tomorrowISODate(),
          interval_days: 1,
          repetitions: 0,
          ease_factor: 2.5,
        });
        if (insertError) {
          await supabase.from('flashcard_generation_log').insert({
            user_id: note.user_id, error_note_id: note.id, status: 'skipped', reason: `erro ao inserir: ${insertError.message}`,
          });
          errored++;
          continue;
        }
        await supabase.from('flashcard_generation_log').insert({
          user_id: note.user_id, error_note_id: note.id, status: 'created',
        });
        created++;
      } else {
        await supabase.from('flashcard_generation_log').insert({
          user_id: note.user_id, error_note_id: note.id, status: 'skipped',
          reason: julgamento ? `juiz: infiel — ${julgamento.justificativa}` : 'juiz não retornou classificação válida',
        });
        skipped++;
      }
    } catch (e) {
      console.error(`Erro processando nota ${note.id}:`, e);
      await supabase.from('flashcard_generation_log').insert({
        user_id: note.user_id, error_note_id: note.id, status: 'skipped', reason: 'exceção não tratada',
      });
      errored++;
    }
  }

  return new Response(
    JSON.stringify({ totalCandidatos: candidates.length, created, skipped, errored, lastError }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
